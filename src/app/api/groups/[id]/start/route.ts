import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/session";
import { bootstrapFirstCycle } from "@/lib/susu";

const StartGroupSchema = z.object({
  payoutDate: z.string().date("payoutDate must be a valid ISO date string"),
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

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: groupId } = await context.params;
    const body = await req.json();
    const parsed = StartGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const group = await prisma.susuGroup.findFirst({
      where: {
        id: groupId,
        treasurerId: userId,
      },
      select: {
        id: true,
        status: true,
        members: {
          select: {
            userId: true,
            payoutPosition: true,
            user: {
              select: {
                name: true,
                payoutAccountStatus: true,
              },
            },
          },
        },
        cycles: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Only the group treasurer can start the group" },
        { status: 403 }
      );
    }

    if (group.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Only active groups can be started" },
        { status: 409 }
      );
    }

    if (group.cycles.length > 0) {
      return NextResponse.json(
        { error: "This group has already been started" },
        { status: 409 }
      );
    }

    if (group.members.length < 2) {
      return NextResponse.json(
        { error: "At least 2 members are required before starting the first cycle" },
        { status: 409 }
      );
    }

    if (group.members.some((member) => member.payoutPosition === null)) {
      return NextResponse.json(
        { error: "All members must have a payout position before starting the group" },
        { status: 409 }
      );
    }

    const unverifiedMember = group.members.find(
      (member) => member.user.payoutAccountStatus !== "VERIFIED"
    );

    if (unverifiedMember) {
      return NextResponse.json(
        {
          error: `${unverifiedMember.user.name} still needs to verify a payout account before this group can start.`,
        },
        { status: 409 }
      );
    }

    const cycle = await bootstrapFirstCycle(
      groupId,
      new Date(`${parsed.data.payoutDate}T00:00:00.000Z`)
    );

    return NextResponse.json(
      {
        ...cycle,
        payoutDate: cycle.payoutDate.toISOString(),
        totalCollected: Number(cycle.totalCollected),
        createdAt: cycle.createdAt.toISOString(),
        updatedAt: cycle.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Group has no members with payout positions"
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return handleRouteError(error);
  }
}
