import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;
    const isAdmin = token?.role === "ADMIN";

    if (pathname.startsWith("/admin") && !isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
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
    "/admin/:path*",
    "/api/((?!auth|webhooks|members|invite).+)",
  ],
};
