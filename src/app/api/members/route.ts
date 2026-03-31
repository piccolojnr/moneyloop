// GET  /api/members      — list all members (admin only)
// POST /api/members      — register a new member

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rateLimit, getRequestIp, rateLimitExceededResponse } from "@/lib/rate-limit";

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  momoNumber: z.string().min(10).optional(),
  momoNetwork: z.enum(["MTN", "VodafoneCash", "AirtelTigo"]).optional(),
  password: z.string().min(6),
});

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = parsePositiveInt(req.nextUrl.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(req.nextUrl.searchParams.get("pageSize"), 10);
  const shouldPaginate =
    req.nextUrl.searchParams.has("page") ||
    req.nextUrl.searchParams.has("pageSize");

  const [members, total] = await Promise.all([
    prisma.user.findMany({
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
      ...(shouldPaginate
        ? {
            skip: (page - 1) * pageSize,
            take: pageSize,
          }
        : {}),
    }),
    shouldPaginate ? prisma.user.count() : Promise.resolve(0),
  ]);

  const serializedMembers = members.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    phone: member.phone,
    momoNumber: member.momoNumber,
    momoNetwork: member.momoNetwork,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
    groupCount: member.groupMemberships.length,
  }));

  if (!shouldPaginate) {
    return NextResponse.json(serializedMembers);
  }

  return NextResponse.json({
    data: serializedMembers,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`register:${getRequestIp(req)}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) return rateLimitExceededResponse(rl.resetAt);

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
    data: {
      name,
      email,
      phone,
      momoNumber: momoNumber ?? null,
      momoNetwork: momoNetwork ?? null,
      payoutAccountStatus:
        momoNumber && momoNetwork ? "PENDING_VERIFICATION" : "UNSET",
      password: hashedPassword,
    },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
