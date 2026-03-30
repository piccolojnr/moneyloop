// Core susu rotation logic

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

/**
 * Get the member whose turn it is to receive payout for a given cycle number.
 * payoutPosition is 1-based; cycle numbers wrap around member count.
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
 * Check if all members in a cycle have contributed successfully.
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

  const memberCount = cycle.group.members.length;
  const successfulContributions = cycle.contributions.filter(
    (c) => c.status === ContributionStatus.SUCCESS
  );

  if (successfulContributions.length >= memberCount) {
    const total = successfulContributions.reduce(
      (sum, c) => sum + Number(c.amount),
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

  const memberCount = group.members.length;
  const nextCycleNumber = completedCycleNumber + 1;

  // If everyone has received their payout, the group completes
  if (nextCycleNumber > memberCount) {
    await prisma.susuGroup.update({
      where: { id: groupId },
      data: { status: "COMPLETED", currentCycle: nextCycleNumber },
    });
    return null;
  }

  const nextPosition = getRecipientPosition(nextCycleNumber, memberCount);
  const nextRecipient = group.members.find((m) => m.payoutPosition === nextPosition);
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
