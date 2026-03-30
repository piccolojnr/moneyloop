import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [contributions, payouts] = await Promise.all([
    prisma.contribution.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
      select: {
        amount: true,
        status: true,
        paidAt: true,
        cycle: {
          select: {
            cycleNumber: true,
            group: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.payout.findMany({
      where: { recipientId: userId },
      orderBy: [{ createdAt: "desc" }],
      take: 5,
      select: {
        amount: true,
        status: true,
        sentAt: true,
        cycle: {
          select: {
            cycleNumber: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    contributions: contributions.map((contribution) => ({
      cycleNumber: contribution.cycle.cycleNumber,
      amount: Number(contribution.amount),
      status: contribution.status,
      paidAt: contribution.paidAt?.toISOString() ?? null,
      groupName: contribution.cycle.group.name,
    })),
    payouts: payouts.map((payout) => ({
      cycleNumber: payout.cycle.cycleNumber,
      amount: Number(payout.amount),
      status: payout.status,
      sentAt: payout.sentAt?.toISOString() ?? null,
    })),
  });
}
