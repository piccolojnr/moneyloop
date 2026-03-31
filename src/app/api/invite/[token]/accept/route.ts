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

export async function POST(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const session = await getRequiredSession();
    const user = session.user as { id?: string; email?: string };
    const { token } = await context.params;

    if (!user.id || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        group: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.usedAt) {
      return NextResponse.json(
        { error: "This invitation has already been used" },
        { status: 409 }
      );
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 410 }
      );
    }

    if (
      invitation.email &&
      invitation.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email address" },
        { status: 403 }
      );
    }

    const existingMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: invitation.group.id,
          userId: user.id,
        },
      },
      select: { id: true },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "You are already a member of this group." },
        { status: 409 }
      );
    }

    const memberCreate = prisma.groupMember.create({
      data: {
        groupId: invitation.group.id,
        userId: user.id,
        memberRole: "MEMBER",
        payoutPosition: null,
      },
    });

    if (invitation.email) {
      // Email-targeted invites are single-use
      await prisma.$transaction([
        memberCreate,
        prisma.invitation.update({
          where: { id: invitation.id },
          data: { usedAt: new Date() },
        }),
      ]);
    } else {
      // Open invites stay valid for future users
      await memberCreate;
    }

    return NextResponse.json({ groupId: invitation.group.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
