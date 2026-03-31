const PAYOUT_ACCOUNT_COOLDOWN_DAYS = 7;

export type PayoutAccountLike = {
  momoNumber?: string | null;
  momoNetwork?: string | null;
  payoutAccountStatus?: string | null;
  payoutAccountChangeLockedUntil?: Date | string | null;
};

export function addPayoutAccountCooldown(baseDate: Date) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + PAYOUT_ACCOUNT_COOLDOWN_DAYS);
  return next;
}

export function isPayoutAccountReady(account: PayoutAccountLike) {
  return (
    account.payoutAccountStatus === "VERIFIED" &&
    typeof account.momoNumber === "string" &&
    account.momoNumber.length > 0 &&
    typeof account.momoNetwork === "string" &&
    account.momoNetwork.length > 0
  );
}

export function getPayoutAccountLockDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isPayoutAccountChangeLocked(value: Date | string | null | undefined) {
  const lockDate = getPayoutAccountLockDate(value);
  return lockDate ? lockDate.getTime() > Date.now() : false;
}

export function getPayoutAccountCooldownDaysRemaining(
  value: Date | string | null | undefined
) {
  const lockDate = getPayoutAccountLockDate(value);

  if (!lockDate) {
    return 0;
  }

  const remainingMs = lockDate.getTime() - Date.now();
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
}

export { PAYOUT_ACCOUNT_COOLDOWN_DAYS };
