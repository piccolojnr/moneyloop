"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardSummary = {
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
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "Failed to load payment context");
  }

  return (await response.json()) as DashboardSummary;
}

function PayPageSkeleton() {
  return (
    <Card className="max-w-2xl">
      <CardHeader className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-56" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-10 w-32" />
      </CardContent>
    </Card>
  );
}

export default function PayPage() {
  const startedRef = useRef(false);
  const slowNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboard,
  });

  const alreadyPaid = data?.myContribution.status === "SUCCESS";
  const noCycle = !data?.group || !data?.activeCycle;
  const cycleNotPending = data?.activeCycle?.status !== "PENDING";
  const shouldAutoStart =
    !!data &&
    !!data.group &&
    !!data.activeCycle &&
    !alreadyPaid &&
    !cycleNotPending &&
    status !== "error" &&
    message === null;

  useEffect(() => {
    if (!shouldAutoStart || !data || startedRef.current) {
      return;
    }

    startedRef.current = true;
    slowNoticeTimerRef.current = setTimeout(() => {
      setShowSlowNotice(true);
    }, 5000);

    void (async () => {
      const response = await fetch("/api/contributions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ groupId: data.group?.groupId }),
      });

      const body = (await response.json().catch(() => null)) as
        | { authorizationUrl?: string; error?: string }
        | null;

      if (response.ok && body?.authorizationUrl) {
        if (slowNoticeTimerRef.current) {
          clearTimeout(slowNoticeTimerRef.current);
        }
        window.location.href = body.authorizationUrl;
        return;
      }

      if (slowNoticeTimerRef.current) {
        clearTimeout(slowNoticeTimerRef.current);
      }
      setShowSlowNotice(false);

      if (response.status === 409) {
        setStatus("idle");
        setMessage(body?.error ?? "You have already paid this cycle.");
        return;
      }

      if (response.status === 404) {
        setStatus("idle");
        setMessage(body?.error ?? "No active cycle found.");
        return;
      }

      setStatus("error");
      setMessage(body?.error ?? "Unable to start payment right now.");
      startedRef.current = false;
    })().catch((paymentError: unknown) => {
      if (slowNoticeTimerRef.current) {
        clearTimeout(slowNoticeTimerRef.current);
      }
      setShowSlowNotice(false);
      setStatus("error");
      setMessage(
        paymentError instanceof Error
          ? paymentError.message
          : "Unable to start payment right now."
      );
      startedRef.current = false;
    });

    return () => {
      if (slowNoticeTimerRef.current) {
        clearTimeout(slowNoticeTimerRef.current);
      }
    };
  }, [data, message, shouldAutoStart, status]);

  if (isLoading) {
    return <PayPageSkeleton />;
  }

  if (error || !data) {
    return (
      <Card className="max-w-2xl border-destructive/20">
        <CardHeader>
          <CardDescription>Payment</CardDescription>
          <CardTitle>Unable to prepare payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {(error as Error | undefined)?.message ??
              "We could not load your current contribution details."}
          </p>
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

  const isStarting = shouldAutoStart;
  const noActiveCycle =
    noCycle ||
    data.activeCycle.status !== "PENDING";
  const title = alreadyPaid
    ? "Contribution already received"
    : noActiveCycle
      ? "No payment due right now"
      : status === "error"
        ? "Payment could not start"
        : "Redirecting to Paystack";
  const resolvedMessage = alreadyPaid
    ? "You have already paid your contribution for this cycle."
    : !data.group || !data.activeCycle
      ? "There is no active cycle available for payment right now."
      : data.activeCycle.status !== "PENDING"
        ? "This cycle is not currently accepting contributions."
        : message;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardDescription>
          {data.group?.groupName ?? "Contributions"}
        </CardDescription>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.activeCycle && data.group ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Cycle #{data.activeCycle.cycleNumber}</p>
            <p>Amount: GHS {data.group.contributionAmount.toFixed(2)}</p>
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {resolvedMessage ??
            "We are preparing your checkout session. You will be redirected automatically."}
        </p>

        {isStarting ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <LoadingSpinner />
              <span>Connecting you to Paystack...</span>
            </div>
            {showSlowNotice ? (
              <p className="text-sm text-amber-700">
                This is taking longer than usual...
              </p>
            ) : (
              <Skeleton className="h-4 w-3/4" />
            )}
          </div>
        ) : (
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
            {status === "error" ? (
              <Button type="button" onClick={() => window.location.reload()}>
                Retry payment
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
