// Core susu rotation logic.
// A cycle is one payout turn inside a round.
// A round completes once every positioned member has received one payout.

import { ContributionStatus, CycleStatus } from "@/generated/prisma/client/enums";
import { prisma } from "@/lib/prisma";

/**
 * Returns the current active cycle for a group, or null if none exists.
 */
export async function getActiveCycle(groupId: string) {
  return prisma.cycle.findFirst({
    where: { groupId, status: { in: ["PENDING", "READY"] } },
    include: {
      contributions: { include: { user: true } },
      group: { include: { members: { include: { user: true } } } },
    },
    orderBy: { cycleNumber: "asc" },
  });
}

export function getPositionedMembers<T extends { payoutPosition: number | null }>(
  members: T[]
) {
  return members.filter((member) => member.payoutPosition !== null);
}

export function getEligibleContributorIds<
  T extends { userId: string; payoutPosition: number | null }
>(members: T[], recipientId: string) {
  return getPositionedMembers(members)
    .filter((member) => member.userId !== recipientId)
    .map((member) => member.userId);
}

/**
 * Get the member position whose turn it is to receive payout for a given cycle number.
 * payoutPosition is 1-based; cycle numbers move through the positions in the round.
 */
export function getRecipientPosition(cycleNumber: number, memberCount: number): number {
  return ((cycleNumber - 1) % memberCount) + 1;
}

/**
 * Create the first cycle for a newly formed group.
 * Call this after all members have been added to the group.
 */
export async function bootstrapFirstCycle(groupId: string, payoutDate: Date) {
  const group = await prisma.susuGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: { members: { include: { user: true }, orderBy: { payoutPosition: "asc" } } },
  });

  const positionedMembers = group.members.filter(
    (member) => member.payoutPosition !== null
  );

  if (positionedMembers.length === 0) {
    throw new Error("Group has no members with payout positions");
  }

  const recipient = positionedMembers[0]; // lowest position goes first

  return prisma.cycle.create({
    data: {
      groupId,
      cycleNumber: 1,
      recipientId: recipient.userId,
      payoutDate,
      status: "PENDING",
    },
  });
}

/**
 * Check if all eligible contributors in a cycle have contributed successfully.
 * If yes, marks the cycle as READY for payout.
 */
export async function checkAndMarkCycleReady(cycleId: string) {
  const cycle = await prisma.cycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: {
      group: { include: { members: true } },
      contributions: true,
    },
  });

  const eligibleContributorIds = new Set(
    getEligibleContributorIds(cycle.group.members, cycle.recipientId)
  );
  const successfulContributions = cycle.contributions.filter(
    (contribution) =>
      contribution.status === ContributionStatus.SUCCESS &&
      eligibleContributorIds.has(contribution.userId)
  );

  if (successfulContributions.length >= eligibleContributorIds.size) {
    const total = successfulContributions.reduce(
      (sum, contribution) => sum + Number(contribution.amount),
      0
    );
    await prisma.cycle.update({
      where: { id: cycleId },
      data: {
        status: CycleStatus.READY,
        totalCollected: total,
      },
    });
    return true;
  }

  return false;
}

/**
 * After a successful payout, advance the group to the next cycle.
 * Creates the next Cycle row with the correct recipient.
 */
export async function advanceToNextCycle(groupId: string, completedCycleNumber: number) {
  const group = await prisma.susuGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: { members: { orderBy: { payoutPosition: "asc" } } },
  });

  const positionedMembers = getPositionedMembers(group.members);
  const memberCount = positionedMembers.length;
  const nextCycleNumber = completedCycleNumber + 1;

  // If every positioned member has received their payout, the round completes.
  if (nextCycleNumber > memberCount) {
    await prisma.susuGroup.update({
      where: { id: groupId },
      data: { status: "COMPLETED", currentCycle: nextCycleNumber },
    });
    return null;
  }

  const nextPosition = getRecipientPosition(nextCycleNumber, memberCount);
  const nextRecipient = positionedMembers.find(
    (member) => member.payoutPosition === nextPosition
  );
  if (!nextRecipient) throw new Error(`No member at position ${nextPosition}`);

  // Calculate next payout date based on frequency
  const currentCycle = await prisma.cycle.findUniqueOrThrow({
    where: { groupId_cycleNumber: { groupId, cycleNumber: completedCycleNumber } },
  });

  const nextPayoutDate = getNextPayoutDate(currentCycle.payoutDate, group.frequency);

  const [nextCycle] = await prisma.$transaction([
    prisma.cycle.create({
      data: {
        groupId,
        cycleNumber: nextCycleNumber,
        recipientId: nextRecipient.userId,
        payoutDate: nextPayoutDate,
        status: "PENDING",
      },
    }),
    prisma.susuGroup.update({
      where: { id: groupId },
      data: { currentCycle: nextCycleNumber },
    }),
  ]);

  return nextCycle;
}

function getNextPayoutDate(currentDate: Date, frequency: string): Date {
  const next = new Date(currentDate);
  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}
