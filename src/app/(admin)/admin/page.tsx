"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

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
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80" />
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
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
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
  const error =
    usersQuery.error || groupsQuery.error || payoutsQuery.error || null;

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
  const activeGroups = groups.filter((group) => group.status === "ACTIVE").length;
  const pendingPayouts = payouts.filter((payout) => payout.status === "PENDING").length;
  const recentUsers = users.slice(0, 5);
  const recentPayouts = payouts.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin Overview</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide visibility into users, groups, and payout activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Total users</CardDescription>
            <CardTitle className="text-3xl">{users.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/members">View users</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Active groups</CardDescription>
            <CardTitle className="text-3xl">{activeGroups}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/groups">View groups</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Pending payouts</CardDescription>
            <CardTitle className="text-3xl">{pendingPayouts}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/payouts">View payouts</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent users</CardTitle>
            <CardDescription>Newest platform signups.</CardDescription>
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
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
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
          <CardHeader>
            <CardTitle>Recent payouts</CardTitle>
            <CardDescription>Latest payout events across the platform.</CardDescription>
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
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
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
      </div>
    </div>
  );
}
