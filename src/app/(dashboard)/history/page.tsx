"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────

type HistoryResponse = {
  contributions: Array<{
    cycleNumber: number;
    amount: number;
    status: "PENDING" | "SUCCESS" | "FAILED";
    paidAt: string | null;
    groupName: string;
  }>;
  payouts: Array<{
    cycleNumber: number;
    amount: number;
    status: "PENDING" | "SUCCESS" | "FAILED";
    sentAt: string | null;
  }>;
  pagination: {
    contributions: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    payouts: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
};

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchHistory(contributionsPage: number, payoutsPage: number) {
  const res = await fetch(
    `/api/history?contributionsPage=${contributionsPage}&contributionsPageSize=10&payoutsPage=${payoutsPage}&payoutsPageSize=6`,
    { credentials: "include" }
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to load history");
  }
  return (await res.json()) as HistoryResponse;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `GH₵ ${amount.toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusConfig(status: "PENDING" | "SUCCESS" | "FAILED") {
  switch (status) {
    case "SUCCESS":
      return { label: "Paid", className: "bg-primary/10 text-primary hover:bg-primary/10" };
    case "FAILED":
      return { label: "Failed", className: "bg-destructive/10 text-destructive hover:bg-destructive/10" };
    default:
      return { label: "Pending", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" };
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function HistorySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-8 w-40" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [contributionsPage, setContributionsPage] = useState(1);
  const [payoutsPage, setPayoutsPage] = useState(1);
  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["history", contributionsPage, payoutsPage],
    queryFn: () => fetchHistory(contributionsPage, payoutsPage),
  });

  if (isLoading) return <HistorySkeleton />;

  if (error || !data) {
    return (
      <Card className="border-destructive/20 p-6">
        <p className="font-semibold text-destructive">Unable to load history</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {(error as Error | undefined)?.message ?? "Something went wrong."}
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

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your contributions and payouts across all cycles.
        </p>
      </div>

      {/* Contributions */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold">Contributions</h2>
        </div>

        {data.contributions.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center">
            <p className="text-sm text-muted-foreground">No contributions yet.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border bg-card">
              {/* Mobile: card rows */}
              <div className="divide-y sm:hidden">
                {data.contributions.map((c, i) => {
                  const cfg = statusConfig(c.status);
                  return (
                    <div key={`${c.groupName}-${c.cycleNumber}-${i}`} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          Cycle #{c.cycleNumber} · {c.groupName}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(c.paidAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(c.amount)}</p>
                        <Badge className={`mt-0.5 text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <table className="hidden w-full text-sm sm:table">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Cycle
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Group
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.contributions.map((c, i) => {
                    const cfg = statusConfig(c.status);
                    return (
                      <tr key={`${c.groupName}-${c.cycleNumber}-${i}`} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">#{c.cycleNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.groupName}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(c.amount)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(c.paidAt)}</td>
                        <td className="px-4 py-3">
                          <Badge className={cfg.className}>{cfg.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing page {data.pagination.contributions.page} of{" "}
                {data.pagination.contributions.totalPages}
              </span>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={contributionsPage <= 1}
                  onClick={() =>
                    setContributionsPage((current) => Math.max(current - 1, 1))
                  }
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    contributionsPage >= data.pagination.contributions.totalPages
                  }
                  onClick={() =>
                    setContributionsPage((current) =>
                      Math.min(current + 1, data.pagination.contributions.totalPages)
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Payouts */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <ArrowDownLeft className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-base font-semibold">Payouts received</h2>
        </div>

        {data.payouts.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center">
            <p className="text-sm text-muted-foreground">
              No payouts received yet. Your turn is still ahead.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">View dashboard</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.payouts.map((payout, i) => {
                const cfg = statusConfig(payout.status);
                return (
                  <div
                    key={`payout-${payout.cycleNumber}-${i}`}
                    className="flex items-center gap-4 rounded-2xl border bg-card p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <ArrowDownLeft className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Cycle #{payout.cycleNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(payout.sentAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-primary">
                        {formatCurrency(payout.amount)}
                      </p>
                      <Badge className={`mt-0.5 text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing page {data.pagination.payouts.page} of{" "}
                {data.pagination.payouts.totalPages}
              </span>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={payoutsPage <= 1}
                  onClick={() => setPayoutsPage((current) => Math.max(current - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={payoutsPage >= data.pagination.payouts.totalPages}
                  onClick={() =>
                    setPayoutsPage((current) =>
                      Math.min(current + 1, data.pagination.payouts.totalPages)
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
