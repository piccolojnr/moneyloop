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

  if (!userName) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardNav userName={userName} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        {children}
      </main>
    </div>
  );
}
