import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

import { AdminSidebar } from "./admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const role =
    typeof session?.user === "object" && session?.user && "role" in session.user
      ? session.user.role
      : undefined;

  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
