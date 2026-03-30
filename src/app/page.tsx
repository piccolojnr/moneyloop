import Link from "next/link";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "Track every cycle",
    description:
      "See who should pay, who has paid, and who receives the next payout without chasing updates manually.",
  },
  {
    title: "Automate payouts",
    description:
      "Move from collection to payout with a clear cycle record, recipient tracking, and transfer status visibility.",
  },
  {
    title: "Keep members informed",
    description:
      "Send reminders, payment confirmations, and payout notifications so everyone stays aligned.",
  },
];

const steps = [
  "Create a group and set the contribution amount and payout frequency.",
  "Add members and assign each person a payout position in the rotation.",
  "Collect contributions, confirm payments, and release each cycle payout on time.",
];

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const primaryHref = !session
    ? "/login"
    : role === "ADMIN"
      ? "/admin/members"
      : "/dashboard";
  const primaryLabel = !session
    ? "Sign in"
    : role === "ADMIN"
      ? "Open admin"
      : "Open dashboard";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            MoneyLoop
          </Link>
          <div className="flex items-center gap-3">
            {!session ? (
              <Button asChild variant="ghost">
                <Link href="/register">Register</Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href={primaryHref}>{primaryLabel}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Community savings, modernized
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Run your susu group with clarity, structure, and less friction.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                MoneyLoop helps groups manage contributions, cycle payouts,
                member reminders, and payout visibility in one clean workflow.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={primaryHref}>{primaryLabel}</Link>
              </Button>
              {!session ? (
                <Button asChild size="lg" variant="outline">
                  <Link href="/register">Create account</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <Card className="border-foreground/10 bg-muted/30">
            <CardHeader>
              <CardDescription>What MoneyLoop covers</CardDescription>
              <CardTitle>From collection to payout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm text-muted-foreground">Contributions</p>
                <p className="mt-1 text-lg font-medium">
                  Track pending and paid members by cycle
                </p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm text-muted-foreground">Rotation</p>
                <p className="mt-1 text-lg font-medium">
                  Keep payout order visible for every member
                </p>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm text-muted-foreground">Notifications</p>
                <p className="mt-1 text-lg font-medium">
                  Remind contributors and confirm payouts automatically
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="border-y bg-muted/20">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="bg-background">
                <CardHeader>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
              How it works
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              A simple flow for organized savings groups
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <Card key={step}>
                <CardHeader>
                  <CardDescription>Step {index + 1}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{step}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20">
          <Card className="bg-foreground text-background">
            <CardHeader>
              <CardTitle className="text-3xl">Ready to start your next cycle?</CardTitle>
              <CardDescription className="text-background/70">
                Set up your group, onboard members, and manage payouts from one place.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary">
                <Link href={primaryHref}>{primaryLabel}</Link>
              </Button>
              {!session ? (
                <Button asChild size="lg" variant="outline" className="border-background/20 bg-transparent text-background hover:bg-background/10">
                  <Link href="/register">Create account</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
