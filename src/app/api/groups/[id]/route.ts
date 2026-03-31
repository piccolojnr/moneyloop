import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/session";

function handleRouteError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function getSessionUserId() {
  const session = await getRequiredSession();
  const userId = (session.user as { id?: string }).id;
  const role = (session.user as { role?: string }).role;

  if (!userId) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { userId, role };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, role } = await getSessionUserId();
    const { id } = await context.params;

    const group = await prisma.susuGroup.findFirst({
      where: {
        id,
        ...(role === "ADMIN"
          ? {}
          : {
              OR: [{ treasurerId: userId }, { members: { some: { userId } } }],
            }),
      },
      include: {
        treasurer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          orderBy: [{ payoutPosition: "asc" }, { joinedAt: "asc" }],
          select: {
            id: true,
            payoutPosition: true,
            memberRole: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                momoNumber: true,
                payoutAccountStatus: true,
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
            contributions: {
              select: {
                id: true,
                userId: true,
                amount: true,
                status: true,
                paidAt: true,
              },
            },
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
      treasurerId: group.treasurerId,
      contributionAmount: Number(group.contributionAmount),
      frequency: group.frequency,
      currentCycle: group.currentCycle,
      status: group.status,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      treasurer: {
        id: group.treasurer.id,
        name: group.treasurer.name,
        email: group.treasurer.email,
      },
      members: group.members.map((member) => ({
        id: member.id,
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        phone: member.user.phone,
        momoNumber: member.user.momoNumber,
        payoutAccountStatus: member.user.payoutAccountStatus,
        payoutPosition: member.payoutPosition,
        memberRole: member.memberRole,
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
        contributions: cycle.contributions.map((contribution) => ({
          id: contribution.id,
          userId: contribution.userId,
          amount: Number(contribution.amount),
          status: contribution.status,
          paidAt: contribution.paidAt?.toISOString() ?? null,
        })),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
