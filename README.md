# MoneyLoop — Digital Susu Management System

A web-based platform for managing community susu groups, automating contribution tracking, and
processing payouts via Paystack (MoMo + card).

Built with: **Next.js 15 · Prisma · Neon (PostgreSQL) · Paystack · Resend · Vercel**

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd moneyloop
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in your credentials:
- **DATABASE_URL** — get from [neon.tech](https://neon.tech) (free tier is fine)
- **PAYSTACK_SECRET_KEY** — from [paystack.com](https://paystack.com) dashboard → Settings → API Keys
- **RESEND_API_KEY** — from [resend.com](https://resend.com)
- **NEXTAUTH_SECRET** — run `openssl rand -base64 32`
- **CRON_SECRET** — run `openssl rand -base64 32`

### 3. Push database schema

```bash
npm run db:generate
npm run db:push
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
moneyloop/
├── prisma/
│   └── schema.prisma          # Full database schema
│
├── src/
│   ├── app/
│   │   ├── (auth)/            # Public auth pages
│   │   │   ├── login/         # Login page
│   │   │   └── register/      # Member registration
│   │   │
│   │   ├── (dashboard)/       # Member-facing pages
│   │   │   ├── dashboard/     # Main dashboard — cycle status, contribution CTA
│   │   │   ├── pay/           # Paystack checkout redirect
│   │   │   └── history/       # Contribution + payout history
│   │   │
│   │   ├── (admin)/           # Admin-only pages
│   │   │   └── admin/
│   │   │       ├── members/   # Add/view members, assign to group
│   │   │       ├── cycles/    # View all cycles, see who's paid
│   │   │       └── payouts/   # Payout log with status
│   │   │
│   │   └── api/
│   │       ├── auth/          # NextAuth route handlers
│   │       ├── members/       # Member registration + listing
│   │       ├── contributions/ # Initialize Paystack payment
│   │       ├── payouts/       # Payout status queries
│   │       ├── webhooks/
│   │       │   └── paystack/  # ← Register this URL in Paystack dashboard
│   │       └── cron/          # Daily payout scheduler (called by Vercel)
│   │
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── auth.ts            # NextAuth config
│   │   ├── paystack.ts        # Paystack API utilities
│   │   └── susu.ts            # Core rotation + cycle logic
│   │
│   ├── types/
│   │   └── index.ts           # Shared TypeScript types
│   │
│   └── emails/                # Resend email templates
│
└── vercel.json                # Cron schedule (08:00 UTC daily)
```

---

## Core Flows

### Member pays contribution

1. Member clicks "Pay Now" on dashboard
2. Frontend calls `POST /api/contributions` → gets Paystack checkout URL
3. Member completes payment on Paystack hosted page
4. Paystack sends `charge.success` to `/api/webhooks/paystack`
5. Webhook marks contribution as SUCCESS, checks if all members paid
6. If cycle is fully funded → marks cycle as READY

### Daily payout (automated)

1. Vercel Cron calls `GET /api/cron` at 08:00 UTC
2. Cron finds all READY cycles with today's payout date
3. Creates Paystack Transfer to recipient's MoMo number
4. Paystack sends `transfer.success` / `transfer.failed` to webhook
5. Webhook updates cycle to PAID, triggers next cycle creation

---

## Paystack Setup

### Test vs Live keys
- Use `sk_test_*` keys for development — no real money moves
- Switch to `sk_live_*` in production Vercel environment variables

### Register your webhook
In Paystack dashboard → Settings → API Keys & Webhooks:
- Webhook URL: `https://your-domain.vercel.app/api/webhooks/paystack`

### Enable transfers
Paystack transfers (outgoing MoMo payouts) require:
- Your account to be verified with Paystack
- Sufficient balance in your Paystack wallet (members' payments flow there first)
- Transfer feature enabled (contact Paystack support if not visible)

---

## Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# or via CLI: vercel env add PAYSTACK_SECRET_KEY
```

The cron job in `vercel.json` runs automatically on Vercel — no extra setup needed.

---

## Database Commands

```bash
npm run db:push       # Push schema changes to Neon (dev)
npm run db:studio     # Open Prisma Studio — browse your data visually
npm run db:generate   # Regenerate Prisma client after schema changes
```
