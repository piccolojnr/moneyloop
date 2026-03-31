"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Users } from "lucide-react";

import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type InvitePreview =
  | {
      valid: true;
      groupName: string;
      treasurerName: string;
      contributionAmount: number;
      frequency: string;
      memberCount: number;
      requiresEmail: boolean;
      targetEmailMasked: string | null;
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
    const err = new Error(body?.error ?? "Failed to accept invitation");
    (err as Error & { status: number }).status = response.status;
    throw err;
  }

  return body as { groupId: string };
}

function PageSkeleton() {
  return (
    <div className="w-full max-w-lg space-y-4">
      <Skeleton className="h-6 w-40 mx-auto" />
      <div className="rounded-2xl border bg-card p-6 shadow-lg space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-56" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-10 w-32 mt-2" />
      </div>
    </div>
  );
}

function ErrorCard({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="w-full max-w-lg rounded-2xl border border-destructive/20 bg-card p-8 shadow-lg text-center space-y-3">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Invitation unavailable
      </p>
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="mt-2">
        <Link href="/register">Create account</Link>
      </Button>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { data: session, status: sessionStatus } = useSession();
  const [acceptError, setAcceptError] = useState<string | null>(null);

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
    onSuccess: ({ groupId }) => {
      router.push(`/groups/${groupId}`);
    },
    onError: (error: Error) => {
      setAcceptError(error.message);
    },
  });

  const currentUserEmail =
    session?.user && "email" in session.user
      ? (session.user.email as string | undefined)
      : undefined;
  const currentUserName =
    session?.user && "name" in session.user
      ? (session.user.name as string | undefined)
      : undefined;

  let content: React.ReactNode;

  if (!token) {
    content = (
      <ErrorCard
        title="No invitation token found"
        message="Open a valid MoneyLoop invitation link to preview and join a group."
      />
    );
  } else if (inviteQuery.isLoading) {
    content = <PageSkeleton />;
  } else if (inviteQuery.error || !inviteQuery.data) {
    content = (
      <ErrorCard
        title="Couldn't load this invitation"
        message="Try opening the link again or ask the group treasurer for a fresh invite."
      />
    );
  } else if (!inviteQuery.data.valid) {
    const { reason } = inviteQuery.data;
    const title =
      reason === "expired"
        ? "This invitation has expired"
        : reason === "already_used"
          ? "This invitation has already been used"
          : "Invitation not found";
    const message =
      reason === "expired"
        ? "Ask the group treasurer to send you a fresh invite."
        : reason === "already_used"
          ? "This invite link has already been accepted. Ask the treasurer for a new one."
          : "This invite link was not found. Check the link and try again.";
    content = <ErrorCard title={title} message={message} />;
  } else {
    const invite = inviteQuery.data;

    if (sessionStatus === "loading") {
      content = <PageSkeleton />;
    } else if (sessionStatus === "unauthenticated") {
      content = (
        <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-lg space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">
              Group invitation
            </p>
            <h1 className="text-2xl font-bold">Join {invite.groupName}</h1>
          </div>

          <div className="rounded-xl bg-muted/50 px-4 py-1 divide-y divide-border/60">
            <StatRow label="Treasurer" value={invite.treasurerName} />
            <StatRow
              label="Contribution"
              value={`GH₵ ${invite.contributionAmount.toFixed(2)}`}
            />
            <StatRow
              label="Frequency"
              value={
                invite.frequency.charAt(0) +
                invite.frequency.slice(1).toLowerCase()
              }
            />
            <StatRow
              label="Members"
              value={String(invite.memberCount)}
            />
          </div>

          {invite.requiresEmail && invite.targetEmailMasked && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This invite is for{" "}
                <strong>{invite.targetEmailMasked}</strong>. Sign in with
                that account to accept.
              </span>
            </div>
          )}

          {!invite.requiresEmail && (
            <p className="text-sm text-muted-foreground">
              Sign in or create an account to join this group.
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="flex-1">
              <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                Sign in
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                Create account
              </Link>
            </Button>
          </div>
        </div>
      );
    } else {
      // authenticated
      content = (
        <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-lg space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">
              Group invitation
            </p>
            <h1 className="text-2xl font-bold">Join {invite.groupName}</h1>
          </div>

          <div className="rounded-xl bg-muted/50 px-4 py-1 divide-y divide-border/60">
            <StatRow label="Treasurer" value={invite.treasurerName} />
            <StatRow
              label="Contribution"
              value={`GH₵ ${invite.contributionAmount.toFixed(2)}`}
            />
            <StatRow
              label="Frequency"
              value={
                invite.frequency.charAt(0) +
                invite.frequency.slice(1).toLowerCase()
              }
            />
            <StatRow
              label="Members"
              value={String(invite.memberCount)}
            />
          </div>

          {/* Joining-as info */}
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
            <Users className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Joining as{" "}
              <strong>{currentUserName ?? "you"}</strong>
              {currentUserEmail ? ` (${currentUserEmail})` : ""}
            </span>
          </div>

          {/* Warning for email-targeted invites */}
          {invite.requiresEmail && invite.targetEmailMasked && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This invite is for{" "}
                <strong>{invite.targetEmailMasked}</strong>. Make sure
                you&apos;re signed in with the right account.
              </span>
            </div>
          )}

          {/* Inline accept error */}
          {acceptError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{acceptError}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1"
              onClick={() => {
                setAcceptError(null);
                acceptMutation.mutate();
              }}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  Joining…
                </span>
              ) : (
                `Join ${invite.groupName}`
              )}
            </Button>
            <Button
              variant="ghost"
              className="flex-1 text-muted-foreground"
              onClick={() =>
                signOut({
                  callbackUrl: `/join?token=${encodeURIComponent(token!)}`,
                })
              }
            >
              Not you? Sign out
            </Button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Dot-grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, oklch(0.42 0.14 160) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-lg space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-2xl font-bold tracking-tight"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              M
            </span>
            Money<span className="text-primary">Loop</span>
          </Link>
        </div>

        {content}
      </div>
    </div>
  );
}
