import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/session";

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

async function getSessionUserId() {
  const session = await getRequiredSession();
  const userId = (session.user as { id?: string }).id;
  const role = (session.user as { role?: string }).role;

  if (!userId) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { userId, role };
}

export async function GET() {
  try {
    const { userId, role } = await getSessionUserId();

    const groups = await prisma.susuGroup.findMany({
      where:
        role === "ADMIN"
          ? undefined
          : {
              OR: [{ treasurerId: userId }, { members: { some: { userId } } }],
            },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        treasurerId: true,
        contributionAmount: true,
        frequency: true,
        currentCycle: true,
        status: true,
        createdAt: true,
        treasurer: {
          select: {
            name: true,
          },
        },
        members: {
          select: {
            id: true,
            userId: true,
            memberRole: true,
          },
        },
        cycles: {
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
      groups.map((group) => {
        const membership = group.members.find((member) => member.userId === userId);

        return {
          id: group.id,
          name: group.name,
          contributionAmount: Number(group.contributionAmount),
          frequency: group.frequency,
          currentCycle: group.currentCycle,
          status: group.status,
          createdAt: group.createdAt.toISOString(),
          memberCount: group.members.length,
          treasurerName: group.treasurer.name,
          memberRole:
            group.treasurerId === userId
              ? "TREASURER"
              : membership?.memberRole ?? null,
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
        };
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await getSessionUserId();

    const body = await req.json();
    const parsed = CreateGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const group = await prisma.susuGroup.create({
      data: {
        ...parsed.data,
        treasurerId: userId,
        members: {
          create: {
            userId,
            memberRole: "TREASURER",
            payoutPosition: null,
          },
        },
      },
      select: {
        id: true,
        name: true,
        contributionAmount: true,
        frequency: true,
        currentCycle: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        treasurer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: group.id,
        name: group.name,
        contributionAmount: Number(group.contributionAmount),
        frequency: group.frequency,
        currentCycle: group.currentCycle,
        status: group.status,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
        treasurer: group.treasurer,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
