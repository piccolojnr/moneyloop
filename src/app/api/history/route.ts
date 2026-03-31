import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const contributionsPage = parsePositiveInt(
    searchParams.get("contributionsPage"),
    1
  );
  const contributionsPageSize = parsePositiveInt(
    searchParams.get("contributionsPageSize"),
    10
  );
  const payoutsPage = parsePositiveInt(searchParams.get("payoutsPage"), 1);
  const payoutsPageSize = parsePositiveInt(
    searchParams.get("payoutsPageSize"),
    6
  );

  const [contributions, payouts, contributionsTotal, payoutsTotal] = await Promise.all([
    prisma.contribution.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      skip: (contributionsPage - 1) * contributionsPageSize,
      take: contributionsPageSize,
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
      skip: (payoutsPage - 1) * payoutsPageSize,
      take: payoutsPageSize,
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
    prisma.contribution.count({ where: { userId } }),
    prisma.payout.count({ where: { recipientId: userId } }),
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
    pagination: {
      contributions: {
        page: contributionsPage,
        pageSize: contributionsPageSize,
        total: contributionsTotal,
        totalPages: Math.max(1, Math.ceil(contributionsTotal / contributionsPageSize)),
      },
      payouts: {
        page: payoutsPage,
        pageSize: payoutsPageSize,
        total: payoutsTotal,
        totalPages: Math.max(1, Math.ceil(payoutsTotal / payoutsPageSize)),
      },
    },
  });
}
