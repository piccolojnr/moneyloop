import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/session";
import { sendGroupInvite } from "@/emails";

const CreateInviteSchema = z.object({
  email: z.string().email("Enter a valid email address").optional(),
});

function handleRouteError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function getSessionUser() {
  const session = await getRequiredSession();
  const user = session.user as { id?: string; name?: string; email?: string };

  if (!user.id) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return user;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    const { id: groupId } = await context.params;
    const body = await req.json();
    const parsed = CreateInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const group = await prisma.susuGroup.findFirst({
      where: {
        id: groupId,
        treasurerId: user.id,
      },
      select: {
        id: true,
        name: true,
        frequency: true,
        contributionAmount: true,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Only the group treasurer can create invitations" },
        { status: 403 }
      );
    }

    const invitation = await prisma.invitation.create({
      data: {
        groupId,
        email: parsed.data.email?.toLowerCase(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: {
        token: true,
        email: true,
      },
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join?token=${invitation.token}`;

    if (invitation.email) {
      try {
        await sendGroupInvite({
          to: invitation.email,
          inviterName: user.name ?? "A MoneyLoop treasurer",
          groupName: group.name,
          contributionAmount: Number(group.contributionAmount),
          frequency: group.frequency,
          inviteUrl,
        });
      } catch (emailError) {
        console.error("Failed to send invite email:", emailError);
      }
    }

    return NextResponse.json({ inviteUrl });
  } catch (error) {
    return handleRouteError(error);
  }
}
