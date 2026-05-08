"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Clock3, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { badgeToneClass, formatDisplayDate } from "@/lib/presentation";

type PayoutStatus = "PENDING" | "SUCCESS" | "FAILED";

type PayoutRecord = {
  id: string;
  cycleNumber: number;
  recipientName: string;
  groupName: string;
  amount: number;
  status: PayoutStatus;
  sentAt: string | null;
  failureReason: string | null;
  createdAt: string;
};

type PayoutResponse = {
  data: PayoutRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

async function fetchPayouts(page: number) {
  const response = await fetch(`/api/payouts?page=${page}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "Failed to load payouts");
  }

  return (await response.json()) as PayoutResponse;
}

function formatCurrency(amount: number) {
  return `GHS ${amount.toFixed(2)}`;
}

function formatDate(value: string | null) {
  return formatDisplayDate(value, "Not sent yet");
}

function payoutStatusClass(status: PayoutStatus) {
  switch (status) {
    case "SUCCESS":
      return badgeToneClass.success;
    case "FAILED":
      return badgeToneClass.error;
    default:
      return badgeToneClass.warning;
  }
}

function PayoutTableSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-56" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-10 w-52" />
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminPayoutsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"ALL" | PayoutStatus>("ALL");

  const payoutsQuery = useQuery({
    queryKey: ["admin-payouts", page, statusFilter],
    queryFn: () => fetchPayouts(page),
    select: (result) => ({
      ...result,
      data:
        statusFilter === "ALL"
          ? result.data
          : result.data.filter((payout) => payout.status === statusFilter),
    }),
  });

  const summary = useMemo(() => {
    const payouts = payoutsQuery.data?.data ?? [];
    return {
      total: payouts.length,
      pending: payouts.filter((payout) => payout.status === "PENDING").length,
      failed: payouts.filter((payout) => payout.status === "FAILED").length,
    };
  }, [payoutsQuery.data]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border bg-card shadow-sm">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between lg:p-8">
          <div className="space-y-3">
            <Badge className={badgeToneClass.warning}>
              Transfer oversight
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">All Payouts</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Review the latest payout records, narrow down by transfer status,
                and spot failures quickly before members escalate support requests.
              </p>
            </div>
          </div>

          <div className="w-full max-w-xs">
            <p className="mb-2 text-sm font-medium">Status filter</p>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as "ALL" | PayoutStatus)}
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Visible payouts",
            value: summary.total,
            note: "Records on this page after filtering",
            icon: CircleDollarSign,
          },
          {
            label: "Pending transfers",
            value: summary.pending,
            note: "Awaiting confirmation or completion",
            icon: Clock3,
          },
          {
            label: "Failed transfers",
            value: summary.failed,
            note: "Require review or a retry path",
            icon: XCircle,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardDescription>{item.label}</CardDescription>
                  <CardTitle className="mt-3 text-3xl">{item.value}</CardTitle>
                </div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-muted">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {payoutsQuery.isLoading ? (
        <PayoutTableSkeleton />
      ) : payoutsQuery.error || !payoutsQuery.data ? (
        <Card className="border-destructive/20 shadow-sm">
          <CardHeader>
            <CardTitle>Unable to load payouts</CardTitle>
            <CardDescription>
              {(payoutsQuery.error as Error | undefined)?.message ??
                "Something went wrong while loading payout activity."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => payoutsQuery.refetch()}
              disabled={payoutsQuery.isRefetching}
            >
              {payoutsQuery.isRefetching ? "Retrying..." : "Try again"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Payout activity log</CardTitle>
              <CardDescription>
                Latest transfer records across all groups, newest first.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              Page {payoutsQuery.data.pagination.page} of{" "}
              {payoutsQuery.data.pagination.totalPages}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {payoutsQuery.data.data.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">No payouts match this filter</h2>
                  <p className="max-w-md text-sm leading-6 text-muted-foreground">
                    No payout records were returned for the current status filter on
                    this page. Clear the filter to see the broader payout log.
                  </p>
                </div>
                {statusFilter !== "ALL" ? (
                  <Button type="button" variant="outline" onClick={() => setStatusFilter("ALL")}>
                    Clear filter
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cycle</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Failure Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payoutsQuery.data.data.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>Cycle #{payout.cycleNumber}</TableCell>
                        <TableCell className="font-medium">
                          {payout.recipientName}
                        </TableCell>
                        <TableCell>{payout.groupName}</TableCell>
                        <TableCell>{formatCurrency(payout.amount)}</TableCell>
                        <TableCell>
                          <Badge className={payoutStatusClass(payout.status)}>
                            {payout.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(payout.sentAt)}</TableCell>
                        <TableCell>
                          {payout.status === "FAILED"
                            ? payout.failureReason ?? "Transfer failed"
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing page {payoutsQuery.data.pagination.page} of{" "}
                {payoutsQuery.data.pagination.totalPages}
              </span>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= payoutsQuery.data.pagination.totalPages}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(current + 1, payoutsQuery.data.pagination.totalPages)
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
