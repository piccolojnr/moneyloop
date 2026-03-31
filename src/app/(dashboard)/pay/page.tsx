"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, CreditCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────

type GroupDashboard = {
  group: {
    groupId: string;
    groupName: string;
    payoutPosition: number | null;
    memberCount: number;
    contributionAmount: number;
  };
  activeCycle: {
    cycleId: string;
    cycleNumber: number;
    payoutDate: string;
    status: "PENDING" | "READY" | "PAID" | "FAILED";
    recipientName: string;
  } | null;
  myContribution: { status: "PENDING" | "SUCCESS" | "EXEMPT" | null };
};

type DashboardResponse = {
  member: { id: string; name: string };
  groups: GroupDashboard[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPending(entry: GroupDashboard) {
  const s = entry.myContribution.status;
  return (
    entry.activeCycle !== null &&
    entry.activeCycle.status === "PENDING" &&
    (s === "PENDING" || s === null)
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(amount: number) {
  return `GH₵ ${amount.toFixed(2)}`;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchDashboard() {
  const res = await fetch("/api/dashboard", { credentials: "include" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to load payment context");
  }
  return (await res.json()) as DashboardResponse;
}

async function initiatePayment(groupId: string) {
  const res = await fetch("/api/contributions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId }),
  });
  const body = (await res.json().catch(() => null)) as
    | { authorizationUrl?: string; error?: string }
    | null;
  return { ok: res.ok, status: res.status, body };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PayPageSkeleton() {
  return (
    <div className="max-w-lg space-y-4">
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {[0, 1].map((i) => (
        <Card key={i} className="p-5">
          <Skeleton className="mb-3 h-5 w-40" />
          <Skeleton className="mb-4 h-4 w-56" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </Card>
      ))}
    </div>
  );
}

// ── Single payment card ───────────────────────────────────────────────────────

function PaymentCard({
  entry,
  processing,
  onPay,
  errorMessage,
}: {
  entry: GroupDashboard;
  processing: boolean;
  onPay: (groupId: string) => void;
  errorMessage: string | null;
}) {
  const { group, activeCycle } = entry;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold">{group.groupName}</p>
          {activeCycle && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cycle #{activeCycle.cycleNumber} · Payout{" "}
              {formatDate(activeCycle.payoutDate)} · Recipient:{" "}
              {activeCycle.recipientName}
            </p>
          )}
        </div>
        <p className="shrink-0 text-lg font-bold text-primary">
          {formatCurrency(group.contributionAmount)}
        </p>
      </div>

      {errorMessage && (
        <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <Button
        className="w-full"
        disabled={processing}
        onClick={() => onPay(group.groupId)}
      >
        {processing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting to Paystack…
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay {formatCurrency(group.contributionAmount)}
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>

      {processing && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          You'll be redirected to Paystack to complete payment.
        </p>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PayPage() {
  const autoStartedRef = useRef(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slowNotice, setSlowNotice] = useState(false);

  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboard,
  });

  const pendingGroups = data?.groups.filter(isPending) ?? [];

  // Auto-redirect when there is exactly one pending group — same UX as before.
  const shouldAutoStart =
    !!data && pendingGroups.length === 1 && !autoStartedRef.current;

  async function pay(groupId: string) {
    setProcessingId(groupId);
    setErrors((prev) => ({ ...prev, [groupId]: "" }));

    const timer = setTimeout(() => setSlowNotice(true), 5_000);

    try {
      const { ok, status, body } = await initiatePayment(groupId);
      clearTimeout(timer);
      setSlowNotice(false);

      if (ok && body?.authorizationUrl) {
        window.location.href = body.authorizationUrl;
        return; // stay in loading state until navigation
      }

      setProcessingId(null);

      const msg =
        status === 409
          ? (body?.error ?? "You have already paid this cycle.")
          : status === 404
            ? (body?.error ?? "No active cycle found.")
            : (body?.error ?? "Unable to start payment. Please try again.");

      setErrors((prev) => ({ ...prev, [groupId]: msg }));
    } catch (err) {
      clearTimeout(timer);
      setSlowNotice(false);
      setProcessingId(null);
      setErrors((prev) => ({
        ...prev,
        [groupId]:
          err instanceof Error ? err.message : "Unable to start payment.",
      }));
    }
  }

  // Auto-start for single-pending-group case
  useEffect(() => {
    if (!shouldAutoStart) return;
    autoStartedRef.current = true;
    void pay(pendingGroups[0].group.groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoStart]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) return <PayPageSkeleton />;

  if (error || !data) {
    return (
      <Card className="max-w-lg border-destructive/20 p-6">
        <p className="font-semibold text-destructive">Unable to prepare payment</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {(error as Error | undefined)?.message ??
            "We could not load your current contribution details."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? "Retrying…" : "Try again"}
        </Button>
      </Card>
    );
  }

  // ── All caught up ────────────────────────────────────────────────────────

  if (pendingGroups.length === 0) {
    return (
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pay</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contribute to your active cycles.
          </p>
        </div>
        <Card className="p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <h2 className="mt-4 text-base font-semibold">
            You're all caught up
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No contributions are due right now. Check back when your next cycle
            starts.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-5">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // ── Single group auto-redirect ────────────────────────────────────────────

  if (pendingGroups.length === 1) {
    const entry = pendingGroups[0];
    const groupId = entry.group.groupId;
    const isProcessing = processingId === groupId;
    const err = errors[groupId] ?? null;

    return (
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pay</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isProcessing
              ? "Connecting you to Paystack…"
              : "Review your contribution and proceed to payment."}
          </p>
        </div>

        <PaymentCard
          entry={entry}
          processing={isProcessing}
          onPay={pay}
          errorMessage={err}
        />

        {isProcessing && slowNotice && (
          <p className="text-center text-sm text-amber-700">
            This is taking longer than usual…
          </p>
        )}

        {!isProcessing && (
          <Button asChild variant="ghost" size="sm" className="w-full text-muted-foreground">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        )}
      </div>
    );
  }

  // ── Multiple pending groups — let user choose ─────────────────────────────

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pay</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You have contributions due in {pendingGroups.length} groups.
        </p>
      </div>

      <div className="space-y-3">
        {pendingGroups.map((entry) => (
          <PaymentCard
            key={entry.group.groupId}
            entry={entry}
            processing={processingId === entry.group.groupId}
            onPay={pay}
            errorMessage={errors[entry.group.groupId] ?? null}
          />
        ))}
      </div>

      {slowNotice && processingId && (
        <p className="text-center text-sm text-amber-700">
          This is taking longer than usual…
        </p>
      )}

      <Button asChild variant="ghost" size="sm" className="w-full text-muted-foreground">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
