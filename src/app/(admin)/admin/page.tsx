"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Clock3,
  ShieldCheck,
  Users,
} from "lucide-react";

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

type PlatformUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  momoNumber: string;
  momoNetwork: "MTN" | "VodafoneCash" | "AirtelTigo";
  role: "MEMBER" | "ADMIN";
  createdAt: string;
  groupCount: number;
};

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

type PayoutRecord = {
  id: string;
  cycleNumber: number;
  recipientName: string;
  groupName: string;
  amount: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
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

async function fetchJson<T>(url: string, fallback: string) {
  const response = await fetch(url, {
    credentials: "include",
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | T
    | null;

  if (!response.ok) {
    throw new Error(
      typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
        ? body.error
        : fallback
    );
  }

  return body as T;
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border bg-card p-6 shadow-sm lg:p-8">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-4 h-10 w-80" />
        <Skeleton className="mt-3 h-4 w-[32rem]" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className={index === 2 ? "lg:col-span-2" : ""}>
            <CardHeader className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((__, rowIndex) => (
                <Skeleton key={rowIndex} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
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

function payoutStatusClass(status: PayoutRecord["status"]) {
  switch (status) {
    case "SUCCESS":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "FAILED":
      return "bg-red-100 text-red-700 hover:bg-red-100";
    default:
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  }
}

function countGroups(groups: GroupSummary[], status: GroupSummary["status"]) {
  return groups.filter((group) => group.status === status).length;
}

export default function AdminOverviewPage() {
  const usersQuery = useQuery({
    queryKey: ["admin-overview-users"],
    queryFn: () => fetchJson<PlatformUser[]>("/api/members", "Failed to load users"),
  });

  const groupsQuery = useQuery({
    queryKey: ["admin-overview-groups"],
    queryFn: () => fetchJson<GroupSummary[]>("/api/groups", "Failed to load groups"),
  });

  const payoutsQuery = useQuery({
    queryKey: ["admin-overview-payouts"],
    queryFn: () =>
      fetchJson<PayoutResponse>("/api/payouts?page=1", "Failed to load payouts"),
  });

  const isLoading =
    usersQuery.isLoading || groupsQuery.isLoading || payoutsQuery.isLoading;
  const error = usersQuery.error || groupsQuery.error || payoutsQuery.error || null;

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  if (error || !usersQuery.data || !groupsQuery.data || !payoutsQuery.data) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle>Unable to load admin overview</CardTitle>
          <CardDescription>
            {(error as Error | null)?.message ??
              "Something went wrong while loading platform data."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void Promise.all([
                usersQuery.refetch(),
                groupsQuery.refetch(),
                payoutsQuery.refetch(),
              ]);
            }}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const users = usersQuery.data;
  const groups = groupsQuery.data;
  const payouts = payoutsQuery.data.data;
  const activeGroups = countGroups(groups, "ACTIVE");
  const pausedGroups = countGroups(groups, "PAUSED");
  const completedGroups = countGroups(groups, "COMPLETED");
  const pendingPayouts = payouts.filter((payout) => payout.status === "PENDING").length;
  const successfulPayouts = payouts.filter((payout) => payout.status === "SUCCESS").length;
  const recentUsers = users.slice(0, 5);
  const recentPayouts = payouts.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border bg-card shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.45fr_0.85fr] lg:p-8">
          <div className="space-y-5">
            <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
              Platform oversight
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Admin control center
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Track platform growth, inspect group activity, and review payout
                operations from one place. Treasurer workflows continue to live in
                the member dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/admin/groups">
                  Review groups
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/payouts">Inspect payouts</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl bg-muted/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Active groups
              </p>
              <p className="mt-3 text-3xl font-semibold">{activeGroups}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pausedGroups} paused · {completedGroups} completed
              </p>
            </div>
            <div className="rounded-2xl bg-muted/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Pending payouts
              </p>
              <p className="mt-3 text-3xl font-semibold">{pendingPayouts}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {successfulPayouts} recent successful payouts
              </p>
            </div>
            <div className="rounded-2xl bg-muted/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Platform users
              </p>
              <p className="mt-3 text-3xl font-semibold">{users.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {users.filter((user) => user.role === "ADMIN").length} admins
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Platform users",
            value: users.length,
            note: "Registered accounts",
            href: "/admin/members",
            icon: Users,
          },
          {
            title: "Groups in motion",
            value: activeGroups,
            note: "Currently active groups",
            href: "/admin/groups",
            icon: Building2,
          },
          {
            title: "Transfers waiting",
            value: pendingPayouts,
            note: "Pending payout records",
            href: "/admin/payouts",
            icon: Clock3,
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.title} className="overflow-hidden shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardDescription>{stat.title}</CardDescription>
                  <CardTitle className="mt-3 text-3xl">{stat.value}</CardTitle>
                </div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-muted">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{stat.note}</p>
                <Button asChild variant="ghost" size="sm" className="-mr-2">
                  <Link href={stat.href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Recent users</CardTitle>
              <CardDescription>Newest platform signups.</CardDescription>
            </div>
            <Badge variant="secondary">{recentUsers.length}</Badge>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No users registered yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-2xl border px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user.groupCount} group{user.groupCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Recent payouts</CardTitle>
              <CardDescription>Latest payout events across the platform.</CardDescription>
            </div>
            <Badge variant="secondary">{recentPayouts.length}</Badge>
          </CardHeader>
          <CardContent>
            {recentPayouts.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No payouts recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentPayouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between rounded-2xl border px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{payout.recipientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {payout.groupName} • Cycle #{payout.cycleNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={payoutStatusClass(payout.status)}>
                        {payout.status}
                      </Badge>
                      <p className="mt-2 text-sm font-medium">
                        {formatCurrency(payout.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Platform health</CardTitle>
              <CardDescription>
                Quick snapshot of how the platform is moving today.
              </CardDescription>
            </div>
            <ShieldCheck className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-muted/55 p-4">
              <p className="text-sm font-medium">Active groups</p>
              <p className="mt-2 text-2xl font-semibold">{activeGroups}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Groups currently collecting or paying out.
              </p>
            </div>
            <div className="rounded-2xl bg-muted/55 p-4">
              <p className="text-sm font-medium">Pending payouts</p>
              <p className="mt-2 text-2xl font-semibold">{pendingPayouts}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Transfers awaiting final completion.
              </p>
            </div>
            <div className="rounded-2xl bg-muted/55 p-4">
              <p className="text-sm font-medium">Visible users</p>
              <p className="mt-2 text-2xl font-semibold">{recentUsers.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Recent signups surfaced on this overview.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
