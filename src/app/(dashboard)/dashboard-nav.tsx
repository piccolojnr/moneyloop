"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/groups", label: "My Groups" },
  { href: "/pay", label: "Pay" },
  { href: "/history", label: "History" },
];

type DashboardNavProps = {
  userName: string;
};

export function DashboardNav({ userName }: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            MoneyLoop
          </Link>
          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Button key={item.href} variant={isActive ? "secondary" : "ghost"} asChild>
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{userName}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
