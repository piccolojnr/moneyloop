import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/session";
import {
  getPayoutAccountCooldownDaysRemaining,
  isPayoutAccountChangeLocked,
  isPayoutAccountReady,
} from "@/lib/payout-account";

export async function GET() {
  const session = await getRequiredSession();
  const userId = (session.user as { id?: string }).id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      momoNumber: true,
      momoNetwork: true,
      payoutAccountStatus: true,
      payoutAccountVerifiedAt: true,
      payoutAccountLastUpdatedAt: true,
      payoutAccountChangeLockedUntil: true,
      payoutAccountVerificationError: true,
      pendingMomoNumber: true,
      pendingMomoNetwork: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    payoutAccount: {
      status: user.payoutAccountStatus,
      ready: isPayoutAccountReady(user),
      momoNumber: user.momoNumber,
      momoNetwork: user.momoNetwork,
      verifiedAt: user.payoutAccountVerifiedAt?.toISOString() ?? null,
      lastUpdatedAt: user.payoutAccountLastUpdatedAt?.toISOString() ?? null,
      changeLockedUntil: user.payoutAccountChangeLockedUntil?.toISOString() ?? null,
      canEdit: !isPayoutAccountChangeLocked(user.payoutAccountChangeLockedUntil),
      cooldownDaysRemaining: getPayoutAccountCooldownDaysRemaining(
        user.payoutAccountChangeLockedUntil
      ),
      verificationError: user.payoutAccountVerificationError,
      pendingAccount:
        user.pendingMomoNumber && user.pendingMomoNetwork
          ? {
              momoNumber: user.pendingMomoNumber,
              momoNetwork: user.pendingMomoNetwork,
            }
          : null,
    },
  });
}
