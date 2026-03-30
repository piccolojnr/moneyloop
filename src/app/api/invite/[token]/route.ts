import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

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

  if (invitation.usedAt) {
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
  });
}
