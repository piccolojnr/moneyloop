"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Shuffle } from "lucide-react";
import { toast } from "sonner";

import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type GroupSetupDetail = {
  id: string;
  name: string;
  treasurerId: string;
  contributionAmount: number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  treasurer: {
    id: string;
    name: string;
  };
  members: Array<{
    id: string;
    userId: string;
    name: string;
    payoutPosition: number | null;
    memberRole: "TREASURER" | "MEMBER";
  }>;
  cycles: Array<{
    id: string;
  }>;
};

type OrderedMember = GroupSetupDetail["members"][number];

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
    | GroupSetupDetail
    | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(body, "Failed to load group"));
  }

  return body as GroupSetupDetail;
}

async function saveOrderAndStartCycle({
  groupId,
  positions,
  payoutDate,
}: {
  groupId: string;
  positions: Array<{ userId: string; payoutPosition: number }>;
  payoutDate: string;
}) {
  const positionsResponse = await fetch(`/api/groups/${groupId}/members`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ positions }),
  });

  const positionsBody = (await positionsResponse.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!positionsResponse.ok) {
    throw new Error(
      getErrorMessage(positionsBody, "Failed to save payout order"),
    );
  }

  const startResponse = await fetch(`/api/groups/${groupId}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payoutDate }),
  });

  const startBody = (await startResponse.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!startResponse.ok) {
    throw new Error(getErrorMessage(startBody, "Failed to start cycle"));
  }
}

function sortMembers(members: OrderedMember[]) {
  return [...members].sort((left, right) => {
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
}

function shuffleMembers(members: OrderedMember[]) {
  const next = [...members];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  return next;
}

function addFrequency(
  date: Date,
  frequency: GroupSetupDetail["frequency"],
  step: number,
) {
  const next = new Date(date);

  if (frequency === "DAILY") {
    next.setDate(next.getDate() + step);
    return next;
  }

  if (frequency === "WEEKLY") {
    next.setDate(next.getDate() + step * 7);
    return next;
  }

  next.setMonth(next.getMonth() + step);
  return next;
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function SetupSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SortableMemberRow({
  member,
  index,
}: {
  member: OrderedMember;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: member.userId });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="flex items-center justify-between rounded-xl border bg-background px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
          {index + 1}
        </span>
        <span className="font-medium">{member.name}</span>
      </div>

      <button
        type="button"
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
    </div>
  );
}

export function GroupSetupPage() {
  const params = useParams<{ id: string }>();
  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<"random" | "manual" | null>(null);
  const [orderedMembers, setOrderedMembers] = useState<OrderedMember[] | null>(
    null,
  );
  const [payoutDate, setPayoutDate] = useState("");

  const { data, error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => fetchGroup(groupId),
    enabled: Boolean(groupId),
  });

  const currentUserId =
    typeof session?.user === "object" && session?.user && "id" in session.user
      ? (session.user.id as string | undefined)
      : undefined;
  const isTreasurer =
    currentUserId && data ? currentUserId === data.treasurerId : false;
  const hasCycles = (data?.cycles.length ?? 0) > 0;
  const resolvedOrderedMembers = useMemo(
    () => orderedMembers ?? (data ? sortMembers(data.members) : []),
    [data, orderedMembers],
  );

  useEffect(() => {
    if (!data || sessionStatus === "loading") {
      return;
    }

    if (hasCycles || !isTreasurer) {
      router.replace(`/groups/${groupId}`);
    }
  }, [data, groupId, hasCycles, isTreasurer, router, sessionStatus]);

  const startMutation = useMutation({
    mutationFn: saveOrderAndStartCycle,
    onSuccess: async () => {
      toast.success("Payout order saved and first cycle started.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
        queryClient.invalidateQueries({ queryKey: ["group", groupId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
      router.push(`/groups/${groupId}`);
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Unable to start the first cycle.");
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const expectedDates = useMemo(() => {
    if (!payoutDate) {
      return resolvedOrderedMembers.map(() => null);
    }

    const startDate = new Date(`${payoutDate}T00:00:00`);

    return resolvedOrderedMembers.map((_, index) =>
      addFrequency(startDate, data?.frequency ?? "MONTHLY", index),
    );
  }, [data?.frequency, payoutDate, resolvedOrderedMembers]);

  if (isLoading || sessionStatus === "loading") {
    return <SetupSkeleton />;
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle>Unable to load setup</CardTitle>
          <CardDescription>
            {(error as Error | undefined)?.message ??
              "Something went wrong while loading this setup flow."}
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

  if (!isTreasurer || hasCycles) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Redirecting to group details</CardTitle>
          <CardDescription>
            This setup flow is only available to the group treasurer before the
            first cycle starts.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data || data.members.length < 2) {
    return (
      <Card className="max-w-2xl border-amber-200 bg-amber-50/60">
        <CardHeader>
          <CardTitle>You need at least 2 members before starting</CardTitle>
          <CardDescription>
            Invite more members first, then come back to set the payout order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/groups/${groupId}`}>Back to group</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canContinue = mode !== null && resolvedOrderedMembers.length > 0;

  function handleRandomize() {
    if (!data) {
      return;
    }
    const shuffled = shuffleMembers(sortMembers(data.members));
    setMode("random");
    setOrderedMembers(shuffled);
  }

  function handleManualMode() {
    if (!data) {
      return;
    }
    setMode("manual");
    setOrderedMembers((current) =>
      current && current.length > 0 ? current : sortMembers(data.members),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!data) {
      return;
    }
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setOrderedMembers((current) => {
      const members = current ?? sortMembers(data.members);
      const oldIndex = members.findIndex(
        (member) => member.userId === active.id,
      );
      const newIndex = members.findIndex((member) => member.userId === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return members;
      }

      return arrayMove(members, oldIndex, newIndex);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={step === 1 ? "border-primary" : ""}>
          <CardHeader>
            <CardDescription>Step 1</CardDescription>
            <CardTitle>Order</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Choose how you want to arrange the payout order.
            </p>
          </CardContent>
        </Card>

        <Card className={step === 2 ? "border-primary" : ""}>
          <CardHeader>
            <CardDescription>Step 2</CardDescription>
            <CardTitle>Confirm</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Review the final order and start the first cycle.
            </p>
          </CardContent>
        </Card>
      </div>

      {step === 1 ? (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className={mode === "random" ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle>Randomize</CardTitle>
                <CardDescription>
                  Let MoneyLoop shuffle the current members into a fair order.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button type="button" onClick={handleRandomize}>
                  <Shuffle className="mr-2 size-4" />
                  {mode === "random" ? "Re-randomize" : "Randomize order"}
                </Button>
              </CardContent>
            </Card>

            <Card className={mode === "manual" ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle>Manual</CardTitle>
                <CardDescription>
                  Drag members into the payout order you want to use for this
                  group.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleManualMode}
                >
                  Arrange manually
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resulting order</CardTitle>
              <CardDescription>
                This order is only saved once you confirm on the next step.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "manual" ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={resolvedOrderedMembers.map(
                      (member) => member.userId,
                    )}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {resolvedOrderedMembers.map((member, index) => (
                        <SortableMemberRow
                          key={member.userId}
                          member={member}
                          index={index}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : resolvedOrderedMembers.length > 0 ? (
                <div className="space-y-3">
                  {resolvedOrderedMembers.map((member, index) => (
                    <div
                      key={member.userId}
                      className="flex items-center gap-3 rounded-xl border px-4 py-3"
                    >
                      <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="font-medium">{member.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Choose randomize or manual ordering to generate the payout
                  list.
                </p>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => setStep(2)}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Confirm payout order</CardTitle>
            <CardDescription>
              Review the order below and choose the first payout date for{" "}
              {data.name}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              {resolvedOrderedMembers.map((member, index) => (
                <div
                  key={member.userId}
                  className="grid gap-3 rounded-xl border px-4 py-3 md:grid-cols-[96px_1fr_180px]"
                >
                  <div>
                    <p className="text-sm text-muted-foreground">Position</p>
                    <p className="font-medium">#{index + 1}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{member.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Expected payout date
                    </p>
                    <p className="font-medium">
                      {expectedDates[index]
                        ? formatDate(expectedDates[index] as Date)
                        : "Choose a date below"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="max-w-sm space-y-2">
              <label
                htmlFor="first-payout-date"
                className="text-sm font-medium"
              >
                First payout date
              </label>
              <Input
                id="first-payout-date"
                type="date"
                value={payoutDate}
                onChange={(event) => setPayoutDate(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={!payoutDate || startMutation.isPending}
                onClick={() =>
                  startMutation.mutate({
                    groupId,
                    payoutDate,
                    positions: resolvedOrderedMembers.map((member, index) => ({
                      userId: member.userId,
                      payoutPosition: index + 1,
                    })),
                  })
                }
              >
                {startMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner />
                    Starting...
                  </span>
                ) : (
                  "Confirm order & start cycle"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default GroupSetupPage;
