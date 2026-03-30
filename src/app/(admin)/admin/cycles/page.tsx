"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

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
  currentCycle: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  createdAt: string;
  memberCount: number;
  cycle: {
    id: string;
    cycleNumber: number;
    payoutDate: string;
    status: "PENDING" | "READY" | "PAID" | "FAILED";
    totalCollected: number;
  } | null;
};

type GroupDetail = {
  id: string;
  name: string;
  contributionAmount: number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  currentCycle: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  members: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    phone: string;
    momoNumber: string;
    payoutPosition: number;
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

const createGroupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  contributionAmount: z.coerce
    .number()
    .positive("Contribution amount must be greater than 0"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
});

const startGroupSchema = z.object({
  payoutDate: z.string().min(1, "Select a payout date"),
});

type CreateGroupValues = z.infer<typeof createGroupSchema>;
type StartGroupValues = z.infer<typeof startGroupSchema>;

async function fetchGroups() {
  const response = await fetch("/api/groups", { credentials: "include" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "Failed to load groups");
  }
  return (await response.json()) as GroupSummary[];
}

async function fetchGroupDetail(groupId: string) {
  const response = await fetch(`/api/groups/${groupId}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "Failed to load cycle details");
  }
  return (await response.json()) as GroupDetail;
}

async function createGroup(values: CreateGroupValues) {
  const response = await fetch("/api/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | GroupSummary
    | null;
  if (!response.ok) {
    throw new Error(
      typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
        ? body.error
        : "Failed to create group"
    );
  }
  return body as GroupSummary;
}

async function startGroup({
  groupId,
  values,
}: {
  groupId: string;
  values: StartGroupValues;
}) {
  const response = await fetch(`/api/groups/${groupId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | object
    | null;
  if (!response.ok) {
    throw new Error(
      typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof body.error === "string"
        ? body.error
        : "Failed to start group"
    );
  }
  return body;
}

function formatCurrency(amount: number) {
  return `GHS ${amount.toFixed(2)}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not paid yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function groupStatusClass(status: GroupSummary["status"]) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "PAUSED":
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
    default:
      return "bg-zinc-100 text-zinc-700 hover:bg-zinc-100";
  }
}

function contributionStatusIcon(status: "PENDING" | "SUCCESS" | "FAILED" | "MISSING") {
  if (status === "SUCCESS") {
    return <CheckCircle2 className="size-4 text-emerald-600" />;
  }

  return <XCircle className="size-4 text-red-500" />;
}

function GroupsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MatrixSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-52" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminCyclesPage() {
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [startDialogGroup, setStartDialogGroup] = useState<GroupSummary | null>(null);

  const createForm = useForm<CreateGroupValues>({
    resolver: standardSchemaResolver(createGroupSchema),
    defaultValues: {
      name: "",
      contributionAmount: 0,
      frequency: undefined,
    },
  });

  const startForm = useForm<StartGroupValues>({
    resolver: standardSchemaResolver(startGroupSchema),
    defaultValues: {
      payoutDate: "",
    },
  });

  const { data: groups, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: fetchGroups,
  });

  const { data: selectedGroupDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ["admin-group-detail", selectedGroupId],
    queryFn: () => fetchGroupDetail(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  const createGroupMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: async () => {
      toast.success("Group created successfully.");
      setCreateDialogOpen(false);
      createForm.reset();
      await queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Unable to create group.");
    },
  });

  const startGroupMutation = useMutation({
    mutationFn: startGroup,
    onSuccess: async () => {
      toast.success("Group started successfully.");
      const activeGroupId = startDialogGroup?.id ?? selectedGroupId;
      setStartDialogGroup(null);
      startForm.reset();
      await queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
      if (activeGroupId) {
        setSelectedGroupId(activeGroupId);
        await queryClient.invalidateQueries({
          queryKey: ["admin-group-detail", activeGroupId],
        });
      }
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Unable to start group.");
    },
  });

  const selectedCycle = useMemo(() => {
    if (!selectedGroupDetail) {
      return null;
    }

    return (
      selectedGroupDetail.cycles.find(
        (cycle) => cycle.cycleNumber === selectedGroupDetail.currentCycle
      ) ??
      selectedGroupDetail.cycles[selectedGroupDetail.cycles.length - 1] ??
      null
    );
  }, [selectedGroupDetail]);

  const matrixRows = useMemo(() => {
    if (!selectedGroupDetail) {
      return [];
    }

    return selectedGroupDetail.members.map((member) => {
      const contribution =
        selectedCycle?.contributions.find(
          (entry) => entry.userId === member.userId
        ) ?? null;

      return { member, contribution };
    });
  }, [selectedCycle, selectedGroupDetail]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-muted-foreground">
            Create groups, start cycles, and monitor contributions at a glance.
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create Group</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create group</DialogTitle>
              <DialogDescription>
                Define the contribution amount and payout frequency.
              </DialogDescription>
            </DialogHeader>

            <Form {...createForm}>
              <form
                onSubmit={createForm.handleSubmit((values) =>
                  createGroupMutation.mutate(values)
                )}
                className="space-y-4"
              >
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Accra Market Circle" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="contributionAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contribution amount (GHS)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="100"
                          {...field}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createGroupMutation.isPending}>
                    {createGroupMutation.isPending ? "Creating..." : "Create group"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <GroupsSkeleton />
      ) : error || !groups ? (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle>Unable to load groups</CardTitle>
            <CardDescription>
              {(error as Error | undefined)?.message ??
                "Something went wrong while loading groups."}
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
      ) : groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No groups yet</CardTitle>
            <CardDescription>
              Create your first group to begin planning cycles and payouts.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="h-full">
              <CardHeader>
                <CardDescription>{group.frequency}</CardDescription>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{group.name}</CardTitle>
                  <Badge className={groupStatusClass(group.status)}>
                    {group.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Contribution</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(group.contributionAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Members</span>
                    <span className="font-medium text-foreground">
                      {group.memberCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Current cycle</span>
                    <span className="font-medium text-foreground">
                      {group.cycle ? `#${group.cycle.cycleNumber}` : "Not started"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant={selectedGroupId === group.id ? "secondary" : "outline"}
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    View cycle details
                  </Button>
                  {!group.cycle ? (
                    <Button
                      type="button"
                      onClick={() => {
                        setStartDialogGroup(group);
                        startForm.reset({ payoutDate: "" });
                      }}
                    >
                      Start group
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!startDialogGroup}
        onOpenChange={(open) => {
          if (!open) {
            setStartDialogGroup(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start group</DialogTitle>
            <DialogDescription>
              Choose the first payout date for {startDialogGroup?.name ?? "this group"}.
            </DialogDescription>
          </DialogHeader>

          <Form {...startForm}>
            <form
              onSubmit={startForm.handleSubmit((values) => {
                if (!startDialogGroup) {
                  return;
                }

                startGroupMutation.mutate({
                  groupId: startDialogGroup.id,
                  values,
                });
              })}
              className="space-y-4"
            >
              <FormField
                control={startForm.control}
                name="payoutDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First payout date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStartDialogGroup(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={startGroupMutation.isPending}>
                  {startGroupMutation.isPending ? "Starting..." : "Start group"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {selectedGroupId ? (
        isLoadingDetail ? (
          <MatrixSkeleton />
        ) : !selectedGroupDetail ? null : (
          <Card>
            <CardHeader>
              <CardDescription>{selectedGroupDetail.name}</CardDescription>
              <CardTitle>
                {selectedCycle
                  ? `Cycle #${selectedCycle.cycleNumber} contribution matrix`
                  : "No cycles started yet"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedCycle ? (
                <p className="text-sm text-muted-foreground">
                  This group has not started its first cycle yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contributed</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Paid At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixRows.map(({ member, contribution }) => {
                      const contributionStatus =
                        contribution?.status ?? "MISSING";

                      return (
                        <TableRow key={member.id}>
                          <TableCell>#{member.payoutPosition}</TableCell>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {contributionStatusIcon(contributionStatus)}
                              <span className="text-sm">
                                {contribution?.status === "SUCCESS" ? "Yes" : "No"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatCurrency(
                              contribution?.amount ?? selectedGroupDetail.contributionAmount
                            )}
                          </TableCell>
                          <TableCell>{formatDate(contribution?.paidAt ?? null)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}
