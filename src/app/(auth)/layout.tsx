import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Subtle background pattern */}
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

      <div className="relative z-10 w-full max-w-sm space-y-6">
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
          <p className="mt-1.5 text-xs text-muted-foreground">
            Trusted rotating savings for everyone
          </p>
        </div>

        {/* Card */}
        <Card className="shadow-lg">
          <CardContent className="pt-6 pb-6">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
