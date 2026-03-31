// prisma/seed.ts
// Seeds a test group with 5 members for local development
// Run with: npm run db:seed

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding MoneyLoop database...");

  const password = await bcrypt.hash("password123", 10);

  // Create admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@moneyloop.gh" },
    update: {
      payoutAccountStatus: "VERIFIED",
      payoutAccountVerifiedAt: new Date(),
      payoutAccountLastUpdatedAt: new Date(),
      payoutAccountChangeLockedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    create: {
      name: "Admin User",
      email: "admin@moneyloop.gh",
      phone: "0201234567",
      momoNumber: "0201234567",
      momoNetwork: "MTN",
      payoutAccountStatus: "VERIFIED",
      payoutAccountVerifiedAt: new Date(),
      payoutAccountLastUpdatedAt: new Date(),
      payoutAccountChangeLockedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      role: "ADMIN",
      password,
    },
  });

  // Create 5 test members
  const memberData = [
    { name: "Akosua Mensah",  email: "akosua@test.com",  phone: "0241000001", momoNumber: "0241000001" },
    { name: "Abena Boateng",  email: "abena@test.com",   phone: "0241000002", momoNumber: "0241000002" },
    { name: "Efua Asante",    email: "efua@test.com",    phone: "0241000003", momoNumber: "0241000003" },
    { name: "Adwoa Darko",    email: "adwoa@test.com",   phone: "0241000004", momoNumber: "0241000004" },
    { name: "Ama Osei",       email: "ama@test.com",     phone: "0241000005", momoNumber: "0241000005" },
  ];

  const members = await Promise.all(
    memberData.map((m) =>
      prisma.user.upsert({
        where: { email: m.email },
        update: {
          payoutAccountStatus: "VERIFIED",
          payoutAccountVerifiedAt: new Date(),
          payoutAccountLastUpdatedAt: new Date(),
          payoutAccountChangeLockedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        create: {
          ...m,
          momoNetwork: "MTN",
          payoutAccountStatus: "VERIFIED",
          payoutAccountVerifiedAt: new Date(),
          payoutAccountLastUpdatedAt: new Date(),
          payoutAccountChangeLockedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          role: "MEMBER",
          password,
        },
      })
    )
  );

  // Create the MoneyLoop group
  const group = await prisma.susuGroup.upsert({
    where: { id: "seed-group-001" },
    update: {
      treasurerId: admin.id,
    },
    create: {
      id: "seed-group-001",
      name: "MoneyLoop Group",
      contributionAmount: 100.00, // GHS 100 per member
      frequency: "MONTHLY",
      treasurerId: admin.id,
      currentCycle: 1,
      status: "ACTIVE",
    },
  });

  // Add members to group with payout positions
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: admin.id } },
    update: {
      payoutPosition: null,
      memberRole: "TREASURER",
    },
    create: {
      userId: admin.id,
      groupId: group.id,
      payoutPosition: null,
      memberRole: "TREASURER",
    },
  });

  await Promise.all(
    members.map((member, index) =>
      prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: member.id } },
        update: {
          payoutPosition: index + 1,
          memberRole: "MEMBER",
        },
        create: {
          userId: member.id,
          groupId: group.id,
          payoutPosition: index + 1,
          memberRole: "MEMBER",
        },
      })
    )
  );

  await prisma.invitation.upsert({
    where: { token: "test-invite-token" },
    update: {
      groupId: group.id,
      email: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      usedAt: null,
    },
    create: {
      groupId: group.id,
      email: null,
      token: "test-invite-token",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Create the first cycle (due end of this month)
  const payoutDate = new Date();
  payoutDate.setDate(28); // 28th of current month

  await prisma.cycle.upsert({
    where: { groupId_cycleNumber: { groupId: group.id, cycleNumber: 1 } },
    update: {},
    create: {
      groupId: group.id,
      cycleNumber: 1,
      recipientId: members[0].id, // Akosua goes first
      payoutDate,
      status: "PENDING",
    },
  });

  console.log(`
✓ Admin:   admin@moneyloop.gh / password123
✓ Members: akosua@test.com ... ama@test.com / password123
✓ Group:   MoneyLoop Group (GHS 100/month, treasurer + 5 members)
✓ Cycle 1: Akosua Mensah receives payout on the 28th
✓ Invite:  /join?token=test-invite-token
  `);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
