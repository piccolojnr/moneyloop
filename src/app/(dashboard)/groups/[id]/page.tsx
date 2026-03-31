"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { Copy, MailPlus, ArrowLeft, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Types ─────────────────────────────────────────────────────────────────────

type GroupDetail = {
  id: string;
  name: string;
  treasurerId: string;
  contributionAmount: number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  currentCycle: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  treasurer: { id: string; name: string; email: string };
  members: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    phone: string;
    momoNumber: string;
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
  }>;
};

// Keep the field as a plain string (empty string = no email).
// Avoiding .optional() + .transform() prevents the input/output type split
// that breaks standardSchemaResolver's Resolver<T> inference.
const inviteSchema = z.object({
  email: z
    .string()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, {
      message: "Enter a valid email address",
    }),
});

type InviteValues = z.infer<typeof inviteSchema>; // { email: string }

// ── Fetchers ──────────────────────────────────────────────────────────────────

function getErrorMessage(body: unknown, fallback: string) {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

async function fetchGroup(groupId: string) {
  const res = await fetch(`/api/groups/${groupId}`, { credentials: "include" });
  const body = (await res.json().catch(() => null)) as { error?: string } | GroupDetail | null;
  if (!res.ok) throw new Error(getErrorMessage(body, "Failed to load group"));
  return body as GroupDetail;
}

async function createInvite(groupId: string, values: InviteValues) {
  const res = await fetch(`/api/groups/${groupId}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values.email ? { email: values.email } : {}),
  });
  const body = (await res.json().catch(() => null)) as { error?: string } | { inviteUrl: string } | null;
  if (!res.ok) throw new Error(getErrorMessage(body, "Failed to create invite"));
  return body as { inviteUrl: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(amount: number) {
  return `GH₵ ${amount.toFixed(2)}`;
}

function formatFrequency(value: GroupDetail["frequency"]) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function cycleStatusConfig(status: "PENDING" | "READY" | "PAID" | "FAILED") {
  switch (status) {
    case "READY":
      return { label: "Ready", icon: Clock, className: "bg-sky-100 text-sky-700" };
    case "PAID":
      return { label: "Paid", icon: CheckCircle2, className: "bg-primary/10 text-primary" };
    case "FAILED":
      return { label: "Failed", icon: AlertCircle, className: "bg-destructive/10 text-destructive" };
    default:
      return { label: "In progress", icon: Clock, className: "bg-amber-100 text-amber-700" };
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function GroupDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-64 rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null);

  const form = useForm<InviteValues>({
    resolver: standardSchemaResolver(inviteSchema),
    defaultValues: { email: "" },
  });

  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup(groupId),
    enabled: Boolean(groupId),
  });

  const inviteMutation = useMutation({
    mutationFn: (values: InviteValues) => createInvite(groupId, values),
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      setGeneratedInviteUrl(variables.email ? null : result.inviteUrl);
      setInviteSentTo(variables.email ?? null);
      form.reset({ email: "" });
      toast.success(
        variables.email
          ? `Invite sent to ${variables.email}.`
          : "Invite link generated."
      );
    },
    onError: (err: Error) => toast.error(err.message || "Unable to create invite."),
  });

  if (isLoading) return <GroupDetailSkeleton />;

  if (error || !data) {
    return (
      <Card className="border-destructive/20 p-6">
        <p className="font-semibold text-destructive">Unable to load group</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {(error as Error | undefined)?.message ?? "Something went wrong."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? "Retrying…" : "Try again"}
        </Button>
      </Card>
    );
  }

  const currentUserId =
    typeof session?.user === "object" && session?.user && "id" in session.user
      ? (session.user.id as string | undefined)
      : undefined;
  const currentUserRole =
    typeof session?.user === "object" && session?.user && "role" in session.user
      ? (session.user.role as string | undefined)
      : undefined;

  const isTreasurer = currentUserId === data.treasurerId;
  const isPlatformAdmin = currentUserRole === "ADMIN";
  const hasCycles = data.cycles.length > 0;
  const recipientNames = new Map(data.members.map((m) => [m.userId, m.name] as const));

  const sortedMembers = [...data.members].sort((a, b) => {
    if (a.payoutPosition === null && b.payoutPosition === null) return a.name.localeCompare(b.name);
    if (a.payoutPosition === null) return 1;
    if (b.payoutPosition === null) return -1;
    return a.payoutPosition - b.payoutPosition;
  });

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground" asChild>
          <Link href="/groups">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            My groups
          </Link>
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
              <Badge
                className={
                  isTreasurer
                    ? "bg-primary/10 text-primary hover:bg-primary/10"
                    : isPlatformAdmin
                      ? "bg-violet-100 text-violet-700 hover:bg-violet-100"
                      : "bg-muted text-muted-foreground hover:bg-muted"
                }
              >
                {isTreasurer ? "Treasurer" : isPlatformAdmin ? "Admin view" : "Member"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Managed by {data.treasurer.name} · {formatFrequency(data.frequency)}{" "}
              contributions of {formatCurrency(data.contributionAmount)}
            </p>
          </div>

          {/* Treasurer actions */}
          {isTreasurer && !hasCycles && (
            <div className="flex flex-wrap gap-2">
              <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) {
                    setGeneratedInviteUrl(null);
                    setInviteSentTo(null);
                    form.reset({ email: "" });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MailPlus className="mr-2 h-4 w-4" />
                    Invite member
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Invite a member</DialogTitle>
                    <DialogDescription>
                      Send a personal invite or generate an open link.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit((v) => inviteMutation.mutate(v))}
                      className="space-y-4"
                    >
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email (optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="member@example.com"
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Leave blank to generate an open link.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {inviteSentTo && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                          Invite sent to {inviteSentTo}.
                        </div>
                      )}

                      {generatedInviteUrl && (
                        <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
                          <p className="text-xs font-medium">Open invite link</p>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input value={generatedInviteUrl} readOnly className="text-xs" />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(generatedInviteUrl);
                                  toast.success("Copied to clipboard.");
                                } catch {
                                  toast.error("Unable to copy.");
                                }
                              }}
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                              Copy
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                          Close
                        </Button>
                        <Button type="submit" disabled={inviteMutation.isPending}>
                          {inviteMutation.isPending ? <LoadingSpinner /> : null}
                          {inviteMutation.isPending ? "Sending…" : "Generate invite"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <Button size="sm" asChild>
                <Link href={`/groups/${data.id}/setup`}>Set payout order</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Members", value: `${data.members.length}` },
          {
            label: "Current cycle",
            value: hasCycles ? `Cycle #${data.cycles[0].cycleNumber}` : "Not started",
          },
          { label: "Group status", value: data.status },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-card p-4 ring-1 ring-border">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="members" className="flex-1 sm:flex-none">
            Members ({sortedMembers.length})
          </TabsTrigger>
          <TabsTrigger value="cycles" className="flex-1 sm:flex-none">
            Cycles ({data.cycles.length})
          </TabsTrigger>
        </TabsList>

        {/* Members tab */}
        <TabsContent value="members" className="mt-4">
          {sortedMembers.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center">
              <p className="text-sm text-muted-foreground">No members yet.</p>
              {isTreasurer && !hasCycles && (
                <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
                  Invite first member
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5"
                >
                  {/* Position badge */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {member.payoutPosition ?? "–"}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>

                  {/* MoMo — hidden on small screens */}
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    {member.momoNumber}
                  </p>

                  {/* Role badge */}
                  <Badge
                    className={
                      member.memberRole === "TREASURER"
                        ? "bg-primary/10 text-primary hover:bg-primary/10 shrink-0"
                        : "bg-muted text-muted-foreground hover:bg-muted shrink-0"
                    }
                  >
                    {member.memberRole === "TREASURER" ? "Treasurer" : "Member"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Cycles tab */}
        <TabsContent value="cycles" className="mt-4">
          {data.cycles.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed text-center">
              <p className="text-sm text-muted-foreground">
                No cycles started yet.
              </p>
              {isTreasurer && (
                <Button size="sm" asChild>
                  <Link href={`/groups/${data.id}/setup`}>Set payout order</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {data.cycles.map((cycle) => {
                const cfg = cycleStatusConfig(cycle.status);
                const CfgIcon = cfg.icon;
                return (
                  <div
                    key={cycle.id}
                    className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.className.split(" ")[0]}`}>
                        <CfgIcon className={`h-3.5 w-3.5 ${cfg.className.split(" ")[1]}`} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">
                            Cycle #{cycle.cycleNumber}
                          </p>
                          <Badge className={`${cfg.className} hover:${cfg.className.split(" ")[0]} text-[11px]`}>
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {recipientNames.get(cycle.recipientId) ?? "Unknown"} · Payout{" "}
                          {formatDate(cycle.payoutDate)}
                        </p>
                      </div>
                    </div>
                    <div className="pl-10 sm:pl-0 sm:text-right">
                      <p className="text-[11px] text-muted-foreground">Collected</p>
                      <p className="text-base font-bold text-primary">
                        {formatCurrency(cycle.totalCollected)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default GroupDetailPage;
