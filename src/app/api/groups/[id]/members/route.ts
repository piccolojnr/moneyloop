import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/session";

const AddMemberSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  payoutPosition: z.coerce
    .number()
    .int("payoutPosition must be an integer")
    .positive("payoutPosition must be greater than 0")
    .optional(),
});

const UpdatePositionsSchema = z.object({
  positions: z
    .array(
      z.object({
        userId: z.string().uuid("userId must be a valid UUID"),
        payoutPosition: z.coerce
          .number()
          .int("payoutPosition must be an integer")
          .positive("payoutPosition must be greater than 0"),
      })
    )
    .min(1, "Provide at least one member position"),
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

async function getSessionUserId() {
  const session = await getRequiredSession();
  const userId = (session.user as { id?: string }).id;

  if (!userId) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return userId;
}

async function getTreasurerGroup(groupId: string, userId: string) {
  return prisma.susuGroup.findFirst({
    where: {
      id: groupId,
      treasurerId: userId,
    },
    select: {
      id: true,
      treasurerId: true,
      cycles: {
        where: { status: { in: ["PENDING", "READY"] } },
        select: { id: true },
        take: 1,
      },
      members: {
        select: {
          id: true,
          userId: true,
          payoutPosition: true,
          memberRole: true,
        },
      },
    },
  });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: groupId } = await context.params;
    const body = await req.json();
    const parsed = AddMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const group = await getTreasurerGroup(groupId, userId);
    if (!group) {
      return NextResponse.json(
        { error: "Only the group treasurer can add members" },
        { status: 403 }
      );
    }

    const [existingUser, existingMembership, existingPosition] = await Promise.all([
      prisma.user.findUnique({
        where: { id: parsed.data.userId },
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
      parsed.data.payoutPosition === undefined
        ? Promise.resolve(null)
        : prisma.groupMember.findUnique({
            where: {
              groupId_payoutPosition: {
                groupId,
                payoutPosition: parsed.data.payoutPosition,
              },
            },
          }),
    ]);

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (existingMembership) {
      return NextResponse.json(
        { error: "That user is already a member of this group" },
        { status: 409 }
      );
    }

    if (existingPosition) {
      return NextResponse.json(
        { error: "That payout position is already assigned in this group" },
        { status: 409 }
      );
    }

    const membership = await prisma.groupMember.create({
      data: {
        groupId,
        userId: parsed.data.userId,
        payoutPosition: parsed.data.payoutPosition ?? null,
        memberRole: "MEMBER",
      },
      select: {
        id: true,
        groupId: true,
        userId: true,
        payoutPosition: true,
        memberRole: true,
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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: groupId } = await context.params;
    const body = await req.json();
    const parsed = UpdatePositionsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const group = await getTreasurerGroup(groupId, userId);
    if (!group) {
      return NextResponse.json(
        { error: "Only the group treasurer can update positions" },
        { status: 403 }
      );
    }

    const duplicatePayloadPositions = new Set<number>();
    for (const entry of parsed.data.positions) {
      if (duplicatePayloadPositions.has(entry.payoutPosition)) {
        return NextResponse.json(
          { error: "Payout positions must be unique" },
          { status: 409 }
        );
      }
      duplicatePayloadPositions.add(entry.payoutPosition);
    }

    const memberIds = new Set(group.members.map((member) => member.userId));
    const requestedIds = new Set(parsed.data.positions.map((entry) => entry.userId));

    if (requestedIds.size !== parsed.data.positions.length) {
      return NextResponse.json(
        { error: "Each member can only appear once in the positions payload" },
        { status: 400 }
      );
    }

    for (const entry of parsed.data.positions) {
      if (!memberIds.has(entry.userId)) {
        return NextResponse.json(
          { error: "All payout positions must reference existing group members" },
          { status: 404 }
        );
      }
    }

    const finalPositions = new Map<string, number | null>(
      group.members.map((member) => [member.userId, member.payoutPosition])
    );

    for (const entry of parsed.data.positions) {
      finalPositions.set(entry.userId, entry.payoutPosition);
    }

    const finalAssigned = Array.from(finalPositions.values()).filter(
      (value): value is number => value !== null
    );
    if (new Set(finalAssigned).size !== finalAssigned.length) {
      return NextResponse.json(
        { error: "Payout positions must be unique across the group" },
        { status: 409 }
      );
    }

    await prisma.$transaction(
      parsed.data.positions.map((entry) =>
        prisma.groupMember.update({
          where: {
            groupId_userId: {
              groupId,
              userId: entry.userId,
            },
          },
          data: { payoutPosition: entry.payoutPosition },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: groupId } = await context.params;
    const body = await req.json();
    const parsed = RemoveMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const group = await getTreasurerGroup(groupId, userId);
    if (!group) {
      return NextResponse.json(
        { error: "Only the group treasurer can remove members" },
        { status: 403 }
      );
    }

    if (parsed.data.userId === group.treasurerId) {
      return NextResponse.json(
        { error: "The group treasurer cannot be removed from the group" },
        { status: 409 }
      );
    }

    const membership = group.members.find(
      (member) => member.userId === parsed.data.userId
    );

    if (!membership) {
      return NextResponse.json(
        { error: "Member not found in this group" },
        { status: 404 }
      );
    }

    if (group.cycles.length > 0) {
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
