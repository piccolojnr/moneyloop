import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return email;
  return `${email.charAt(0)}***${email.slice(atIndex)}`;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      group: {
        select: {
          name: true,
          contributionAmount: true,
          frequency: true,
          treasurer: {
            select: {
              name: true,
            },
          },
          members: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!invitation) {
    return NextResponse.json({ valid: false, reason: "not_found" });
  }

  // Only email-targeted invites are single-use; open invites stay valid indefinitely
  if (invitation.email && invitation.usedAt) {
    return NextResponse.json({ valid: false, reason: "already_used" });
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ valid: false, reason: "expired" });
  }

  return NextResponse.json({
    valid: true,
    groupName: invitation.group.name,
    treasurerName: invitation.group.treasurer.name,
    contributionAmount: Number(invitation.group.contributionAmount),
    frequency: invitation.group.frequency,
    memberCount: invitation.group.members.length,
    requiresEmail: invitation.email !== null,
    targetEmailMasked: invitation.email ? maskEmail(invitation.email) : null,
  });
}
