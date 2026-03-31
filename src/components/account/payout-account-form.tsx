"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck } from "lucide-react";

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

const payoutAccountSchema = z.object({
  momoNumber: z.string().min(10, "Enter a valid mobile money number"),
  momoNetwork: z.enum(["MTN", "VodafoneCash", "AirtelTigo"]),
});

type PayoutAccountValues = z.infer<typeof payoutAccountSchema>;

type PayoutAccountResponse = {
  payoutAccount: {
    status: "UNSET" | "PENDING_VERIFICATION" | "VERIFIED";
    ready: boolean;
    momoNumber: string | null;
    momoNetwork: "MTN" | "VodafoneCash" | "AirtelTigo" | null;
    verifiedAt: string | null;
    lastUpdatedAt?: string | null;
    changeLockedUntil: string | null;
    canEdit: boolean;
    cooldownDaysRemaining: number;
    verificationError: string | null;
    pendingAccount:
      | {
          momoNumber: string;
          momoNetwork: "MTN" | "VodafoneCash" | "AirtelTigo";
        }
      | null;
  };
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

async function fetchPayoutAccount() {
  const response = await fetch("/api/account/payout", {
    credentials: "include",
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | PayoutAccountResponse
    | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(body, "Failed to load payout account"));
  }

  return body as PayoutAccountResponse;
}

async function verifyPayoutAccount(values: PayoutAccountValues) {
  const response = await fetch("/api/account/payout/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | PayoutAccountResponse
    | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(body, "Failed to verify payout account"));
  }

  return body as PayoutAccountResponse;
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

type PayoutAccountFormProps = {
  mode: "onboarding" | "settings";
  nextPath?: string;
};

export function PayoutAccountForm({
  mode,
  nextPath = "/dashboard",
}: PayoutAccountFormProps) {
  const router = useRouter();
  const { update } = useSession();
  const accountQuery = useQuery({
    queryKey: ["payout-account"],
    queryFn: fetchPayoutAccount,
  });

  const form = useForm<PayoutAccountValues>({
    resolver: standardSchemaResolver(payoutAccountSchema),
    defaultValues: {
      momoNumber: "",
      momoNetwork: "MTN",
    },
    values: {
      momoNumber:
        accountQuery.data?.payoutAccount.pendingAccount?.momoNumber ??
        accountQuery.data?.payoutAccount.momoNumber ??
        "",
      momoNetwork:
        accountQuery.data?.payoutAccount.pendingAccount?.momoNetwork ??
        accountQuery.data?.payoutAccount.momoNetwork ??
        "MTN",
    },
  });

  const verifyMutation = useMutation({
    mutationFn: verifyPayoutAccount,
    onSuccess: async () => {
      await accountQuery.refetch();
      await update();
      toast.success(
        mode === "onboarding"
          ? "Payout account verified."
          : "Payout account updated and verified."
      );
      if (mode === "onboarding") {
        window.location.assign(nextPath);
        return;
      }
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to verify payout account.");
    },
  });

  const account = accountQuery.data?.payoutAccount;
  const cardTitle =
    mode === "onboarding" ? "Set up your payout account" : "Payout account";
  const cardDescription =
    mode === "onboarding"
      ? "Before you can use MoneyLoop normally, verify where your payouts should be sent."
      : "Update the mobile money account that receives your MoneyLoop payouts.";

  const lockedMessage = useMemo(() => {
    if (!account || account.canEdit) {
      return null;
    }

    return `You can update this account again in ${account.cooldownDaysRemaining} day(s).`;
  }, [account]);

  useEffect(() => {
    if (mode !== "onboarding" || !account?.ready) {
      return;
    }

    window.location.replace(nextPath);
  }, [account?.ready, mode, nextPath]);

  if (accountQuery.isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-56" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
    );
  }

  if (accountQuery.error || !account) {
    return (
      <Card className="border-destructive/20 shadow-sm">
        <CardHeader>
          <CardTitle>Unable to load payout account</CardTitle>
          <CardDescription>
            {(accountQuery.error as Error | undefined)?.message ??
              "Something went wrong while loading your payout account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => accountQuery.refetch()}
            disabled={accountQuery.isRefetching}
          >
            {accountQuery.isRefetching ? "Retrying..." : "Try again"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "onboarding" && account.ready) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Redirecting to your dashboard</CardTitle>
          <CardDescription>
            Your payout account is already verified, so you do not need onboarding.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <Badge className="w-fit bg-primary/10 text-primary hover:bg-primary/10">
            {mode === "onboarding" ? "Required setup" : "Verified payouts"}
          </Badge>
          <div className="space-y-2">
            <CardTitle className="text-2xl tracking-tight">{cardTitle}</CardTitle>
            <CardDescription className="max-w-2xl leading-6">
              {cardDescription}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Status
              </p>
              <div className="mt-3 flex items-center gap-2">
                {account.ready ? (
                  <>
                    <CheckCircle2 className="size-4 text-primary" />
                    <p className="font-medium">Verified and ready</p>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4 text-amber-600" />
                    <p className="font-medium">
                      {account.status === "PENDING_VERIFICATION"
                        ? "Verification pending"
                        : "Setup incomplete"}
                    </p>
                  </>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {account.ready
                  ? `Verified ${
                      formatDate(account.verifiedAt) ?? "recently"
                    }`
                  : "You need a verified payout account before MoneyLoop can send funds to you."}
              </p>
            </div>

            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Current account
              </p>
              <p className="mt-3 font-medium">
                {account.momoNumber && account.momoNetwork
                  ? `${account.momoNumber} · ${account.momoNetwork}`
                  : "No verified payout account yet"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {lockedMessage ??
                  (account.ready
                    ? "Changes require fresh verification before payouts switch to the new account."
                    : "Enter your mobile money details and verify them below.")}
              </p>
            </div>
          </div>

          {account.verificationError ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              {account.verificationError}
            </div>
          ) : null}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                verifyMutation.mutate(values)
              )}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="momoNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MoMo number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0241234567"
                          disabled={verifyMutation.isPending || !account.canEdit}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="momoNetwork"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Network</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={verifyMutation.isPending || !account.canEdit}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select network" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MTN">MTN</SelectItem>
                          <SelectItem value="VodafoneCash">Vodafone</SelectItem>
                          <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="max-w-xl text-sm text-muted-foreground">
                  MoneyLoop verifies this account by registering it with the payout
                  provider before it can receive your susu payouts.
                </p>
                <Button
                  type="submit"
                  disabled={verifyMutation.isPending || !account.canEdit}
                >
                  {verifyMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner />
                      Verifying...
                    </span>
                  ) : mode === "onboarding" ? (
                    "Verify payout account"
                  ) : (
                    "Update and verify"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
