// GET  /api/members      — list all members (admin only)
// POST /api/members      — register a new member

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  momoNumber: z.string().min(10),
  momoNetwork: z.enum(["MTN", "VodafoneCash", "AirtelTigo"]).default("MTN"),
  password: z.string().min(6),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      momoNumber: true,
      momoNetwork: true,
      role: true,
      createdAt: true,
      groupMemberships: {
        include: { group: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, phone, momoNumber, momoNetwork, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, phone, momoNumber, momoNetwork, password: hashedPassword },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
