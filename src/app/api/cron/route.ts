// GET /api/cron/payout
// Called daily by Vercel Cron. Finds cycles due today and triggers payouts.
// Protected by CRON_SECRET header — set this in vercel.json and .env

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initiateTransfer, createTransferRecipient } from "@/lib/paystack";
import { advanceToNextCycle } from "@/lib/susu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Verify the cron secret so this can't be triggered externally
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find all cycles that are READY and due today
  const cyclesDue = await prisma.cycle.findMany({
    where: {
      status: "READY",
      payoutDate: { gte: today, lt: tomorrow },
    },
    include: {
      group: true,
      payout: true,
      contributions: true,
    },
  });

  const results = [];

  for (const cycle of cyclesDue) {
    try {
      // Skip if a payout record already exists (idempotency)
      if (cycle.payout) {
        results.push({ cycleId: cycle.id, skipped: true, reason: "Payout already exists" });
        continue;
      }

      // Get recipient's MoMo details
      const recipient = await prisma.user.findUniqueOrThrow({
        where: { id: cycle.recipientId },
      });

      // Create or reuse Paystack transfer recipient
      let recipientCode = recipient.momoNumber; // store code on user in production
      const transferRecipient = await createTransferRecipient({
        name: recipient.name,
        momoNumber: recipient.momoNumber,
        momoNetwork: recipient.momoNetwork as "MTN" | "VodafoneCash" | "AirtelTigo",
      });
      recipientCode = transferRecipient.recipient_code;

      // Create a pending Payout record first (for idempotency)
      const payout = await prisma.payout.create({
        data: {
          cycleId: cycle.id,
          recipientId: cycle.recipientId,
          amount: cycle.totalCollected,
          paystackRecipientId: recipientCode,
          status: "PENDING",
        },
      });

      // Trigger the transfer via Paystack
      const reference = `ml-payout-${cycle.id}`;
      const transfer = await initiateTransfer({
        amountGHS: Number(cycle.totalCollected),
        recipientCode,
        reference,
        reason: `MoneyLoop payout — ${cycle.group.name} cycle ${cycle.cycleNumber}`,
      });

      // Update payout record with transfer ID
      await prisma.payout.update({
        where: { id: payout.id },
        data: { paystackTransferId: transfer.transfer_code },
      });

      // Advance to next cycle (Paystack will confirm success via webhook)
      await advanceToNextCycle(cycle.groupId, cycle.cycleNumber);

      results.push({ cycleId: cycle.id, success: true, transferCode: transfer.transfer_code });
    } catch (err) {
      console.error(`Payout failed for cycle ${cycle.id}:`, err);
      results.push({ cycleId: cycle.id, success: false, error: String(err) });
    }
  }

  return NextResponse.json({
    processed: cyclesDue.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
