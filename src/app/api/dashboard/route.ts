import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEligibleContributorIds, getPositionedMembers } from "@/lib/susu";

function addIntervals(baseDate: Date, count: number, frequency: string) {
  const nextDate = new Date(baseDate);

  switch (frequency) {
    case "DAILY":
      nextDate.setDate(nextDate.getDate() + count);
      break;
    case "WEEKLY":
      nextDate.setDate(nextDate.getDate() + count * 7);
      break;
    case "MONTHLY":
      nextDate.setMonth(nextDate.getMonth() + count);
      break;
  }

  return nextDate;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string } | undefined;
  const userId = user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.groupMember.findFirst({
    where: {
      userId,
      group: { status: "ACTIVE" },
    },
    orderBy: { joinedAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      group: {
        select: {
          id: true,
          name: true,
          frequency: true,
          currentCycle: true,
          contributionAmount: true,
          members: {
            orderBy: { payoutPosition: "asc" },
            select: {
              payoutPosition: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          cycles: {
            where: {
              status: { in: ["PENDING", "READY"] },
            },
            orderBy: { cycleNumber: "asc" },
            take: 1,
            select: {
              id: true,
              cycleNumber: true,
              payoutDate: true,
              status: true,
              totalCollected: true,
              recipientId: true,
              contributions: {
                select: {
                  userId: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) {
    return NextResponse.json({
      member: currentUser,
      group: null,
      activeCycle: null,
      myContribution: {
        status: null,
      },
      myPayout: null,
      totalCyclesRemaining: 0,
    });
  }

  const activeCycle = membership.group.cycles[0];

  if (!activeCycle) {
    return NextResponse.json({
      member: currentUser,
      group: {
        groupId: membership.group.id,
        groupName: membership.group.name,
        payoutPosition: membership.payoutPosition,
        memberCount: membership.group.members.length,
        contributionAmount: Number(membership.group.contributionAmount),
      },
      activeCycle: null,
      myContribution: {
        status: null,
      },
      myPayout: null,
      totalCyclesRemaining: 0,
    });
  }

  const positionedMembers = getPositionedMembers(membership.group.members);
  const memberCount = positionedMembers.length;
  const recipient = membership.group.members.find(
    (member) => member.userId === activeCycle.recipientId
  );
  const eligibleContributorIds = getEligibleContributorIds(
    membership.group.members,
    activeCycle.recipientId
  );
  const isCurrentRecipient = activeCycle.recipientId === userId;
  const myContribution = activeCycle.contributions.find(
    (contribution) => contribution.userId === userId
  );
  const paidCount = activeCycle.contributions.filter(
    (contribution) =>
      contribution.status === "SUCCESS" &&
      eligibleContributorIds.includes(contribution.userId)
  ).length;

  const cyclesUntilPayoutTurn = Math.max(
    membership.payoutPosition - activeCycle.cycleNumber,
    0
  );
  const expectedPayoutDate = addIntervals(
    activeCycle.payoutDate,
    cyclesUntilPayoutTurn,
    membership.group.frequency
  );
  const daysUntilMyPayout = Math.max(
    Math.ceil(
      (expectedPayoutDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ),
    0
  );

  return NextResponse.json({
    member: currentUser,
    group: {
      groupId: membership.group.id,
      groupName: membership.group.name,
      payoutPosition: membership.payoutPosition,
      memberCount,
      contributionAmount: Number(membership.group.contributionAmount),
    },
    activeCycle: {
      cycleId: activeCycle.id,
      cycleNumber: activeCycle.cycleNumber,
      payoutDate: activeCycle.payoutDate.toISOString(),
      status: activeCycle.status,
      totalCollected: Number(activeCycle.totalCollected),
      recipientName: recipient?.user.name ?? "Unknown recipient",
      recipientId: activeCycle.recipientId,
      requiredContributorCount: eligibleContributorIds.length,
      paidCount,
    },
    myContribution: {
      status: isCurrentRecipient ? "EXEMPT" : myContribution?.status ?? null,
    },
    myPayout: {
      daysUntilTurn: daysUntilMyPayout,
      cyclesUntilTurn: cyclesUntilPayoutTurn,
      expectedPayoutDate: expectedPayoutDate.toISOString(),
    },
    totalCyclesRemaining: Math.max(memberCount - activeCycle.cycleNumber, 0),
  });
}
