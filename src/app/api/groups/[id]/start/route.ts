import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
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

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id: groupId } = await context.params;
    const body = await req.json();
    const parsed = StartGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const group = await prisma.susuGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        status: true,
        cycles: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
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
    if (error instanceof Error && error.message === "Group has no members") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return handleRouteError(error);
  }
}
