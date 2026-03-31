import { z } from "zod";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createTransferRecipient } from "@/lib/paystack";
import {
  addPayoutAccountCooldown,
  getPayoutAccountCooldownDaysRemaining,
  isPayoutAccountChangeLocked,
  isPayoutAccountReady,
} from "@/lib/payout-account";
import { getRequiredSession } from "@/lib/session";

const VerifyPayoutAccountSchema = z.object({
  momoNumber: z.string().min(10, "Enter a valid mobile money number"),
  momoNetwork: z.enum(["MTN", "VodafoneCash", "AirtelTigo"]),
});

export async function POST(req: Request) {
  const session = await getRequiredSession();
  const userId = (session.user as { id?: string }).id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = VerifyPayoutAccountSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      momoNumber: true,
      momoNetwork: true,
      payoutAccountStatus: true,
      payoutAccountChangeLockedUntil: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { momoNumber, momoNetwork } = parsed.data;
  const isChange =
    user.payoutAccountStatus === "VERIFIED" &&
    (user.momoNumber !== momoNumber || user.momoNetwork !== momoNetwork);

  if (isChange && isPayoutAccountChangeLocked(user.payoutAccountChangeLockedUntil)) {
    return NextResponse.json(
      {
        error: `You can update your payout account again in ${getPayoutAccountCooldownDaysRemaining(
          user.payoutAccountChangeLockedUntil
        )} day(s).`,
      },
      { status: 409 }
    );
  }

  if (
    user.payoutAccountStatus === "VERIFIED" &&
    user.momoNumber === momoNumber &&
    user.momoNetwork === momoNetwork
  ) {
    return NextResponse.json({
      payoutAccount: {
        status: "VERIFIED",
        ready: isPayoutAccountReady(user),
        momoNumber,
        momoNetwork,
        verifiedAt: new Date().toISOString(),
        verificationError: null,
      },
    });
  }

  try {
    const recipient = await createTransferRecipient({
      name: user.name,
      momoNumber,
      momoNetwork,
    });
    const now = new Date();
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        momoNumber,
        momoNetwork,
        paystackRecipientCode: recipient.recipient_code,
        payoutAccountStatus: "VERIFIED",
        payoutAccountVerifiedAt: now,
        payoutAccountLastUpdatedAt: now,
        payoutAccountChangeLockedUntil: addPayoutAccountCooldown(now),
        payoutAccountVerificationError: null,
        pendingMomoNumber: null,
        pendingMomoNetwork: null,
      },
      select: {
        momoNumber: true,
        momoNetwork: true,
        payoutAccountStatus: true,
        payoutAccountVerifiedAt: true,
        payoutAccountChangeLockedUntil: true,
      },
    });

    return NextResponse.json({
      payoutAccount: {
        status: updatedUser.payoutAccountStatus,
        ready: isPayoutAccountReady(updatedUser),
        momoNumber: updatedUser.momoNumber,
        momoNetwork: updatedUser.momoNetwork,
        verifiedAt: updatedUser.payoutAccountVerifiedAt?.toISOString() ?? null,
        changeLockedUntil:
          updatedUser.payoutAccountChangeLockedUntil?.toISOString() ?? null,
        verificationError: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to verify this payout account right now.";

    await prisma.user.update({
      where: { id: userId },
      data: {
        payoutAccountStatus:
          user.payoutAccountStatus === "VERIFIED"
            ? "VERIFIED"
            : "PENDING_VERIFICATION",
        payoutAccountVerificationError: message,
        pendingMomoNumber: momoNumber,
        pendingMomoNetwork: momoNetwork,
      },
    });

    return NextResponse.json(
      {
        error: message,
      },
      { status: 400 }
    );
  }
}
