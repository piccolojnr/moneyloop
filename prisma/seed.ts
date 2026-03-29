// prisma/seed.ts
// Seeds a test group with 5 members for local development
// Run with: npm run db:seed

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding MoneyLoop database...");

  const password = await bcrypt.hash("password123", 10);

  // Create admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@moneyloop.gh" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@moneyloop.gh",
      phone: "0201234567",
      momoNumber: "0201234567",
      momoNetwork: "MTN",
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
        update: {},
        create: { ...m, momoNetwork: "MTN", role: "MEMBER", password },
      })
    )
  );

  // Create the MoneyLoop group
  const group = await prisma.susuGroup.upsert({
    where: { id: "seed-group-001" },
    update: {},
    create: {
      id: "seed-group-001",
      name: "MoneyLoop Group",
      contributionAmount: 100.00, // GHS 100 per member
      frequency: "MONTHLY",
      currentCycle: 1,
      status: "ACTIVE",
    },
  });

  // Add members to group with payout positions
  await Promise.all(
    members.map((member, index) =>
      prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: member.id } },
        update: {},
        create: {
          userId: member.id,
          groupId: group.id,
          payoutPosition: index + 1,
        },
      })
    )
  );

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
✓ Group:   MoneyLoop Group (GHS 100/month, 5 members)
✓ Cycle 1: Akosua Mensah receives payout on the 28th
  `);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
