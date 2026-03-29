// Shared TypeScript types for MoneyLoop

import type {
  User,
  SusuGroup,
  GroupMember,
  Cycle,
  Contribution,
  Payout,
} from "@/generated/prisma/client/client";

// ─── Extended types with relations ──────────────────────────────────────────

export type CycleWithDetails = Cycle & {
  group: SusuGroup & {
    members: (GroupMember & { user: User })[];
  };
  contributions: (Contribution & { user: User })[];
  payout: Payout | null;
};

export type MemberWithGroup = GroupMember & {
  user: User;
  group: SusuGroup;
};

// ─── Dashboard summary ───────────────────────────────────────────────────────

export type MemberDashboardData = {
  group: SusuGroup;
  currentCycle: CycleWithDetails | null;
  myContribution: Contribution | null;
  myPayoutPosition: number;
  memberCount: number;
  cyclesUntilMyTurn: number;
};

// ─── API responses ───────────────────────────────────────────────────────────

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Paystack ────────────────────────────────────────────────────────────────

export type PaystackWebhookEvent = {
  event: string;
  data: {
    reference?: string;
    transfer_code?: string;
    status?: string;
    amount?: number;
    reason?: string;
    metadata?: {
      contributionId?: string;
      cycleId?: string;
      userId?: string;
      groupId?: string;
    };
  };
};
