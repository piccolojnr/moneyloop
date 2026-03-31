import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;
    const isAdmin = token?.role === "ADMIN";
    const payoutAccountReady = token?.payoutAccountReady === true;
    const isOnboardingRoute = pathname.startsWith("/onboarding");
    const isMemberRoute =
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/groups" ||
      pathname.startsWith("/groups/") ||
      pathname === "/pay" ||
      pathname.startsWith("/pay/") ||
      pathname === "/history" ||
      pathname.startsWith("/history/") ||
      pathname === "/account" ||
      pathname.startsWith("/account/");

    if (pathname.startsWith("/admin") && !isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (pathname === "/dashboard" && isAdmin) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    if (!isAdmin && isMemberRoute && !payoutAccountReady) {
      const nextUrl = new URL("/onboarding/payout-account", req.url);
      const nextPath = `${pathname}${req.nextUrl.search}`;
      nextUrl.searchParams.set("next", nextPath);
      return NextResponse.redirect(nextUrl);
    }

    if (isOnboardingRoute && (isAdmin || payoutAccountReady)) {
      return NextResponse.redirect(new URL(isAdmin ? "/admin" : "/dashboard", req.url));
    }

    if (pathname === "/api/members" && req.method === "GET" && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/groups/:path*",
    "/pay/:path*",
    "/history/:path*",
    "/account/:path*",
    "/onboarding/:path*",
    "/admin/:path*",
    "/api/((?!auth|webhook|webhooks|members|invite).+)",
  ],
};
