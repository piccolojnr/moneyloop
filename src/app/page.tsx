import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  Menu,
  Users,
  Zap,
  Bell,
  CheckCircle2,
  TrendingUp,
  Shield,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

// ── Shared link resolution ───────────────────────────────────────────────────

async function getSessionLinks() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isLoggedIn = !!session;
  const dashHref = role === "ADMIN" ? "/admin/members" : "/dashboard";
  return { isLoggedIn, dashHref };
}

// ── Landing page ─────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { isLoggedIn, dashHref } = await getSessionLinks();

  return (
    <div className="min-h-screen bg-background">
      <Navbar isLoggedIn={isLoggedIn} dashHref={dashHref} />
      <main>
        <Hero isLoggedIn={isLoggedIn} dashHref={dashHref} />
        <TrustStrip />
        <HowItWorks />
        <Features />
        <CtaBanner isLoggedIn={isLoggedIn} dashHref={dashHref} />
      </main>
      <Footer />
    </div>
  );
}

// ── Navbar ───────────────────────────────────────────────────────────────────

const navLinks = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
];

function Navbar({ isLoggedIn, dashHref }: { isLoggedIn: boolean; dashHref: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">M</span>
          </div>
          <span className="text-base font-semibold tracking-tight">MoneyLoop</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-2 md:flex">
          {!isLoggedIn && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href={isLoggedIn ? dashHref : "/register"}>
              {isLoggedIn ? "Open dashboard" : "Get started"}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="flex flex-col gap-6 pt-6">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <span className="text-sm font-bold text-primary-foreground">M</span>
                </div>
                <span className="text-base font-semibold">MoneyLoop</span>
              </Link>
              <nav className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="flex flex-col gap-2 border-t pt-4">
                {!isLoggedIn && (
                  <Button variant="outline" asChild>
                    <Link href="/login">Sign in</Link>
                  </Button>
                )}
                <Button asChild>
                  <Link href={isLoggedIn ? dashHref : "/register"}>
                    {isLoggedIn ? "Open dashboard" : "Get started"}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ isLoggedIn, dashHref }: { isLoggedIn: boolean; dashHref: string }) {
  return (
    <section className="relative overflow-hidden bg-primary px-4 py-16 sm:px-6 sm:py-24">
      {/* Dot-grid background pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, oklch(0.99 0 0 / 0.12) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-10 lg:flex-row lg:items-center">
        {/* Text */}
        <div className="flex-1 space-y-6">
          <Badge
            variant="secondary"
            className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground"
          >
            Community savings, modernized
          </Badge>

          <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight text-primary-foreground sm:text-4xl md:text-5xl">
            Your susu group, organized and automated.
          </h1>

          <p className="max-w-md text-base leading-relaxed text-primary-foreground/75 sm:text-lg">
            MoneyLoop handles contributions, payout rotation, and member
            reminders — so your group runs smoothly every cycle.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              asChild
            >
              <Link href={isLoggedIn ? dashHref : "/register"}>
                {isLoggedIn ? "Go to dashboard" : "Start for free"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {!isLoggedIn && (
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Mock cycle card */}
        <div className="w-full max-w-sm shrink-0 lg:w-80">
          <MockCycleCard />
        </div>
      </div>
    </section>
  );
}

function MockCycleCard() {
  const members = [
    { name: "Abena K.", paid: true, position: 1 },
    { name: "Kwame A.", paid: true, position: 2 },
    { name: "Efua M.", paid: false, position: 3, isRecipient: true },
    { name: "Kojo B.", paid: false, position: 4 },
  ];

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
      {/* Card header */}
      <div className="border-b px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Active cycle
            </p>
            <p className="mt-0.5 text-base font-semibold text-foreground">
              Family Savings Circle
            </p>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Cycle 3 / 4
          </Badge>
        </div>
      </div>

      {/* Payout info */}
      <div className="bg-primary/5 px-5 py-3">
        <p className="text-xs text-muted-foreground">Next payout to</p>
        <p className="text-sm font-semibold text-primary">Efua M. — GH₵ 600</p>
      </div>

      {/* Members */}
      <div className="divide-y px-5">
        {members.map((m) => (
          <div key={m.name} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {m.position}
              </div>
              <span className="text-sm font-medium text-foreground">{m.name}</span>
              {m.isRecipient && (
                <Badge variant="outline" className="text-[10px] border-accent text-accent-foreground bg-accent/10">
                  Recipient
                </Badge>
              )}
            </div>
            {m.isRecipient ? (
              <span className="text-xs text-muted-foreground">–</span>
            ) : m.paid ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-400" />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t bg-muted/40 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          2 of 3 contributors paid · Payout Apr 2
        </p>
      </div>
    </div>
  );
}

// ── Trust strip ──────────────────────────────────────────────────────────────

const trustItems = [
  { icon: Shield, label: "Transparent tracking" },
  { icon: TrendingUp, label: "MoMo-powered payouts" },
  { icon: CheckCircle2, label: "Zero paperwork" },
];

function TrustStrip() {
  return (
    <div className="border-b bg-secondary/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col divide-y px-4 sm:flex-row sm:divide-x sm:divide-y-0 sm:px-6">
        {trustItems.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 py-4 sm:flex-1 sm:justify-center sm:py-5"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── How it works ─────────────────────────────────────────────────────────────

const steps = [
  {
    number: "01",
    title: "Create your group",
    description:
      "Set the group name, contribution amount, and how often payouts happen — daily, weekly, or monthly.",
  },
  {
    number: "02",
    title: "Add members",
    description:
      "Invite members by email and assign each person a position in the payout rotation.",
  },
  {
    number: "03",
    title: "Run every cycle",
    description:
      "Members pay via MoMo. When everyone contributes, the payout goes out automatically to the next in line.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-10 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            How it works
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Up and running in three steps
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.number} className="relative flex flex-col gap-4">
              {/* Connector line between steps on desktop */}
              {i < steps.length - 1 && (
                <div
                  aria-hidden
                  className="absolute left-8 top-8 hidden h-px w-[calc(100%+1.5rem)] bg-border sm:block"
                />
              )}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <span className="text-lg font-bold text-primary">{step.number}</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ─────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Users,
    title: "Track every cycle",
    description:
      "See who has paid, who is pending, and who receives the next payout — without chasing anyone manually.",
  },
  {
    icon: Zap,
    title: "Automate payouts",
    description:
      "When all contributions are collected, the payout is triggered automatically via Paystack MoMo.",
  },
  {
    icon: Bell,
    title: "Keep members informed",
    description:
      "Contribution reminders, payment confirmations, and payout alerts go out automatically by email.",
  },
];

function Features() {
  return (
    <section id="features" className="bg-muted/30 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-10 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Features
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Everything your group needs
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col gap-4 rounded-2xl bg-card p-6 ring-1 ring-border"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA Banner ───────────────────────────────────────────────────────────────

function CtaBanner({ isLoggedIn, dashHref }: { isLoggedIn: boolean; dashHref: string }) {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-12 sm:px-10 sm:py-16">
          {/* Pattern */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle, oklch(0.99 0 0 / 0.10) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-primary-foreground sm:text-3xl">
                Ready to start your next cycle?
              </h2>
              <p className="text-primary-foreground/70">
                Set up your group, onboard members, and manage payouts from one place.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                asChild
              >
                <Link href={isLoggedIn ? dashHref : "/register"}>
                  {isLoggedIn ? "Open dashboard" : "Get started"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              {!isLoggedIn && (
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                  asChild
                >
                  <Link href="/login">Sign in</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t bg-muted/20 px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <span className="text-xs font-bold text-primary-foreground">M</span>
          </div>
          <span className="text-sm font-semibold">MoneyLoop</span>
        </Link>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} MoneyLoop. Digital susu management.
        </p>
      </div>
    </footer>
  );
}
