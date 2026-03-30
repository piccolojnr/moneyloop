"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/admin/members", label: "Members" },
  { href: "/admin/cycles", label: "Groups / Cycles" },
  { href: "/admin/payouts", label: "Payouts" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-72 flex-col border-r bg-background">
      <div className="px-6 py-6">
        <Link href="/admin/members" className="text-lg font-semibold tracking-tight">
          MoneyLoop
        </Link>
      </div>

      <Separator />

      <nav className="flex-1 px-4 py-6">
        <div className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Button
                key={item.href}
                asChild
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto px-4 pb-6">
        <Separator className="mb-4" />
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </Button>
      </div>
    </aside>
  );
}
