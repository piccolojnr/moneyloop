import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

import { DashboardNav } from "./dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const userName = session?.user?.name;
  const userRole =
    typeof session?.user === "object" && session?.user && "role" in session.user
      ? session.user.role
      : undefined;
  const payoutAccountReady =
    typeof session?.user === "object" &&
    session?.user &&
    "payoutAccountReady" in session.user
      ? Boolean(session.user.payoutAccountReady)
      : false;

  if (!userName) {
    redirect("/login");
  }

  if (userRole !== "ADMIN" && !payoutAccountReady) {
    redirect("/onboarding/payout-account");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardNav userName={userName} />
      {/* pb-20 on mobile gives room for the fixed bottom tab bar */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-24 pt-6 sm:px-6 sm:pb-8 sm:pt-8 md:pb-8">
        {children}
      </main>
    </div>
  );
}
