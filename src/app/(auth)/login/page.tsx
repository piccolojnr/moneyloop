"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { getSession, signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function resolveRoleBasedRedirect() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const session = await getSession();
      const role =
        typeof session?.user === "object" &&
        session?.user &&
        "role" in session.user
          ? session.user.role
          : undefined;

      if (role) {
        return role === "ADMIN" ? "/admin" : "/dashboard";
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 150);
      });
    }

    return "/dashboard";
  }

  async function onSubmit(values: LoginValues) {
    setAuthError(null);
    const callbackUrl = searchParams.get("callbackUrl");
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      callbackUrl: callbackUrl ?? undefined,
      redirect: false,
    });

    if (result?.error) {
      setAuthError("Invalid email or password.");
      return;
    }

    const targetUrl = callbackUrl ?? (await resolveRoleBasedRedirect());
    window.location.assign(targetUrl);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your account.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {authError && (
            <p className="text-sm font-medium text-destructive">{authError}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
