"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  CircleX,
  Clock3,
  CreditCard,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import { LoadingSpinner } from "@/components/shared/loading-spinner";
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

type GroupDetail = {
  id: string;
  name: string;
  treasurerId: string;
  contributionAmount: number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  currentCycle: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  createdAt: string;
  updatedAt: string;
  treasurer: { id: string; name: string; email: string };
  members: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    phone: string;
    momoNumber: string | null;
    payoutAccountStatus: "UNSET" | "PENDING_VERIFICATION" | "VERIFIED";
    payoutPosition: number | null;
    memberRole: "TREASURER" | "MEMBER";
    joinedAt: string;
  }>;
  cycles: Array<{
    id: string;
    cycleNumber: number;
    payoutDate: string;
    status: "PENDING" | "READY" | "PAID" | "FAILED";
    totalCollected: number;
    recipientId: string;
    createdAt: string;
    updatedAt: string;
    contributions: Array<{
      id: string;
      userId: string;
      amount: number;
      status: "PENDING" | "SUCCESS" | "FAILED";
      paidAt: string | null;
    }>;
  }>;
};

function getErrorMessage(body: unknown, fallback: string) {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }

  return fallback;
}

async function fetchGroup(groupId: string) {
  const response = await fetch(`/api/groups/${groupId}`, {
    credentials: "include",
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | GroupDetail
    | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(body, "Failed to load group"));
  }

  return body as GroupDetail;
}

function formatCurrency(amount: number) {
  return `GHS ${amount.toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatFrequency(value: GroupDetail["frequency"]) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function groupStatusClass(status: GroupDetail["status"]) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "PAUSED":
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
    default:
      return "bg-zinc-100 text-zinc-700 hover:bg-zinc-100";
  }
}

function cycleStatusClass(status: GroupDetail["cycles"][number]["status"]) {
  switch (status) {
    case "READY":
      return "bg-sky-100 text-sky-700 hover:bg-sky-100";
    case "PAID":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "FAILED":
      return "bg-rose-100 text-rose-700 hover:bg-rose-100";
    default:
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  }
}

function payoutStatusClass(
  status: GroupDetail["members"][number]["payoutAccountStatus"]
) {
  switch (status) {
    case "VERIFIED":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "PENDING_VERIFICATION":
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
    default:
      return "bg-zinc-100 text-zinc-700 hover:bg-zinc-100";
  }
}

function GroupDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="shadow-sm">
            <CardHeader className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-24" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminGroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;

  const groupQuery = useQuery({
    queryKey: ["admin-group", groupId],
    queryFn: () => fetchGroup(groupId),
    enabled: Boolean(groupId),
  });

  const metrics = useMemo(() => {
    const group = groupQuery.data;
    if (!group) {
      return null;
    }

    const verifiedMembers = group.members.filter(
      (member) => member.payoutAccountStatus === "VERIFIED"
    ).length;
    const currentCycle =
      group.cycles.find((cycle) => cycle.cycleNumber === group.currentCycle) ??
      group.cycles.at(-1) ??
      null;
    const currentRecipient =
      currentCycle &&
      group.members.find((member) => member.userId === currentCycle.recipientId);

    return {
      verifiedMembers,
      currentCycle,
      currentRecipient,
    };
  }, [groupQuery.data]);

  if (groupQuery.isLoading) {
    return <GroupDetailSkeleton />;
  }

  if (groupQuery.error || !groupQuery.data || !metrics) {
    return (
      <Card className="border-destructive/20 shadow-sm">
        <CardHeader>
          <CardTitle>Unable to load group</CardTitle>
          <CardDescription>
            {(groupQuery.error as Error | undefined)?.message ??
              "Something went wrong while loading this group."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => groupQuery.refetch()}
            disabled={groupQuery.isRefetching}
          >
            {groupQuery.isRefetching ? "Retrying..." : "Try again"}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/admin/groups">Back to groups</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const group = groupQuery.data;
  const members = [...group.members].sort((left, right) => {
    if (left.payoutPosition === null && right.payoutPosition === null) {
      return left.name.localeCompare(right.name);
    }
    if (left.payoutPosition === null) {
      return 1;
    }
    if (right.payoutPosition === null) {
      return -1;
    }
    return left.payoutPosition - right.payoutPosition;
  });
  const recipientNames = new Map(
    members.map((member) => [member.userId, member.name] as const)
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border bg-card shadow-sm">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between lg:p-8">
          <div className="space-y-4">
            <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
              <Link href="/admin/groups">
                <ArrowLeft className="mr-2 size-4" />
                Back to all groups
              </Link>
            </Button>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {group.name}
                </h1>
                <Badge className={groupStatusClass(group.status)}>
                  {group.status}
                </Badge>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Platform view for this savings group. You can inspect the
                treasurer, payout readiness, member roster, and full cycle
                history without jumping into the member workflow.
              </p>
            </div>
          </div>
          <div className="grid gap-3 rounded-3xl bg-muted/60 p-4 text-sm text-muted-foreground sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">
                Treasurer
              </p>
              <p className="mt-1 font-medium text-foreground">
                {group.treasurer.name}
              </p>
              <p className="text-xs">{group.treasurer.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">
                Contribution plan
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatFrequency(group.frequency)} ·{" "}
                {formatCurrency(group.contributionAmount)}
              </p>
              <p className="text-xs">Created {formatDate(group.createdAt)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Members",
            value: String(group.members.length),
            note: `${metrics.verifiedMembers} payout-ready`,
            icon: Users,
          },
          {
            label: "Current cycle",
            value: metrics.currentCycle
              ? `#${metrics.currentCycle.cycleNumber}`
              : "Not started",
            note: metrics.currentRecipient
              ? `Recipient: ${metrics.currentRecipient.name}`
              : "No recipient assigned yet",
            icon: Wallet,
          },
          {
            label: "Cycles on record",
            value: String(group.cycles.length),
            note:
              group.cycles.length > 0
                ? `Round at cycle ${group.currentCycle}`
                : "Waiting for first cycle",
            icon: Clock3,
          },
          {
            label: "Expected pool",
            value: formatCurrency(group.contributionAmount),
            note: "Per contributor, per eligible cycle",
            icon: CreditCard,
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

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Member roster</CardTitle>
            <CardDescription>
              Oversight view of payout readiness, role assignment, and payout
              order.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit">
            {members.length} members
          </Badge>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center">
              <ShieldCheck className="size-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="font-medium">No members in this group yet</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Once the treasurer starts inviting participants, the roster and
                  payout positions will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Payout position</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Payout account</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{member.phone}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.momoNumber ?? "No payout account yet"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.payoutPosition === null
                          ? "Unassigned"
                          : `#${member.payoutPosition}`}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            member.memberRole === "TREASURER"
                              ? "border-teal-200 bg-teal-50 text-teal-700"
                              : undefined
                          }
                        >
                          {member.memberRole}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={payoutStatusClass(member.payoutAccountStatus)}
                        >
                          {member.payoutAccountStatus === "PENDING_VERIFICATION"
                            ? "PENDING"
                            : member.payoutAccountStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(member.joinedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Cycle history</CardTitle>
            <CardDescription>
              Every payout turn recorded for this group, including the recipient
              and total collected for that cycle.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{group.cycles.length} cycles</Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/payouts">
                Platform payouts
                <ArrowUpRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {group.cycles.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center">
              <Clock3 className="size-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="font-medium">This group has not started yet</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  No payout cycle has been created. Once the treasurer confirms
                  the payout order and start date, the cycle timeline will show
                  up here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {group.cycles.map((cycle) => {
                const recipientName =
                  recipientNames.get(cycle.recipientId) ?? "Unknown recipient";
                const successfulCount = cycle.contributions.filter(
                  (contribution) => contribution.status === "SUCCESS"
                ).length;

                return (
                  <div
                    key={cycle.id}
                    className="rounded-3xl border bg-muted/20 p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            Cycle #{cycle.cycleNumber}
                          </h3>
                          <Badge className={cycleStatusClass(cycle.status)}>
                            {cycle.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Recipient: {recipientName} · Payout date{" "}
                          {formatDate(cycle.payoutDate)}
                        </p>
                      </div>
                      <div className="grid gap-3 text-sm sm:grid-cols-3">
                        <div className="rounded-2xl bg-background px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            Total collected
                          </p>
                          <p className="mt-1 font-semibold">
                            {formatCurrency(cycle.totalCollected)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-background px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            Successful contributions
                          </p>
                          <p className="mt-1 font-semibold">
                            {successfulCount} of {cycle.contributions.length}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-background px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            Last updated
                          </p>
                          <p className="mt-1 font-semibold">
                            {formatDate(cycle.updatedAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-2xl border bg-background">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Member</TableHead>
                            <TableHead>Contribution</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Paid at</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map((member) => {
                            if (member.userId === cycle.recipientId) {
                              return (
                                <TableRow key={`${cycle.id}-${member.userId}`}>
                                  <TableCell className="font-medium">
                                    {member.name}
                                  </TableCell>
                                  <TableCell>Exempt</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className="border-sky-200 bg-sky-50 text-sky-700"
                                    >
                                      Recipient
                                    </Badge>
                                  </TableCell>
                                  <TableCell>Not applicable</TableCell>
                                </TableRow>
                              );
                            }

                            const contribution = cycle.contributions.find(
                              (item) => item.userId === member.userId
                            );

                            return (
                              <TableRow key={`${cycle.id}-${member.userId}`}>
                                <TableCell className="font-medium">
                                  {member.name}
                                </TableCell>
                                <TableCell>
                                  {contribution
                                    ? formatCurrency(contribution.amount)
                                    : "Not created"}
                                </TableCell>
                                <TableCell>
                                  {contribution ? (
                                    <div className="flex items-center gap-2">
                                      {contribution.status === "SUCCESS" ? (
                                        <CheckCircle2 className="size-4 text-emerald-600" />
                                      ) : (
                                        <CircleX className="size-4 text-rose-600" />
                                      )}
                                      <span>{contribution.status}</span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      Pending
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {contribution?.paidAt
                                    ? formatDate(contribution.paidAt)
                                    : "Not paid"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {groupQuery.isRefetching ? (
        <div className="fixed bottom-6 right-6 rounded-full border bg-background px-4 py-2 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoadingSpinner />
            Refreshing group data...
          </div>
        </div>
      ) : null}
    </div>
  );
}
