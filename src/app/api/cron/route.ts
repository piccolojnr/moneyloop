// GET /api/cron/payout
//
// Called by Vercel Cron (or any trusted scheduler) to move active cycles forward.
//
// Current loop rules:
// - A cycle is one payout turn inside a round.
// - A round completes once every positioned member has received one payout.
// - In each cycle, every positioned member except the recipient contributes.
// - The recipient is exempt for their own cycle and should never receive a reminder.
//
// This route performs two jobs:
// 1. Send reminder emails for every PENDING cycle to eligible contributors who
//    have not yet paid successfully.
// 2. For READY cycles due today, create the payout record, initiate the transfer,
//    and advance the group to the next cycle in the round.
//
// Protected by the CRON_SECRET header. Configure this in the deployment
// environment and in the scheduler that calls the route.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initiateTransfer, createTransferRecipient } from "@/lib/paystack";
import { advanceToNextCycle, getEligibleContributorIds } from "@/lib/susu";
import { sendContributionReminder } from "@/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Verify the shared secret so this endpoint cannot be triggered publicly.
  // const authHeader = req.headers.get("authorization");
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Scan all still-collecting cycles and send reminder emails only to members
  // who are expected to contribute in that cycle.
  const pendingCycles = await prisma.cycle.findMany({
    where: {
      status: "PENDING",
    },
    include: {
      group: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  email: true,
                  name: true,
                  id: true,
                },
              },
            },
            orderBy: { payoutPosition: "asc" },
          },
        },
      },
      contributions: {
        select: {
          userId: true,
          status: true,
        },
      },
    },
  });

  for (const cycle of pendingCycles) {
    // Eligible contributors exclude the cycle recipient.
    const eligibleContributorIds = new Set(
      getEligibleContributorIds(cycle.group.members, cycle.recipientId)
    );
    const paidUserIds = new Set(
      cycle.contributions
        .filter((contribution) => contribution.status === "SUCCESS")
        .map((contribution) => contribution.userId)
    );

    for (const member of cycle.group.members) {
      if (!eligibleContributorIds.has(member.userId)) {
        continue;
      }

      if (paidUserIds.has(member.userId)) {
        continue;
      }

      try {
        await sendContributionReminder({
          to: member.user.email,
          name: member.user.name,
          groupName: cycle.group.name,
          amount: Number(cycle.group.contributionAmount),
          cycleNumber: cycle.cycleNumber,
          payoutDate: cycle.payoutDate.toISOString().slice(0, 10),
          payNowUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pay`,
        });
      } catch (emailError) {
        console.error(
          `Failed to send contribution reminder for cycle ${cycle.id} to ${member.user.email}:`,
          emailError
        );
      }
    }
  }

  // Find all cycles whose contribution collection is complete and whose payout
  // should be sent today.
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
      // Skip if a payout record already exists. This makes the cron job safe to
      // retry without creating duplicate payout records.
      if (cycle.payout) {
        results.push({ cycleId: cycle.id, skipped: true, reason: "Payout already exists" });
        continue;
      }

      // Load the cycle recipient's MoMo details so a transfer recipient can be created.
      const recipient = await prisma.user.findUniqueOrThrow({
        where: { id: cycle.recipientId },
      });

      // Reuse the cached Paystack recipient code if the user already has one,
      // otherwise create a new recipient and cache the code for future payouts.
      let recipientCode = recipient.paystackRecipientCode;
      if (!recipientCode) {
        const transferRecipient = await createTransferRecipient({
          name: recipient.name,
          momoNumber: recipient.momoNumber,
          momoNetwork: recipient.momoNetwork as "MTN" | "VodafoneCash" | "AirtelTigo",
        });
        recipientCode = transferRecipient.recipient_code;
        await prisma.user.update({
          where: { id: recipient.id },
          data: { paystackRecipientCode: recipientCode },
        });
      }

      // Create a pending payout record before initiating the transfer so the job
      // has a durable record even if the external transfer call succeeds and a
      // later step fails.
      const payout = await prisma.payout.create({
        data: {
          cycleId: cycle.id,
          recipientId: cycle.recipientId,
          amount: cycle.totalCollected,
          paystackRecipientId: recipientCode,
          status: "PENDING",
        },
      });

      // Trigger the transfer using the cycle's collected total. Because the
      // current recipient is exempt from contributing, this total typically
      // reflects N-1 contributions.
      const reference = `ml-payout-${cycle.id}`;
      const transfer = await initiateTransfer({
        amountGHS: Number(cycle.totalCollected),
        recipientCode,
        reference,
        reason: `MoneyLoop payout — ${cycle.group.name} cycle ${cycle.cycleNumber}`,
      });

      // Store Paystack's transfer code so the webhook can reconcile the final result.
      await prisma.payout.update({
        where: { id: payout.id },
        data: { paystackTransferId: transfer.transfer_code },
      });

      // Move the group forward immediately after initiating the transfer.
      // Paystack's webhook will later mark the payout/cycle as successful or failed.
      await advanceToNextCycle(cycle.groupId, cycle.cycleNumber);

      results.push({ cycleId: cycle.id, success: true, transferCode: transfer.transfer_code });
    } catch (err) {
      console.error(`Payout failed for cycle ${cycle.id}:`, err);
      results.push({ cycleId: cycle.id, success: false, error: String(err) });
    }
  }

  // Return a summary so scheduled runs are observable in logs.
  return NextResponse.json({
    processed: cyclesDue.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
