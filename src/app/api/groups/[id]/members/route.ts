import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const AddMemberSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  payoutPosition: z.coerce
    .number()
    .int("payoutPosition must be an integer")
    .positive("payoutPosition must be greater than 0"),
});

const RemoveMemberSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
});

function handleRouteError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id: groupId } = await context.params;
    const body = await req.json();
    const parsed = AddMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [group, user, existingPosition, existingMembership] = await Promise.all([
      prisma.susuGroup.findUnique({
        where: { id: groupId },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: parsed.data.userId },
        select: { id: true },
      }),
      prisma.groupMember.findUnique({
        where: {
          groupId_payoutPosition: {
            groupId,
            payoutPosition: parsed.data.payoutPosition,
          },
        },
      }),
      prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: parsed.data.userId,
          },
        },
      }),
    ]);

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (existingPosition) {
      return NextResponse.json(
        { error: "That payout position is already assigned in this group" },
        { status: 409 }
      );
    }

    if (existingMembership) {
      return NextResponse.json(
        { error: "That user is already a member of this group" },
        { status: 409 }
      );
    }

    const membership = await prisma.groupMember.create({
      data: {
        groupId,
        userId: parsed.data.userId,
        payoutPosition: parsed.data.payoutPosition,
      },
      select: {
        id: true,
        groupId: true,
        userId: true,
        payoutPosition: true,
        joinedAt: true,
      },
    });

    return NextResponse.json(
      {
        ...membership,
        joinedAt: membership.joinedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id: groupId } = await context.params;
    const body = await req.json();
    const parsed = RemoveMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [group, membership, activeCycle] = await Promise.all([
      prisma.susuGroup.findUnique({
        where: { id: groupId },
        select: { id: true },
      }),
      prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: parsed.data.userId,
          },
        },
      }),
      prisma.cycle.findFirst({
        where: {
          groupId,
          status: { in: ["PENDING", "READY"] },
        },
        select: { id: true },
      }),
    ]);

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!membership) {
      return NextResponse.json(
        { error: "Member not found in this group" },
        { status: 404 }
      );
    }

    if (activeCycle) {
      return NextResponse.json(
        { error: "Members can only be removed when the group has no active cycles" },
        { status: 409 }
      );
    }

    await prisma.groupMember.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
