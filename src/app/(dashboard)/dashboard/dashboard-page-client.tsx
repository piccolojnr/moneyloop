"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardResponse = {
  member: {
    id: string;
    name: string;
  };
  group: {
    groupId: string;
    groupName: string;
    payoutPosition: number;
    memberCount: number;
    contributionAmount: number;
  } | null;
  activeCycle: {
    cycleId: string;
    cycleNumber: number;
    payoutDate: string;
    status: "PENDING" | "READY" | "PAID" | "FAILED";
    totalCollected: number;
    recipientName: string;
    paidCount: number;
  } | null;
  myContribution: {
    status: "PENDING" | "SUCCESS" | null;
  };
  myPayout: {
    daysUntilTurn: number;
    cyclesUntilTurn: number;
    expectedPayoutDate: string;
  } | null;
  totalCyclesRemaining: number;
};

async function fetchDashboard() {
  const response = await fetch("/api/dashboard", {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Failed to load dashboard");
  }

  return (await response.json()) as DashboardResponse;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="min-h-52">
          <CardHeader className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-10 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardPageClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboard,
  });

  useEffect(() => {
    if (searchParams.get("payment") !== "success") {
      return;
    }

    toast.success("Payment received! We'll confirm it shortly.");
    router.replace(pathname);
  }, [pathname, router, searchParams]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle>Unable to load dashboard</CardTitle>
          <CardDescription>
            {(error as Error | undefined)?.message ??
              "Something went wrong while loading your summary."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? "Retrying..." : "Try again"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data.group || !data.activeCycle || !data.myPayout) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardDescription>Account ready</CardDescription>
          <CardTitle>No active susu cycle yet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your account exists, but you are not yet attached to an active group
            and payout cycle. Once that assignment is in place, your dashboard
            summary will appear here.
          </p>
          <p className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">{data.member.name}</span>.
          </p>
        </CardContent>
      </Card>
    );
  }

  const contributionPaid = data.myContribution.status === "SUCCESS";
  const contributionPending =
    data.myContribution.status === "PENDING" ||
    data.myContribution.status === null;
  const paidPercent =
    data.group.memberCount === 0
      ? 0
      : Math.round((data.activeCycle.paidCount / data.group.memberCount) * 100);

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <Card className="min-h-52 md:col-span-2">
        <CardHeader>
          <CardDescription>{data.group.groupName}</CardDescription>
          <CardTitle className="text-2xl">
            Current cycle #{data.activeCycle.cycleNumber}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Payout date</p>
            <p className="text-lg font-medium">
              {formatDate(data.activeCycle.payoutDate)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Recipient</p>
            <p className="text-lg font-medium">
              {data.activeCycle.recipientName}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-52">
        <CardHeader>
          <CardDescription>This cycle</CardDescription>
          <CardTitle>Your contribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge
              className={
                contributionPaid
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  : "bg-amber-100 text-amber-700 hover:bg-amber-100"
              }
            >
              {contributionPaid ? "Paid" : "Unpaid"}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Cycle amount</p>
            <p className="text-lg font-medium">
              GHS {data.group.contributionAmount.toFixed(2)}
            </p>
          </div>
          {contributionPending && (
            <Button asChild>
              <Link href="/pay">Pay Now</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="min-h-52">
        <CardHeader>
          <CardDescription>Rotation</CardDescription>
          <CardTitle>Your payout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Your position</p>
            <p className="text-lg font-medium">#{data.group.payoutPosition}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Cycles until your turn
            </p>
            <p className="text-lg font-medium">
              {data.myPayout.cyclesUntilTurn}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Expected payout date
            </p>
            <p className="text-lg font-medium">
              {formatDate(data.myPayout.expectedPayoutDate)}
            </p>
            <p className="text-sm text-muted-foreground">
              {data.myPayout.daysUntilTurn} day
              {data.myPayout.daysUntilTurn === 1 ? "" : "s"} remaining
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-52 xl:col-span-2">
        <CardHeader>
          <CardDescription>Collection progress</CardDescription>
          <CardTitle>
            {data.activeCycle.paidCount} of {data.group.memberCount} contributed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${paidPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{paidPercent}% complete</span>
            <span>{data.totalCyclesRemaining} cycles left in this round</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
