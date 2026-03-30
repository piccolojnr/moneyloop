"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";

type InvitePreview =
  | {
      valid: true;
      groupName: string;
      treasurerName: string;
      contributionAmount: number;
      frequency: string;
      memberCount: number;
    }
  | {
      valid: false;
      reason: "expired" | "already_used" | "not_found";
    };

async function fetchInvite(token: string) {
  const response = await fetch(`/api/invite/${token}`);
  if (!response.ok) {
    throw new Error("Failed to validate invitation");
  }

  return (await response.json()) as InvitePreview;
}

async function acceptInvite(token: string) {
  const response = await fetch(`/api/invite/${token}/accept`, {
    method: "POST",
    credentials: "include",
  });

  const body = (await response.json().catch(() => null)) as
    | { groupId?: string; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(body?.error ?? "Failed to accept invitation");
  }

  return body as { groupId: string };
}

function InviteSkeleton() {
  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-10 w-40" />
      </CardContent>
    </Card>
  );
}

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { status: sessionStatus } = useSession();

  const callbackUrl = useMemo(
    () => (token ? `/join?token=${encodeURIComponent(token)}` : "/join"),
    [token]
  );

  const inviteQuery = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => fetchInvite(token!),
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptInvite(token!),
    onSuccess: () => {
      toast.success("Invitation accepted. Welcome to the group.");
      router.push("/dashboard");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const content = (() => {
    if (!token) {
      return (
        <Card className="w-full max-w-xl">
          <CardHeader className="text-center">
            <CardDescription>Invitation required</CardDescription>
            <CardTitle>No invitation token found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Open a valid MoneyLoop invitation link to preview and join a group.
            </p>
            <Button asChild variant="outline">
              <Link href="/register">Create account</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (inviteQuery.isLoading) {
      return <InviteSkeleton />;
    }

    if (inviteQuery.error || !inviteQuery.data) {
      return (
        <Card className="w-full max-w-xl border-destructive/20">
          <CardHeader className="text-center">
            <CardDescription>Invitation error</CardDescription>
            <CardTitle>We couldn&apos;t load this invitation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Try opening the link again or ask the group treasurer for a fresh invite.
            </p>
            <Button asChild variant="outline">
              <Link href="/register">Create account</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!inviteQuery.data.valid) {
      const reasonMessage =
        inviteQuery.data.reason === "expired"
          ? "This invitation has expired."
          : inviteQuery.data.reason === "already_used"
            ? "This invitation has already been used."
            : "This invitation link was not found.";

      return (
        <Card className="w-full max-w-xl">
          <CardHeader className="text-center">
            <CardDescription>Invitation unavailable</CardDescription>
            <CardTitle>{reasonMessage}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              You can register for MoneyLoop and request a new invite from the group treasurer.
            </p>
            <Button asChild variant="outline">
              <Link href="/register">Go to registration</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    const handleJoin = () => {
      if (sessionStatus !== "authenticated") {
        router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }

      acceptMutation.mutate();
    };

    return (
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardDescription>Group invitation</CardDescription>
          <CardTitle>Join {inviteQuery.data.groupName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-4">
              <span>Treasurer</span>
              <span className="font-medium text-foreground">
                {inviteQuery.data.treasurerName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Contribution amount</span>
              <span className="font-medium text-foreground">
                GHS {inviteQuery.data.contributionAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Frequency</span>
              <span className="font-medium text-foreground">
                {inviteQuery.data.frequency}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Current member count</span>
              <span className="font-medium text-foreground">
                {inviteQuery.data.memberCount}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleJoin} disabled={acceptMutation.isPending}>
              {acceptMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  Joining...
                </span>
              ) : (
                `Join ${inviteQuery.data.groupName}`
              )}
            </Button>
            <Button asChild variant="outline">
              <Link href="/register">Create account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 px-6 py-12">
      {content}
    </div>
  );
}
