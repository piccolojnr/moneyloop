// Paystack API utilities
// Docs: https://paystack.com/docs/api/

const PAYSTACK_BASE = "https://api.paystack.co";
const SECRET = process.env.PAYSTACK_SECRET_KEY!;

function headers() {
  return {
    Authorization: `Bearer ${SECRET}`,
    "Content-Type": "application/json",
  };
}

// ─── Charge (collecting contributions) ──────────────────────────────────────

/**
 * Initialize a Paystack transaction.
 * Returns the authorization_url to redirect the member to.
 */
export async function initializeTransaction({
  email,
  amountGHS,
  reference,
  callbackUrl,
  metadata,
}: {
  email: string;
  amountGHS: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email,
      amount: Math.round(amountGHS * 100), // Paystack uses pesewas
      reference,
      callback_url: callbackUrl,
      currency: "GHS",
      metadata,
    }),
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message);
  return data.data as { authorization_url: string; access_code: string; reference: string };
}

/**
 * Verify a transaction by reference.
 * Call this inside the Paystack webhook handler.
 */
export async function verifyTransaction(reference: string) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message);
  return data.data as {
    status: "success" | "failed" | "abandoned";
    amount: number; // in pesewas
    reference: string;
    metadata: Record<string, unknown>;
  };
}

// ─── Transfers (paying out to MoMo) ────────────────────────────────────────

/**
 * Create a transfer recipient from a mobile money number.
 * Store the returned recipient_code on the User model for reuse.
 */
export async function createTransferRecipient({
  name,
  momoNumber,
  momoNetwork,
}: {
  name: string;
  momoNumber: string;
  momoNetwork: "MTN" | "VodafoneCash" | "AirtelTigo";
}) {
  const bankCodeMap = {
    MTN: "MTN",
    VodafoneCash: "VOD",
    AirtelTigo: "ATL",
  };

  const res = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      type: "mobile_money",
      name,
      account_number: momoNumber,
      bank_code: bankCodeMap[momoNetwork],
      currency: "GHS",
    }),
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message);
  return data.data as { recipient_code: string; id: number };
}

/**
 * Initiate a transfer to a recipient.
 * Use the recipient_code from createTransferRecipient.
 */
export async function initiateTransfer({
  amountGHS,
  recipientCode,
  reference,
  reason,
}: {
  amountGHS: number;
  recipientCode: string;
  reference: string;
  reason: string;
}) {
  const res = await fetch(`${PAYSTACK_BASE}/transfer`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      source: "balance",
      amount: Math.round(amountGHS * 100),
      recipient: recipientCode,
      reference,
      reason,
      currency: "GHS",
    }),
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message);
  return data.data as {
    transfer_code: string;
    status: "pending" | "success" | "failed";
  };
}

// ─── Webhook signature verification ────────────────────────────────────────

import crypto from "crypto";

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET!)
    .update(payload)
    .digest("hex");
  return hash === signature;
}
