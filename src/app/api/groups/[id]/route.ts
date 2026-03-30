import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

function handleRouteError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await context.params;
    const group = await prisma.susuGroup.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: { payoutPosition: "asc" },
          select: {
            id: true,
            payoutPosition: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                momoNumber: true,
              },
            },
          },
        },
        cycles: {
          orderBy: { cycleNumber: "asc" },
          select: {
            id: true,
            cycleNumber: true,
            payoutDate: true,
            status: true,
            totalCollected: true,
            recipientId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: group.id,
      name: group.name,
      contributionAmount: Number(group.contributionAmount),
      frequency: group.frequency,
      currentCycle: group.currentCycle,
      status: group.status,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      members: group.members.map((member) => ({
        id: member.id,
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        phone: member.user.phone,
        momoNumber: member.user.momoNumber,
        payoutPosition: member.payoutPosition,
        joinedAt: member.joinedAt.toISOString(),
      })),
      cycles: group.cycles.map((cycle) => ({
        id: cycle.id,
        cycleNumber: cycle.cycleNumber,
        payoutDate: cycle.payoutDate.toISOString(),
        status: cycle.status,
        totalCollected: Number(cycle.totalCollected),
        recipientId: cycle.recipientId,
        createdAt: cycle.createdAt.toISOString(),
        updatedAt: cycle.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
