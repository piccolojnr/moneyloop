"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { toast } from "sonner";

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
  contributionAmount: z.coerce
    .number()
    .positive("Contribution amount must be greater than 0"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
});

type CreateGroupValues = z.infer<typeof createGroupSchema>;

type CreateGroupResponse = {
  id: string;
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

async function fetchGroups() {
  const response = await fetch("/api/groups", {
    credentials: "include",
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | GroupSummary[]
    | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(body, "Failed to load groups"));
  }

  return body as GroupSummary[];
}

async function createGroup(values: CreateGroupValues) {
  const response = await fetch("/api/groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | CreateGroupResponse
    | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(body, "Failed to create group"));
  }

  return body as CreateGroupResponse;
}

function formatCurrency(amount: number) {
  return `GHS ${amount.toFixed(2)}`;
}

function formatFrequency(value: GroupSummary["frequency"]) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function roleBadgeClass(role: GroupSummary["memberRole"]) {
  return role === "TREASURER"
    ? "bg-teal-100 text-teal-700 hover:bg-teal-100"
    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-100";
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

function GroupsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function GroupsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<CreateGroupValues>({
    resolver: standardSchemaResolver(createGroupSchema),
    defaultValues: {
      name: "",
      contributionAmount: undefined,
      frequency: undefined,
    },
  });

  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });

  const createGroupMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: async (group) => {
      toast.success("Group created successfully.");
      setDialogOpen(false);
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      router.push(`/dashboard/groups/${group.id}/setup`);
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Unable to create group.");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My Groups</h1>
          <p className="text-sm text-muted-foreground">
            Create a susu group, invite members, and manage your payout rotation.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create group</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create group</DialogTitle>
              <DialogDescription>
                Start a new MoneyLoop group and define the contribution schedule.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) =>
                  createGroupMutation.mutate(values)
                )}
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
                        <FormLabel>Contribution amount (GHS)</FormLabel>
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
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select frequency" />
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createGroupMutation.isPending}>
                    {createGroupMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <LoadingSpinner />
                        Creating...
                      </span>
                    ) : (
                      "Create group"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <GroupsSkeleton />
      ) : error || !data ? (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle>Unable to load groups</CardTitle>
            <CardDescription>
              {(error as Error | undefined)?.message ??
                "Something went wrong while loading your groups."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              {isRefetching ? "Retrying..." : "Try again"}
            </Button>
          </CardContent>
        </Card>
      ) : data.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <CardTitle>You&apos;re not in any groups yet</CardTitle>
            <CardDescription>
              Create your first group to invite members and start your payout rotation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button type="button" onClick={() => setDialogOpen(true)}>
              Create a group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((group) => (
            <Card key={group.id} className="border-border/80">
              <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{group.name}</CardTitle>
                  <CardDescription>
                    {formatFrequency(group.frequency)} contributions by{" "}
                    {group.treasurerName}
                  </CardDescription>
                </div>
                <Badge className={roleBadgeClass(group.memberRole)}>
                  {group.memberRole === "TREASURER" ? "TREASURER" : "MEMBER"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Contribution</p>
                    <p className="font-medium">
                      {formatCurrency(group.contributionAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Members</p>
                    <p className="font-medium">
                      {group.memberCount} member
                      {group.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current cycle</p>
                    <p className="font-medium">
                      {group.cycle ? `Cycle #${group.cycle.cycleNumber}` : "Not started"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={statusBadgeClass(group.status)}>
                      {group.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href={`/dashboard/groups/${group.id}`}>Manage group</Link>
                  </Button>
                  {!group.cycle && group.memberRole === "TREASURER" ? (
                    <Button asChild variant="outline">
                      <Link href={`/dashboard/groups/${group.id}/setup`}>
                        Set payout order
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default GroupsPage;
