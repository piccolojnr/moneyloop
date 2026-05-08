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
import { z } from "zod";

const ContributionInitSchema = z.object({
  groupId: z.string().uuid("groupId must be a valid UUID"),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId =
    typeof session?.user === "object" && session?.user && "id" in session.user
      ? (session.user.id as string | undefined)
      : undefined;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`contribute:${userId}`, 10, 60 * 1000);
  if (!rl.allowed) return rateLimitExceededResponse(rl.resetAt);

  const parsedBody = await req
    .json()
    .then((body) => ContributionInitSchema.safeParse(body))
    .catch(() => null);
  if (!parsedBody || !parsedBody.success) {
    return NextResponse.json(
      { error: "groupId is required and must be a valid UUID" },
      { status: 400 }
    );
  }
  const { groupId } = parsedBody.data;

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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      payoutAccountStatus: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.payoutAccountStatus !== "VERIFIED") {
    return NextResponse.json(
      { error: "Verify your payout account before contributing." },
      { status: 409 }
    );
  }

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
