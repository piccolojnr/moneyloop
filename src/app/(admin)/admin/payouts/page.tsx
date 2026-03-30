"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
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
  if (!value) {
    return "Not sent yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function payoutStatusClass(status: PayoutStatus) {
  switch (status) {
    case "SUCCESS":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "FAILED":
      return "bg-red-100 text-red-700 hover:bg-red-100";
    default:
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  }
}

function PayoutTableSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-40" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-10 w-48" />
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

  const { data, error, isLoading, refetch, isRefetching } = useQuery({
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Review transfer outcomes across groups and cycles.
        </p>
      </div>

      {isLoading ? (
        <PayoutTableSkeleton />
      ) : error || !data ? (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle>Unable to load payouts</CardTitle>
            <CardDescription>
              {(error as Error | undefined)?.message ??
                "Something went wrong while loading payout activity."}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
      ) : (
        <Card>
          <CardHeader>
            <CardDescription>Payout log</CardDescription>
            <CardTitle>Recent payout records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Status</span>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as "ALL" | PayoutStatus)
                }
              >
                <SelectTrigger className="w-52">
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

            {data.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payouts match this filter yet.
              </p>
            ) : (
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
                  {data.data.map((payout) => (
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
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="font-medium text-foreground disabled:text-muted-foreground"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="font-medium text-foreground disabled:text-muted-foreground"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(current + 1, data.pagination.totalPages)
                    )
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
