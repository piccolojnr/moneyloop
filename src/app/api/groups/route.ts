import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const CreateGroupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  contributionAmount: z.coerce
    .number()
    .positive("Contribution amount must be greater than 0"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
});

function handleRouteError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET() {
  try {
    await requireAdmin();

    const groups = await prisma.susuGroup.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        contributionAmount: true,
        frequency: true,
        currentCycle: true,
        status: true,
        createdAt: true,
        members: {
          select: { id: true },
        },
        cycles: {
          where: {
            cycleNumber: {
              not: undefined,
            },
          },
          orderBy: { cycleNumber: "desc" },
          take: 1,
          select: {
            id: true,
            cycleNumber: true,
            payoutDate: true,
            status: true,
            totalCollected: true,
          },
        },
      },
    });

    return NextResponse.json(
      groups.map((group) => ({
        id: group.id,
        name: group.name,
        contributionAmount: Number(group.contributionAmount),
        frequency: group.frequency,
        currentCycle: group.currentCycle,
        status: group.status,
        createdAt: group.createdAt.toISOString(),
        memberCount: group.members.length,
        cycle:
          group.cycles[0] === undefined
            ? null
            : {
                id: group.cycles[0].id,
                cycleNumber: group.cycles[0].cycleNumber,
                payoutDate: group.cycles[0].payoutDate.toISOString(),
                status: group.cycles[0].status,
                totalCollected: Number(group.cycles[0].totalCollected),
              },
      }))
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const parsed = CreateGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const group = await prisma.susuGroup.create({
      data: parsed.data,
      select: {
        id: true,
        name: true,
        contributionAmount: true,
        frequency: true,
        currentCycle: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ...group,
        contributionAmount: Number(group.contributionAmount),
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
