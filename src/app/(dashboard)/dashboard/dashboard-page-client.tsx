"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  RotateCcw,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
    totalCollected: number;
    recipientName: string;
    recipientId: string;
    requiredContributorCount: number;
    paidCount: number;
  } | null;
  myContribution: { status: "PENDING" | "SUCCESS" | "EXEMPT" | null };
  myPayout: {
    daysUntilTurn: number;
    cyclesUntilTurn: number;
    expectedPayoutDate: string;
  } | null;
  totalCyclesRemaining: number;
};

type DashboardResponse = {
  member: { id: string; name: string };
  groups: GroupDashboard[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function needsAction(entry: GroupDashboard) {
  const s = entry.myContribution.status;
  return entry.activeCycle !== null && (s === "PENDING" || s === null);
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
    throw new Error(body?.error ?? "Failed to load dashboard");
  }
  return (await res.json()) as DashboardResponse;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mb-3 h-9 w-9 rounded-xl" />
              <Skeleton className="mb-1.5 h-3.5 w-20" />
              <Skeleton className="h-6 w-28" />
            </Card>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-5">
            <Skeleton className="mb-4 h-5 w-40" />
            <Skeleton className="mb-2 h-2.5 w-full rounded-full" />
            <Skeleton className="h-3.5 w-28" />
          </Card>
          <Card className="p-5">
            <Skeleton className="mb-4 h-5 w-32" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Stat card (used in expanded sections) ─────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className={`p-5 ${accent ? "border-primary/30 bg-primary/5" : ""}`}>
      <div
        className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${
          accent ? "bg-primary/15" : "bg-muted"
        }`}
      >
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

// ── Expanded group section (needs action) ─────────────────────────────────────

function ExpandedGroupSection({ entry }: { entry: GroupDashboard }) {
  const { group, activeCycle, myContribution, myPayout, totalCyclesRemaining } = entry;

  // Shouldn't render without an active cycle, but guard anyway
  if (!activeCycle || !myPayout) {
    return <CompactGroupCard entry={entry} />;
  }

  const contributionPending =
    myContribution.status === "PENDING" || myContribution.status === null;

  const paidPercent =
    activeCycle.requiredContributorCount === 0
      ? 0
      : Math.round(
          (activeCycle.paidCount / activeCycle.requiredContributorCount) * 100
        );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{group.groupName}</h2>
          <p className="text-xs text-muted-foreground">
            Cycle #{activeCycle.cycleNumber} · Payout{" "}
            {formatDate(activeCycle.payoutDate)}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" asChild>
          <Link href={`/groups/${group.groupId}`}>View group</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Calendar}
          label="Payout date"
          value={formatDate(activeCycle.payoutDate)}
          sub={`Cycle #${activeCycle.cycleNumber}`}
          accent
        />
        <StatCard
          icon={TrendingUp}
          label="Recipient this cycle"
          value={activeCycle.recipientName}
          sub={formatCurrency(
            group.contributionAmount * activeCycle.requiredContributorCount
          )}
        />
        <StatCard
          icon={RotateCcw}
          label="Your payout turn"
          value={
            myPayout.cyclesUntilTurn === 0
              ? "This cycle!"
              : `${myPayout.cyclesUntilTurn} cycle${myPayout.cyclesUntilTurn === 1 ? "" : "s"} away`
          }
          sub={formatDate(myPayout.expectedPayoutDate)}
        />
        <StatCard
          icon={Users}
          label="Group size"
          value={`${group.memberCount} members`}
          sub={group.payoutPosition ? `Position #${group.payoutPosition}` : undefined}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Collection progress */}
        <Card className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Collection progress
              </p>
              <p className="mt-1 text-base font-semibold">
                {activeCycle.paidCount} of {activeCycle.requiredContributorCount} paid
              </p>
            </div>
            <span className="text-sm font-bold text-primary">{paidPercent}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${paidPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {totalCyclesRemaining} cycle{totalCyclesRemaining === 1 ? "" : "s"} remaining
          </p>
        </Card>

        {/* Contribution CTA */}
        <Card className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Your contribution
              </p>
              <p className="mt-1 text-base font-semibold">
                {formatCurrency(group.contributionAmount)}
              </p>
            </div>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              <Clock className="mr-1 h-3 w-3" />
              Due
            </Badge>
          </div>
          {contributionPending && (
            <Button className="w-full" asChild>
              <Link href="/pay">
                <CreditCard className="mr-2 h-4 w-4" />
                Pay now
              </Link>
            </Button>
          )}
        </Card>
      </div>
    </section>
  );
}

// ── Compact group card (all caught up) ────────────────────────────────────────

function CompactGroupCard({ entry }: { entry: GroupDashboard }) {
  const { group, activeCycle, myContribution, myPayout } = entry;

  const isExempt = myContribution.status === "EXEMPT";
  const isPaid = myContribution.status === "SUCCESS";
  const noActiveCycle = !activeCycle;

  const paidPercent =
    activeCycle && activeCycle.requiredContributorCount > 0
      ? Math.round(
          (activeCycle.paidCount / activeCycle.requiredContributorCount) * 100
        )
      : null;

  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card px-4 py-3.5">
      {/* Status icon */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          isPaid || isExempt ? "bg-primary/10" : "bg-muted"
        }`}
      >
        {isPaid || isExempt ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Group info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{group.groupName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {noActiveCycle
            ? "Waiting for cycle to start"
            : isExempt
              ? `Cycle #${activeCycle.cycleNumber} · You're the recipient`
              : `Cycle #${activeCycle.cycleNumber} · ${
                  myPayout?.cyclesUntilTurn === 0
                    ? "Your payout this cycle"
                    : myPayout
                      ? `Your turn in ${myPayout.cyclesUntilTurn} cycle${myPayout.cyclesUntilTurn === 1 ? "" : "s"}`
                      : ""
                }`}
        </p>
      </div>

      {/* Progress pill */}
      {paidPercent !== null && (
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${paidPercent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{paidPercent}%</span>
        </div>
      )}

      {/* Status badge + link */}
      <div className="flex shrink-0 items-center gap-2">
        <Badge
          className={
            isPaid
              ? "bg-primary/10 text-primary hover:bg-primary/10"
              : isExempt
                ? "bg-muted text-muted-foreground hover:bg-muted"
                : "bg-muted text-muted-foreground hover:bg-muted"
          }
        >
          {isPaid ? "Paid" : isExempt ? "Exempt" : "Waiting"}
        </Badge>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
          <Link
            href={`/groups/${group.groupId}`}
            aria-label={`Open ${group.groupName} group details`}
            title={`Open ${group.groupName}`}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span className="sr-only">Open group details</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DashboardPageClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboard,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (searchParams.get("payment") !== "success") return;
    toast.success("Payment received! We'll confirm it shortly.");
    router.replace(pathname);
  }, [pathname, router, searchParams]);

  if (isLoading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <Card className="border-destructive/20 p-6">
        <p className="font-semibold text-destructive">Unable to load dashboard</p>
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

  // Sort: groups needing action first, rest after
  const urgent = data.groups.filter(needsAction);
  const settled = data.groups.filter((g) => !needsAction(g));

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome, {data.member.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.groups.length === 0
            ? "You have no active groups yet."
            : urgent.length > 0
              ? `${urgent.length} group${urgent.length === 1 ? "" : "s"} need${urgent.length === 1 ? "s" : ""} your contribution.`
              : "You&apos;re all caught up across all your groups."}
        </p>
      </div>

      {/* No groups */}
      {data.groups.length === 0 && (
        <Card className="max-w-lg p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No active cycle yet</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            You&apos;re not part of an active group cycle. Once a treasurer assigns
            your position, your dashboard will appear here.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/groups">
                View my groups
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/history">View history</Link>
            </Button>
          </div>
        </Card>
      )}

      {/* Urgent: full expanded sections */}
      {urgent.length > 0 && (
        <div className="space-y-10">
          {urgent.map((entry, i) => (
            <div key={entry.group.groupId}>
              {i > 0 && <div className="border-t pt-2" />}
              <ExpandedGroupSection entry={entry} />
            </div>
          ))}
        </div>
      )}

      {/* Settled: compact card list */}
      {settled.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {urgent.length > 0 ? "All caught up" : "Your groups"}
          </p>
          <div className="space-y-2">
            {settled.map((entry) => (
              <CompactGroupCard key={entry.group.groupId} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
