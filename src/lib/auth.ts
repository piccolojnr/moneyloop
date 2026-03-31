// src/lib/auth.ts
// NextAuth v5 configuration with credentials provider

import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            password: true,
            payoutAccountStatus: true,
            momoNumber: true,
            momoNetwork: true,
            payoutAccountChangeLockedUntil: true,
          },
        });

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);
        if (!passwordMatch) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          payoutAccountStatus: user.payoutAccountStatus,
          payoutAccountReady:
            user.payoutAccountStatus === "VERIFIED" &&
            Boolean(user.momoNumber) &&
            Boolean(user.momoNetwork),
          payoutAccountChangeLockedUntil:
            user.payoutAccountChangeLockedUntil?.toISOString() ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.payoutAccountStatus = (user as any).payoutAccountStatus;
        token.payoutAccountReady = (user as any).payoutAccountReady;
        token.payoutAccountChangeLockedUntil = (user as any).payoutAccountChangeLockedUntil;
        token.roleRefreshedAt = Date.now();
      } else if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            payoutAccountStatus: true,
            momoNumber: true,
            momoNetwork: true,
            payoutAccountChangeLockedUntil: true,
          },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.payoutAccountStatus = dbUser.payoutAccountStatus;
          token.payoutAccountReady =
            dbUser.payoutAccountStatus === "VERIFIED" &&
            Boolean(dbUser.momoNumber) &&
            Boolean(dbUser.momoNetwork);
          token.payoutAccountChangeLockedUntil =
            dbUser.payoutAccountChangeLockedUntil?.toISOString() ?? null;
          token.roleRefreshedAt = Date.now();
        }
      } else {
        // Re-fetch the role periodically so changes propagate without requiring re-login.
        const FIVE_MINUTES = 5 * 60 * 1000;
        const lastRefresh = (token.roleRefreshedAt as number) ?? 0;
        if (token.payoutAccountReady !== true || Date.now() - lastRefresh > FIVE_MINUTES) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              role: true,
              payoutAccountStatus: true,
              momoNumber: true,
              momoNetwork: true,
              payoutAccountChangeLockedUntil: true,
            },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.payoutAccountStatus = dbUser.payoutAccountStatus;
            token.payoutAccountReady =
              dbUser.payoutAccountStatus === "VERIFIED" &&
              Boolean(dbUser.momoNumber) &&
              Boolean(dbUser.momoNetwork);
            token.payoutAccountChangeLockedUntil =
              dbUser.payoutAccountChangeLockedUntil?.toISOString() ?? null;
            token.roleRefreshedAt = Date.now();
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).payoutAccountStatus = token.payoutAccountStatus;
        (session.user as any).payoutAccountReady = token.payoutAccountReady;
        (session.user as any).payoutAccountChangeLockedUntil =
          token.payoutAccountChangeLockedUntil;
      }
      return session;
    },
  },
};
