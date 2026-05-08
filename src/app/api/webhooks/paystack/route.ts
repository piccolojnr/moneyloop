// POST /api/webhooks/paystack
// Paystack sends events here for payment and transfer status updates.
// Add this URL in your Paystack dashboard → Settings → API Keys & Webhooks

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/paystack";
import { advanceToNextCycle, checkAndMarkCycleReady } from "@/lib/susu";
import { sendPayoutNotification } from "@/emails";
import { ContributionStatus, PayoutStatus } from "@/generated/prisma/client/enums";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  // 1. Verify the request genuinely came from Paystack
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  try {
    switch (event.event) {
      // ── Member successfully paid their contribution ──────────────────────
      case "charge.success": {
        const { reference, metadata } = event.data;
        const { contributionId, cycleId } = metadata ?? {};

        if (!contributionId) break;

        await prisma.contribution.update({
          where: { id: contributionId },
          data: {
            status: ContributionStatus.SUCCESS,
            paystackRef: reference,
            paidAt: new Date(),
          },
        });

        // Update the running total on the cycle
        const contribution = await prisma.contribution.findUnique({
          where: { id: contributionId },
        });
        if (contribution && cycleId) {
          await prisma.cycle.update({
            where: { id: cycleId },
            data: { totalCollected: { increment: contribution.amount } },
          });
          // Check if all members have now paid
          await checkAndMarkCycleReady(cycleId);
        }
        break;
      }

      // ── Payout transfer succeeded ────────────────────────────────────────
      case "transfer.success": {
        const { transfer_code } = event.data;

        const payout = await prisma.payout.findFirst({
          where: { paystackTransferId: transfer_code },
          include: {
            recipient: {
              select: {
                email: true,
                name: true,
              },
            },
            cycle: {
              select: {
                cycleNumber: true,
                groupId: true,
                group: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });
        if (!payout) break;

        const now = new Date();
        const [payoutUpdateResult, cycleUpdateResult] = await prisma.$transaction([
          prisma.payout.updateMany({
            where: { id: payout.id, status: PayoutStatus.PENDING },
            data: { status: PayoutStatus.SUCCESS, sentAt: now, failureReason: null },
          }),
          prisma.cycle.updateMany({
            where: { id: payout.cycleId, status: "READY" },
            data: { status: "PAID" },
          }),
        ]);

        // Ignore duplicate webhook deliveries once the payout/cycle has been finalized.
        if (payoutUpdateResult.count === 0 && cycleUpdateResult.count === 0) {
          break;
        }

        await advanceToNextCycle(payout.cycle.groupId, payout.cycle.cycleNumber);

        try {
          await sendPayoutNotification({
            to: payout.recipient.email,
            name: payout.recipient.name,
            groupName: payout.cycle.group.name,
            amount: Number(payout.amount),
            cycleNumber: payout.cycle.cycleNumber,
          });
        } catch (emailError) {
          console.error("Failed to send payout email:", emailError);
        }

        break;
      }

      // ── Payout transfer failed ───────────────────────────────────────────
      case "transfer.failed":
      case "transfer.reversed": {
        const { transfer_code, reason } = event.data;

        const payout = await prisma.payout.findFirst({
          where: { paystackTransferId: transfer_code },
        });
        if (!payout) break;

        await prisma.$transaction([
          prisma.payout.update({
            where: { id: payout.id },
            data: {
              status: PayoutStatus.FAILED,
              failureReason: reason ?? event.event,
            },
          }),
          prisma.cycle.update({
            where: { id: payout.cycleId },
            data: { status: "FAILED" },
          }),
        ]);
        break;
      }

      default:
        // Unhandled event — that's fine, just acknowledge
        break;
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    // Return 200 anyway so Paystack doesn't retry endlessly
    // Log the error separately for investigation
  }

  // Always return 200 — Paystack will retry non-200 responses
  return NextResponse.json({ received: true });
}
