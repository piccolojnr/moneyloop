"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { Copy, MailPlus } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type GroupDetail = {
  id: string;
  name: string;
  contributionAmount: number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  currentCycle: number;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  treasurer: {
    id: string;
    name: string;
    email: string;
  };
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

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => value === undefined || z.email().safeParse(value).success, {
      message: "Enter a valid email address",
    }),
});

type InviteValues = z.infer<typeof inviteSchema>;

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

async function createInvite(groupId: string, values: InviteValues) {
  const response = await fetch(`/api/groups/${groupId}/invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values.email ? { email: values.email } : {}),
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | { inviteUrl: string }
    | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(body, "Failed to create invite"));
  }

  return body as { inviteUrl: string };
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

function formatFrequency(value: GroupDetail["frequency"]) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function memberRoleClass(role: "TREASURER" | "MEMBER") {
  return role === "TREASURER"
    ? "bg-teal-100 text-teal-700 hover:bg-teal-100"
    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-100";
}

function cycleStatusClass(
  status: "PENDING" | "READY" | "PAID" | "FAILED"
) {
  switch (status) {
    case "READY":
      return "bg-sky-100 text-sky-700 hover:bg-sky-100";
    case "PAID":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "FAILED":
      return "bg-red-100 text-red-700 hover:bg-red-100";
    default:
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
  }
}

function GroupDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-10 w-52" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

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
    defaultValues: {
      email: "",
    },
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
          : "Invite link generated successfully."
      );
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Unable to create invite.");
    },
  });

  if (isLoading) {
    return <GroupDetailSkeleton />;
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle>Unable to load group</CardTitle>
          <CardDescription>
            {(error as Error | undefined)?.message ??
              "Something went wrong while loading the group."}
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
    );
  }

  const currentUserId =
    typeof session?.user === "object" && session?.user && "id" in session.user
      ? (session.user.id as string | undefined)
      : undefined;
  const isTreasurer = currentUserId === data.treasurer.id;
  const hasCycles = data.cycles.length > 0;
  const recipientNames = new Map(
    data.members.map((member) => [member.userId, member.name] as const)
  );
  const sortedMembers = [...data.members].sort((left, right) => {
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-2xl">{data.name}</CardTitle>
              <Badge className={memberRoleClass(isTreasurer ? "TREASURER" : "MEMBER")}>
                {isTreasurer ? "TREASURER" : "MEMBER"}
              </Badge>
            </div>
            <CardDescription>
              Managed by {data.treasurer.name}. {formatFrequency(data.frequency)}{" "}
              contributions of {formatCurrency(data.contributionAmount)}.
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-3">
            {isTreasurer && !hasCycles ? (
              <>
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
                    <Button variant="outline">
                      <MailPlus className="mr-2 size-4" />
                      Invite member
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Invite a member</DialogTitle>
                      <DialogDescription>
                        Send a personal invitation or generate an open join link for this
                        group.
                      </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit((values) =>
                          inviteMutation.mutate(values)
                        )}
                        className="space-y-4"
                      >
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="member@example.com"
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <p className="text-sm text-muted-foreground">
                                Leave blank to generate an open link.
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {inviteSentTo ? (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                            Invite sent to {inviteSentTo}.
                          </div>
                        ) : null}

                        {generatedInviteUrl ? (
                          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                            <p className="text-sm font-medium">Open invite link</p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input value={generatedInviteUrl} readOnly />
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(
                                      generatedInviteUrl
                                    );
                                    toast.success("Invite link copied.");
                                  } catch {
                                    toast.error("Unable to copy invite link.");
                                  }
                                }}
                              >
                                <Copy className="mr-2 size-4" />
                                Copy
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        <div className="flex justify-end gap-3 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                          >
                            Close
                          </Button>
                          <Button type="submit" disabled={inviteMutation.isPending}>
                            {inviteMutation.isPending ? (
                              <span className="flex items-center gap-2">
                                <LoadingSpinner />
                                Sending...
                              </span>
                            ) : (
                              "Generate invite"
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>

                <Button asChild>
                  <Link href={`/dashboard/groups/${data.id}/setup`}>Set payout order</Link>
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Members</p>
            <p className="mt-1 text-lg font-medium">
              {data.members.length} member{data.members.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Current cycle</p>
            <p className="mt-1 text-lg font-medium">
              {hasCycles ? `Cycle #${data.cycles[0].cycleNumber}` : "Not started"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Group status</p>
            <p className="mt-1 text-lg font-medium">{data.status}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                Review member details and payout positions for this group.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sortedMembers.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    No members have joined this group yet.
                  </p>
                  {isTreasurer && !hasCycles ? (
                    <Button type="button" onClick={() => setDialogOpen(true)}>
                      Invite your first member
                    </Button>
                  ) : null}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>MoMo</TableHead>
                      <TableHead>Payout Position</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{member.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {member.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{member.momoNumber}</TableCell>
                        <TableCell>
                          {member.payoutPosition === null ? "Not set" : `#${member.payoutPosition}`}
                        </TableCell>
                        <TableCell>
                          <Badge className={memberRoleClass(member.memberRole)}>
                            {member.memberRole}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles">
          <Card>
            <CardHeader>
              <CardTitle>Cycles</CardTitle>
              <CardDescription>
                Track payout cycles, recipients, and collection progress.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.cycles.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    This group has not started its first cycle yet.
                  </p>
                  {isTreasurer ? (
                    <Button asChild>
                      <Link href={`/dashboard/groups/${data.id}/setup`}>
                        Set payout order
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {data.cycles.map((cycle) => (
                    <div
                      key={cycle.id}
                      className="flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-medium">Cycle #{cycle.cycleNumber}</p>
                          <Badge className={cycleStatusClass(cycle.status)}>
                            {cycle.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Recipient:{" "}
                          {recipientNames.get(cycle.recipientId) ?? "Unknown member"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Payout date: {formatDate(cycle.payoutDate)}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-sm text-muted-foreground">Total collected</p>
                        <p className="text-lg font-medium">
                          {formatCurrency(cycle.totalCollected)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default GroupDetailPage;
