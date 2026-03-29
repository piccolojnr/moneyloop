import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function getRequiredSession(_req?: unknown): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

export async function requireAdmin(_req?: unknown): Promise<Session> {
  const session = await getRequiredSession();
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}
