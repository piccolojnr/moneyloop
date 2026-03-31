"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { BarChart3 } from "lucide-react";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AdminSidebar } from "./admin-sidebar";

const pageTitles: Record<string, { title: string; description: string }> = {
  "/admin": {
    title: "Platform Overview",
    description:
      "Monitor users, groups, and payout operations across MoneyLoop.",
  },
  "/admin/members": {
    title: "Platform Users",
    description:
      "Manage accounts, onboarding, and visibility across the platform.",
  },
  "/admin/groups": {
    title: "All Groups",
    description:
      "Review every savings group, its treasurer, and current operating state.",
  },
  "/admin/payouts": {
    title: "All Payouts",
    description:
      "Inspect recent transfers, failures, and payout throughput platform-wide.",
  },
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const pageMeta = useMemo(() => {
    return pageTitles[pathname] ?? pageTitles["/admin"];
  }, [pathname]);

  return (
    <TooltipProvider delayDuration={150}>
      <SidebarProvider defaultOpen>
        <AdminSidebar />
        <SidebarInset className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.05),transparent_28rem)]">
          <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <SidebarTrigger className="md:hidden" />
              <div className="hidden size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary md:flex">
                <BarChart3 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-tight">
                  {pageMeta.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {pageMeta.description}
                </p>
              </div>
            </div>
            <Separator />
          </header>

          <div className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
