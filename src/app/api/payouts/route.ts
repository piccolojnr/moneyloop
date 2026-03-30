import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

function handleRouteError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const pageParam = req.nextUrl.searchParams.get("page");
    const page = Math.max(Number(pageParam ?? "1") || 1, 1);
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const [total, payouts] = await Promise.all([
      prisma.payout.count(),
      prisma.payout.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          amount: true,
          status: true,
          sentAt: true,
          failureReason: true,
          createdAt: true,
          recipient: {
            select: {
              name: true,
            },
          },
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
    ]);

    return NextResponse.json({
      data: payouts.map((payout) => ({
        id: payout.id,
        cycleNumber: payout.cycle.cycleNumber,
        recipientName: payout.recipient.name,
        groupName: payout.cycle.group.name,
        amount: Number(payout.amount),
        status: payout.status,
        sentAt: payout.sentAt?.toISOString() ?? null,
        failureReason: payout.failureReason,
        createdAt: payout.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
