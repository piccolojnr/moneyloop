"use client";

import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

import { PayoutAccountForm } from "@/components/account/payout-account-form";
import { Button } from "@/components/ui/button";

export default function PayoutAccountOnboardingPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">MoneyLoop onboarding</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Verify where your payouts should go
            </h1>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        </div>

        <PayoutAccountForm mode="onboarding" nextPath={nextPath} />
      </div>
    </div>
  );
}
