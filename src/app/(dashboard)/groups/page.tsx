"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, Plus, Users } from "lucide-react";

import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────

type GroupSummary = {
  id: string;
  name: string;
  contributionAmount: number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  currentCycle: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  memberCount: number;
  treasurerName: string;
  memberRole: "TREASURER" | "MEMBER" | null;
  cycle: {
    id: string;
    cycleNumber: number;
    payoutDate: string;
    status: "PENDING" | "READY" | "PAID" | "FAILED";
    totalCollected: number;
  } | null;
};

const createGroupSchema = z.object({
  name: z.string().min(2, "Group name must be at least 2 characters"),
  contributionAmount: z.coerce.number().positive("Must be greater than 0"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
});

type CreateGroupValues = z.infer<typeof createGroupSchema>;
type CreateGroupResponse = { id: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getErrorMessage(body: unknown, fallback: string) {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

async function fetchGroups() {
  const res = await fetch("/api/groups", { credentials: "include" });
  const body = (await res.json().catch(() => null)) as { error?: string } | GroupSummary[] | null;
  if (!res.ok) throw new Error(getErrorMessage(body, "Failed to load groups"));
  return body as GroupSummary[];
}

async function createGroup(values: CreateGroupValues) {
  const res = await fetch("/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const body = (await res.json().catch(() => null)) as { error?: string } | CreateGroupResponse | null;
  if (!res.ok) throw new Error(getErrorMessage(body, "Failed to create group"));
  return body as CreateGroupResponse;
}

function formatCurrency(amount: number) {
  return `GH₵ ${amount.toFixed(2)}`;
}

function formatFrequency(value: GroupSummary["frequency"]) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function statusConfig(status: GroupSummary["status"]) {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", className: "bg-primary/10 text-primary hover:bg-primary/10" };
    case "PAUSED":
      return { label: "Paused", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" };
    default:
      return { label: "Completed", className: "bg-muted text-muted-foreground hover:bg-muted" };
  }
}

function cycleStatusConfig(status: "PENDING" | "READY" | "PAID" | "FAILED") {
  switch (status) {
    case "READY":
      return { label: "Ready", className: "bg-sky-100 text-sky-700 hover:bg-sky-100" };
    case "PAID":
      return { label: "Paid", className: "bg-primary/10 text-primary hover:bg-primary/10" };
    case "FAILED":
      return { label: "Failed", className: "bg-destructive/10 text-destructive hover:bg-destructive/10" };
    default:
      return { label: "In progress", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" };
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function GroupsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="mb-3 h-6 w-44" />
            <Skeleton className="mb-4 h-4 w-32" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Create group dialog ───────────────────────────────────────────────────────

function CreateGroupDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (id: string) => void;
}) {
  const form = useForm<CreateGroupValues>({
    // Cast needed: z.coerce.number() gives the schema an input type of `unknown`
    // which conflicts with the output type `number` that RHF expects.
    resolver: standardSchemaResolver(createGroupSchema) as Resolver<CreateGroupValues>,
    defaultValues: { name: "", contributionAmount: undefined, frequency: undefined },
  });

  const mutation = useMutation({
    mutationFn: createGroup,
    onSuccess: (group) => {
      toast.success("Group created.");
      form.reset();
      onOpenChange(false);
      onSuccess(group.id);
    },
    onError: (err: Error) => toast.error(err.message || "Unable to create group."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Define the contribution schedule for your susu group.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group name</FormLabel>
                  <FormControl>
                    <Input placeholder="Sunday Savings Circle" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="contributionAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (GHS)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="250"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <LoadingSpinner /> : null}
                {mutation.isPending ? "Creating…" : "Create group"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Group card ────────────────────────────────────────────────────────────────

function GroupCard({
  group,
  onCreateGroup,
}: {
  group: GroupSummary;
  onCreateGroup: () => void;
}) {
  const status = statusConfig(group.status);
  const isTreasurer = group.memberRole === "TREASURER";

  const activeCycleNum = group.cycle?.cycleNumber ?? 0;
  const totalSlots = Math.min(group.memberCount, 16);
  const overflow = group.memberCount > 16 ? group.memberCount - 16 : 0;

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{group.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatFrequency(group.frequency)} · by {group.treasurerName}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge className={status.className}>{status.label}</Badge>
            {isTreasurer && (
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10 text-[10px]">
                Treasurer
              </Badge>
            )}
          </div>
        </div>

        {/* Segmented cycle tracker — one segment per member/cycle slot */}
        <div className="mb-4 space-y-1.5">
          <div className="flex gap-0.5">
            {Array.from({ length: totalSlots }).map((_, i) => {
              const n = i + 1;
              const done = n < activeCycleNum;
              const current = n === activeCycleNum;
              return (
                <div
                  key={i}
                  className={[
                    "h-1.5 flex-1 rounded-full transition-colors",
                    done ? "bg-primary" :
                    current ? "bg-primary/35" :
                    "bg-muted",
                  ].join(" ")}
                />
              );
            })}
            {overflow > 0 && (
              <span className="ml-1 text-[10px] text-muted-foreground">+{overflow}</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {activeCycleNum > 0
              ? `Cycle ${activeCycleNum} of ${group.memberCount}`
              : "Not started yet"}
          </p>
        </div>

        {/* Stats grid */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-muted/50 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Contribution</p>
            <p className="mt-0.5 text-sm font-semibold">
              {formatCurrency(group.contributionAmount)}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Members</p>
            <p className="mt-0.5 text-sm font-semibold">{group.memberCount}</p>
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Cycle status</p>
            {group.cycle ? (
              <Badge
                className={`mt-0.5 text-[10px] ${cycleStatusConfig(group.cycle.status).className}`}
              >
                {cycleStatusConfig(group.cycle.status).label}
              </Badge>
            ) : (
              <p className="mt-0.5 text-sm font-semibold text-muted-foreground">–</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link href={`/groups/${group.id}`}>
              Manage
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
          {!group.cycle && isTreasurer && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/groups/${group.id}/setup`}>Set payout order</Link>
            </Button>
          )}
        </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function GroupsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  async function handleGroupCreated(id: string) {
    await queryClient.invalidateQueries({ queryKey: ["groups"] });
    router.push(`/groups/${id}/setup`);
  }

  if (isLoading) return <GroupsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage your susu groups.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New group
        </Button>
      </div>

      <CreateGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleGroupCreated}
      />

      {/* Error */}
      {(error || !data) && (
        <Card className="border-destructive/20 p-6">
          <p className="font-semibold text-destructive">Unable to load groups</p>
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
      )}

      {/* Empty state */}
      {data && data.length === 0 && (
        <Card className="border-dashed p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">No groups yet</h3>
              <p className="text-sm text-muted-foreground">
                Create your first group to start managing contributions.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create a group
            </Button>
          </div>
        </Card>
      )}

      {/* Group cards */}
      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onCreateGroup={() => setDialogOpen(true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default GroupsPage;
