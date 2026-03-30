"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
};

async function fetchHistory() {
  const response = await fetch("/api/history", {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "Failed to load history");
  }

  return (await response.json()) as HistoryResponse;
}

function formatCurrency(amount: number) {
  return `GHS ${amount.toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function statusClassName(status: "PENDING" | "SUCCESS" | "FAILED") {
  switch (status) {
    case "SUCCESS":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "FAILED":
      return "bg-red-100 text-red-700 hover:bg-red-100";
    default:
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  }
}

function HistorySkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function HistoryPage() {
  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["history"],
    queryFn: fetchHistory,
  });

  if (isLoading) {
    return <HistorySkeleton />;
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardDescription>History</CardDescription>
          <CardTitle>Unable to load activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {(error as Error | undefined)?.message ??
              "Something went wrong while loading your history."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {isRefetching ? "Retrying..." : "Try again"}
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardDescription>My contributions</CardDescription>
          <CardTitle>Recent contribution activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.contributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No contributions yet. Your first cycle is coming up.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.contributions.map((contribution) => (
                  <TableRow
                    key={`${contribution.groupName}-${contribution.cycleNumber}`}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          Cycle #{contribution.cycleNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {contribution.groupName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(contribution.amount)}</TableCell>
                    <TableCell>{formatDate(contribution.paidAt)}</TableCell>
                    <TableCell>
                      <Badge className={statusClassName(contribution.status)}>
                        {contribution.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Payouts received</CardDescription>
          <CardTitle>Your recent payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {data.payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payouts received yet. Your turn in the rotation is still ahead.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.payouts.map((payout) => (
                <div
                  key={`payout-${payout.cycleNumber}-${payout.sentAt ?? payout.status}`}
                  className="rounded-lg border bg-muted/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Cycle #{payout.cycleNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(payout.sentAt)}
                      </p>
                    </div>
                    <Badge className={statusClassName(payout.status)}>
                      {payout.status}
                    </Badge>
                  </div>
                  <p className="mt-3 text-lg font-medium">
                    {formatCurrency(payout.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
