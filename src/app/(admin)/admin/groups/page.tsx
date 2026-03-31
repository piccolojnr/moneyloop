"use client";

import Link from "next/link";
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

type GroupSummary = {
  id: string;
  name: string;
  contributionAmount: number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  createdAt: string;
  memberCount: number;
  treasurerName: string;
};

async function fetchGroups() {
  const response = await fetch("/api/groups", {
    credentials: "include",
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | GroupSummary[]
    | null;

  if (!response.ok) {
    throw new Error(
      typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
        ? body.error
        : "Failed to load groups"
    );
  }

  return body as GroupSummary[];
}

function formatCurrency(amount: number) {
  return `GHS ${amount.toFixed(2)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatFrequency(value: GroupSummary["frequency"]) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function statusBadgeClass(status: GroupSummary["status"]) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "PAUSED":
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
    default:
      return "bg-zinc-100 text-zinc-700 hover:bg-zinc-100";
  }
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-8 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminGroupsPage() {
  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: fetchGroups,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">All Groups</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide group oversight across all treasurers and payout circles.
        </p>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error || !data ? (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle>Unable to load groups</CardTitle>
            <CardDescription>
              {(error as Error | undefined)?.message ??
                "Something went wrong while loading platform groups."}
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
      ) : data.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>No groups yet</CardTitle>
            <CardDescription>
              No groups have been created on the platform yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            Groups created by treasurers will appear here automatically.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Group directory</CardTitle>
            <CardDescription>
              {data.length} group{data.length === 1 ? "" : "s"} across the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group Name</TableHead>
                  <TableHead>Treasurer</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Amount (GHS)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((group) => (
                  <TableRow key={group.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/groups/${group.id}`} className="block">
                        {group.name}
                      </Link>
                    </TableCell>
                    <TableCell>{group.treasurerName}</TableCell>
                    <TableCell>{group.memberCount}</TableCell>
                    <TableCell>{formatFrequency(group.frequency)}</TableCell>
                    <TableCell>{formatCurrency(group.contributionAmount)}</TableCell>
                    <TableCell>
                      <Badge className={statusBadgeClass(group.status)}>
                        {group.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(group.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
