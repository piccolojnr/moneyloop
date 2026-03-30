import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
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
    return NextResponse.json(
      { error: "No active group membership found" },
      { status: 404 }
    );
  }

  const activeCycle = membership.group.cycles[0];

  if (!activeCycle) {
    return NextResponse.json(
      { error: "No active cycle found for this group" },
      { status: 404 }
    );
  }

  const memberCount = membership.group.members.length;
  const recipient = membership.group.members.find(
    (member) => member.userId === activeCycle.recipientId
  );
  const myContribution = activeCycle.contributions.find(
    (contribution) => contribution.userId === userId
  );
  const paidCount = activeCycle.contributions.filter(
    (contribution) => contribution.status === "SUCCESS"
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
    member: {
      id: membership.user.id,
      name: membership.user.name,
    },
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
      paidCount,
    },
    myContribution: {
      status: myContribution?.status ?? null,
    },
    myPayout: {
      daysUntilTurn: daysUntilMyPayout,
      cyclesUntilTurn: cyclesUntilPayoutTurn,
      expectedPayoutDate: expectedPayoutDate.toISOString(),
    },
    totalCyclesRemaining: Math.max(memberCount - activeCycle.cycleNumber, 0),
  });
}
