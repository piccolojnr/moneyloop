"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Building2, Users } from "lucide-react";

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
    <Card className="shadow-sm">
      <CardHeader className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-56" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-10 w-full" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminGroupsPage() {
  const groupsQuery = useQuery({
    queryKey: ["admin-groups"],
    queryFn: fetchGroups,
  });

  const summary = useMemo(() => {
    const groups = groupsQuery.data ?? [];
    return {
      total: groups.length,
      active: groups.filter((group) => group.status === "ACTIVE").length,
      members: groups.reduce((accumulator, group) => accumulator + group.memberCount, 0),
    };
  }, [groupsQuery.data]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border bg-card shadow-sm">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between lg:p-8">
          <div className="space-y-3">
            <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100">
              Group directory
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">All Groups</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Inspect every group on the platform, see who is responsible for it,
                and jump into the treasurer-facing detail view when you need context.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
            Platform admins can open any group detail directly from this directory.
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Total groups",
            value: summary.total,
            note: "Groups created across the platform",
            icon: Building2,
          },
          {
            label: "Active groups",
            value: summary.active,
            note: "Groups currently collecting or paying out",
            icon: ArrowUpRight,
          },
          {
            label: "Members covered",
            value: summary.members,
            note: "Group memberships represented here",
            icon: Users,
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

      {groupsQuery.isLoading ? (
        <TableSkeleton />
      ) : groupsQuery.error || !groupsQuery.data ? (
        <Card className="border-destructive/20 shadow-sm">
          <CardHeader>
            <CardTitle>Unable to load groups</CardTitle>
            <CardDescription>
              {(groupsQuery.error as Error | undefined)?.message ??
                "Something went wrong while loading platform groups."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => groupsQuery.refetch()}
              disabled={groupsQuery.isRefetching}
            >
              {groupsQuery.isRefetching ? "Retrying..." : "Try again"}
            </Button>
          </CardContent>
        </Card>
      ) : groupsQuery.data.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">No groups yet</h2>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                No treasurer has created a group yet. Groups will appear here
                automatically once members start organizing savings circles.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard/groups">Open member dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Platform group directory</CardTitle>
              <CardDescription>
                Open any row to inspect the treasurer-facing group detail page.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">
              {groupsQuery.data.length} groups
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border">
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
                  {groupsQuery.data.map((group) => (
                    <TableRow key={group.id} className="group">
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/groups/${group.id}`}
                          className="flex items-center gap-2 hover:text-primary"
                        >
                          {group.name}
                          <ArrowUpRight className="size-4 opacity-0 transition group-hover:opacity-100" />
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
