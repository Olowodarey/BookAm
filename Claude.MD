# CLAUDE.md — BookAm

> This file is the source of truth for what BookAm is and how to work in this repo.
> Claude reads it every session. Keep it accurate (see "Rules for Claude" below).

---

## ⛔ Rules for Claude (read first, every time)

1. **NEVER commit or push. Ever.**
   The developer handles *all* git operations themselves.
   - Do **not** run `git commit`, `git push`, `git add … && commit`, `git merge`, or create branches/PRs.
   - You may **make and edit files**, show diffs, and describe what changed — then stop and let the developer review, commit, and push.
   - If asked "are we done?", answer with a summary of changed files, not a commit.

2. **Keep this file updated.**
   Whenever you add, remove, or meaningfully change a feature, route, data model, env var, or major dependency, **update the relevant section of this CLAUDE.md in the same change** so it always reflects the real state of the project. Update the "Current status / roadmap" checkboxes too. This is how the developer stays on track.

3. **BookAm never holds or moves money.**
   This is a hard product + legal constraint (see "The money rule"). Do **not** add wallets, escrow, custody, or any logic where user funds pass through BookAm. If a task seems to require holding funds, **stop and flag it** instead of building it.

4. **Ask before adding heavy dependencies** or changing the core stack. Prefer the tools already in the project.

---

## What BookAm is

BookAm is a digital **record-keeping** app for Nigerian **ajo / esusu / adashe** coordinators. The name is Nigerian Pidgin for *"record it / write it down."*

It replaces the paper collection card and notebook a coordinator uses to track a rotating savings group. A coordinator creates a **circle**, adds members, and marks contributions as they come in. Everyone sees the same up-to-date view of who has paid, who is owing, and who collects next.

**Target user:** ajo coordinators / collectors ("alajo"), cooperative and market-association treasurers. Phone-first, WhatsApp-centric, trust-driven, not very technical.

### The money rule (critical)
BookAm is **tracking-only**. Members pay each other **directly**, exactly as they do today. BookAm only *records* who paid what. It is **not** a bank, wallet, or payment processor and must never hold or route user funds. This keeps BookAm a software product and out of Nigeria's Mobile Money Operator licensing regime. Any feature that would hold, pool, or transfer contributions is out of scope — flag it, don't build it.

---

## Tech stack

- **Frontend:** `frontend/` — Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 (web app + marketing landing + admin console).
- **Backend:** `backend/` — NestJS 11 (TypeScript, CommonJS), standalone API server on port **4000**.
- **Database:** PostgreSQL via **Prisma 6** (`backend/prisma/schema.prisma` + migrations).
- **Auth:** phone + password JWT login exists today (built for the admin console; the guard/roles layer is OTP-ready). Phone-number OTP for coordinators/members is still the plan — swap the credential check, keep the JWT + role guards.
- **Notifications:** WhatsApp / SMS *(e.g. WhatsApp Business API, or a provider like Termii / Africa's Talking)*.
- **Payments:** none held in-app for **ajo contributions** (see "The money rule"). BookAm's **own SaaS subscription fees** (coordinators paying for the software) are legitimate revenue and are managed as records in the admin console; actual charge collection via Paystack is a marked `// TODO: Paystack` integration point in `backend/src/admin/subscriptions.service.ts`.

---

## Project structure

Monorepo with separate backend and frontend apps. Update this map as the repo grows.

```
BOOKAM/
├── backend/            # NestJS API server (TypeScript)
│   ├── src/
│   │   ├── prisma/     # PrismaService + global module
│   │   ├── auth/       # JWT login, /auth/me, JwtAuthGuard, Roles/RolesGuard
│   │   └── admin/      # /admin/* endpoints (overview, applications, plans,
│   │   │               #   subscriptions, users) — all guarded by ADMIN role
│   ├── prisma/         # schema.prisma, migrations/, seed.ts
│   └── .env.example
├── frontend/           # Next.js (App Router) + TS + Tailwind — web app + landing
│   ├── app/
│   │   ├── (marketing)/        # landing page
│   │   └── admin/              # platform-owner console
│   │       ├── login/          # admin sign-in
│   │       └── (dashboard)/    # guarded shell: overview, applications,
│   │                           #   subscriptions, users, settings
│   ├── components/     # UI components (landing/*, admin/*)
│   ├── lib/admin/      # typed API client + mirrored API types
│   └── .env.example
├── .gitignore
└── CLAUDE.md           # this file (repo root)
```

The two apps are independent: the frontend talks to the backend over HTTP. Keep backend
logic in `backend/` and UI in `frontend/` — don't mix them.

---

## Core data model (starting point for the backend)

> These are the domain entities. Refine as you build; keep this section in sync with the actual schema.

Implemented in `backend/prisma/schema.prisma` (✓ = in the schema today):

- **User** ✓ — a person. May be a coordinator, a member, or both. Identified by phone number. Has `role` (MEMBER | COORDINATOR | ADMIN), `status` (ACTIVE | SUSPENDED), and an optional `passwordHash` (admin login stopgap until OTP).
- **CollectorApplication** ✓ — a user's request to become a coordinator: applicant, status (PENDING | APPROVED | REJECTED), applicant's note, reviewNote, reviewedBy, reviewedAt. Approving promotes the applicant to COORDINATOR.
- **SubscriptionPlan** ✓ — a BookAm SaaS pricing tier: name, priceNaira, interval (MONTHLY | QUARTERLY | YEARLY), maxCircles (null = unlimited), features[], active. *This is BookAm's own revenue, not ajo money.*
- **Subscription** ✓ — which user is on which plan: status (ACTIVE | EXPIRED | CANCELLED), periodStart/periodEnd. Records only; Paystack charge collection is a marked TODO.
- **Circle** ✓ (minimal) — one rotating savings group. Has: name, contribution amount, frequency (daily/weekly/monthly), status, and the coordinator (a User). Memberships/cycles still to come.

Still to build:

- **Membership** — links a User to a Circle, with their **position** in the payout rotation.
- **Cycle** — one full rotation of a Circle (or one contribution period, depending on model). Tracks which period is active.
- **Contribution** — a single payment record: which Membership, which Cycle/period, amount, marked-paid timestamp, and who recorded it. **This is a record only — no funds move.**
- **Payout** — the record of whose turn it is to collect in a given cycle (status: pending/collected). Again, a record — BookAm does not disburse.

Key rules to encode: a member's rotation position is unique within a Circle; contributions are immutable once recorded (correct via a new adjusting record, don't silently overwrite); every money-related field is a *label on a record*, never a balance BookAm controls.

---

## Domain glossary

- **Ajo / Esusu / Adashe** — Nigerian rotating savings & credit associations (ROSCA). Same idea, different regions/languages.
- **Circle** — one savings group in BookAm.
- **Coordinator / Collector / Alajo** — the person who runs the circle and records payments.
- **Rotation / Payout order** — the agreed order in which each member collects the pooled sum.
- **Pot** — the pooled contributions collected in one cycle (conceptual; BookAm never holds it).
- **Cycle** — one full round of the rotation.

---

## Conventions

- **Language:** TypeScript throughout; avoid `any`; type domain entities explicitly.
- **Env vars:** document every new one in `.env.example` (never commit real secrets).
- **Copy voice:** plain, warm, Nigerian, coordinator-facing, lightly pidgin-flavoured, WhatsApp-first. Name things the way users recognise them (their circle, who paid), not system jargon.
- **Git:** developer-only (see Rule 1). Claude never commits or pushes.

---

## Running locally

- **Backend** (`backend/`): copy `.env.example` → `.env` (needs a running PostgreSQL), then
  `pnpm install`, `npx prisma migrate dev`, `npx prisma db seed`, `pnpm start:dev` → API on :4000.
- **Frontend** (`frontend/`): copy `.env.example` → `.env.local` (defaults to :4000), then
  `pnpm install`, `pnpm dev` → app on :3000. Admin console at `/admin` (seeded admin:
  phone `+2348000000001`, password `admin1234` — change via `SEED_ADMIN_*` env vars).

---

## Current status / roadmap

> Keep these checkboxes current.

- [x] Marketing landing page (Next.js + TS + Tailwind)
- [x] Database schema + migrations (users/roles, collector applications, plans, subscriptions, minimal circles — memberships/cycles/contributions still pending)
- [ ] Phone OTP auth (JWT + role guards exist; swap the password check for OTP)
- [x] Platform admin dashboard (overview metrics, collector request review, subscription plans/records, user suspend/reactivate, settings placeholder)
- [ ] Paystack integration for BookAm subscription fees (records exist; `// TODO: Paystack` in subscriptions.service.ts)
- [ ] Create / manage circles
- [ ] Add members + set rotation order
- [ ] Record contributions (mark paid / owing)
- [ ] Coordinator dashboard (paid vs owing, who collects next)
- [ ] Invite members via shareable link
- [ ] WhatsApp / SMS reminders

---

## How to work in this repo (summary for Claude)

Make the changes, keep types clean, keep BookAm tracking-only, update this file when features change — then **stop and let the developer commit and push.**
