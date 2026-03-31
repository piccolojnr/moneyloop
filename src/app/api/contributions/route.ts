// POST /api/contributions/initialize
// Member hits this to start paying their contribution for the current cycle.
// Returns a Paystack checkout URL.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initializeTransaction } from "@/lib/paystack";
import { getActiveCycle } from "@/lib/susu";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`contribute:${session.user.id}`, 10, 60 * 1000);
  if (!rl.allowed) return rateLimitExceededResponse(rl.resetAt);

  const { groupId } = await req.json();
  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  const userId = session.user.id;

  // Find the active cycle for this group
  const cycle = await getActiveCycle(groupId);
  if (!cycle) {
    return NextResponse.json({ error: "No active cycle found" }, { status: 404 });
  }

  if (cycle.status !== "PENDING") {
    return NextResponse.json({ error: "Cycle is not accepting contributions" }, { status: 400 });
  }

  // Check member is in this group
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
  }

  if (cycle.recipientId === userId) {
    return NextResponse.json(
      { error: "You do not contribute during your payout cycle." },
      { status: 409 }
    );
  }

  // Check if member already paid this cycle
  const existing = await prisma.contribution.findUnique({
    where: { userId_cycleId: { userId, cycleId: cycle.id } },
  });
  if (existing?.status === "SUCCESS") {
    return NextResponse.json({ error: "You have already contributed this cycle" }, { status: 409 });
  }

  // Create or reuse the pending contribution record
  const contribution =
    existing ??
    (await prisma.contribution.create({
      data: {
        userId,
        cycleId: cycle.id,
        amount: cycle.group.contributionAmount,
        status: "PENDING",
      },
    }));

  // Initialize Paystack transaction
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const reference = `ml-contribution-${contribution.id}-${Date.now()}`;

  const transaction = await initializeTransaction({
    email: user.email,
    amountGHS: Number(cycle.group.contributionAmount),
    reference,
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success`,
    metadata: {
      contributionId: contribution.id,
      cycleId: cycle.id,
      userId,
      groupId,
    },
  });

  return NextResponse.json({
    authorizationUrl: transaction.authorization_url,
    reference: transaction.reference,
  });
}
