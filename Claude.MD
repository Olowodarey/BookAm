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
│   │   ├── admin/      # /admin/* endpoints (overview, applications, plans,
│   │   │               #   subscriptions, users) — all guarded by ADMIN role
│   │   ├── circles/    # coordinator workspace: /circles/* (COORDINATOR role,
│   │   │               #   ownership-scoped) + public /invite/:token join flow;
│   │   │               #   receipt uploads (ReceiptStorageService) + AppealsService
│   │   └── member/     # contributor view: /member/* (any signed-in user,
│   │                   #   scoped by their own ACTIVE memberships) — read-only
│   │                   #   except own-receipt upload and appeals/voting
│   ├── prisma/         # schema.prisma, migrations/, seed.ts
│   ├── uploads/        # local-dev receipt files (gitignored; TODO S3/Cloudinary)
│   └── .env.example
├── frontend/           # Next.js (App Router) + TS + Tailwind — web app + landing
│   ├── app/
│   │   ├── (marketing)/        # landing page
│   │   ├── admin/              # platform-owner console
│   │   │   ├── login/          # admin sign-in
│   │   │   └── (dashboard)/    # guarded shell: overview, applications,
│   │   │                       #   subscriptions, users, settings
│   │   ├── dashboard/          # coordinator (alajo) workspace
│   │   │   ├── login/          # coordinator sign-in
│   │   │   └── (app)/          # guarded shell: circle list + per-circle
│   │   │       └── circles/[id]/   # overview (+ appeal decisions), members,
│   │   │                           #   contributions, payout
│   │   ├── me/                 # member (contributor) dashboard — read-mostly
│   │   │   ├── login/          # member sign-in
│   │   │   └── (app)/          # shell: my circles + per-circle
│   │   │       └── circles/[id]/   # overview + my receipt, members, appeals
│   │   └── join/[token]/       # public invite page (member joins a circle)
│   ├── components/     # UI components (landing/*, admin/*, dashboard/*, member/*)
│   ├── lib/admin/      # typed API client + mirrored API types (admin console)
│   ├── lib/dashboard/  # typed API client + mirrored API types (coordinator)
│   ├── lib/member/     # typed API client + mirrored API types (member view)
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
- **Circle** ✓ — one rotating savings group: name, contribution amount, frequency (daily/weekly/monthly), status (ACTIVE | COMPLETED | PAUSED), coordinator (User), `memberTarget` (planned rotation size), and an optional `inviteToken` for the shareable join link.
- **Membership** ✓ — a member of a Circle by **name + phone** (optional link to a User account via `userId`), with their 1-based **position** in the payout rotation and status (ACTIVE | REMOVED — soft-removed so records survive). Position uniqueness among active members is enforced in the service layer, not the DB (removed members keep their last value).
- **Cycle** ✓ — one contribution period/round of a Circle: `index` (unique per circle), status (OPEN | COMPLETED), and the current **collector** (a Membership). One cycle is open at a time; completing a payout opens the next.
- **Contribution** ✓ — one member's payment record for a cycle: amount, status (AWAITING | PENDING_REVIEW | PAID | REJECTED), `receiptFileUrl` (uploaded proof), rejectionReason, reviewedBy/reviewedAt. Unique per (membership, cycle). **A record only — no funds move.**
- **Payout** ✓ — the record of the pot being handed to the cycle's collector: status (PENDING | COMPLETED), `receiptFileUrl` (the coordinator's transfer proof), amount (computed sum of PAID contributions), completedAt. Unique per cycle. **BookAm does not disburse.**
- **Appeal** ✓ — a member's request to be considered to collect next: circle, appellant (Membership), reason, status (OPEN | APPROVED | REJECTED | WITHDRAWN), decidedBy (coordinator User), decidedAt, outcomeNote. One OPEN appeal per member per circle (service-enforced). Reason, tally and outcome are visible to the whole circle.
- **AppealVote** ✓ — one member's advisory vote on an appeal: value (SUPPORT | OPPOSE), unique per (appeal, voter); changeable while the appeal is open. The tally is advisory — the coordinator decides, and approval reorders the rotation so the appellant collects right after the current turn.

Key rules encoded: rotation position is managed per-circle in the service layer; completing a payout closes the cycle and advances the rotation (next active member by position who hasn't collected; when everyone has, the circle is COMPLETED); every money-related field is a *label on a record*, never a balance BookAm controls. Receipt files are validated (JPG/PNG/WebP/PDF, ≤5 MB) and stored on local disk in dev (`backend/uploads/`, served at `/uploads/*`) behind a storage adapter with a `// TODO: S3/Cloudinary` swap point.

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
  Coordinator dashboard at `/dashboard` (seeded coordinator: phone `+2348011111111`,
  password `alajo1234` — change via `SEED_COORDINATOR_PASSWORD`; comes with a demo
  circle, members and mixed contribution statuses).
  Member dashboard at `/me` (seeded members, e.g. phone `+2348066666666`, password
  `member1234` — change via `SEED_MEMBER_PASSWORD`; the demo circle includes an open
  appeal with votes).
  Dedicated test accounts (own circle "Ketu Market Daily", distinct passwords):
  collector `+2348090000001` / `collector5678` (`SEED_TEST_COLLECTOR_PASSWORD`) and
  contributor `+2348090000002` / `contributor5678` (`SEED_TEST_MEMBER_PASSWORD`).

---

## Current status / roadmap

> Keep these checkboxes current.

- [x] Marketing landing page (Next.js + TS + Tailwind)
- [x] Database schema + migrations (users/roles, collector applications, plans, subscriptions, minimal circles — memberships/cycles/contributions still pending)
- [ ] Phone OTP auth (JWT + role guards exist; swap the password check for OTP)
- [x] Platform admin dashboard (overview metrics, collector request review, subscription plans/records, user suspend/reactivate, settings placeholder)
- [ ] Paystack integration for BookAm subscription fees (records exist; `// TODO: Paystack` in subscriptions.service.ts)
- [x] Create / manage circles
- [x] Add members + set rotation order (drag-to-reorder, soft remove)
- [x] Record contributions (receipt upload → verify/reject → paid / owing)
- [x] Coordinator dashboard (ajo collection card, paid vs owing, who collects next, payout receipts + rotation advance)
- [x] Invite members via shareable link (public `/join/[token]` page)
- [x] Member (contributor) dashboard at `/me` — my circles with "you collect in ~N turns", read-only circle view (ajo card, who collects next, member statuses, receipt viewing), submit/re-submit my own contribution receipt
- [x] Appeals + community voting — "consider me to collect next" with reason, one changeable advisory vote per member, live tally, coordinator approve/reject (approval reorders the rotation); full trail visible to the circle
- [ ] WhatsApp / SMS reminders (message + recipient list generated at `GET /circles/:id/reminders`; actual send is a `// TODO` in contributions.service.ts)
- [ ] Receipt storage in the cloud + signed URLs (`// TODO: S3/Cloudinary` in receipt-storage.service.ts; local disk in dev)
- [ ] Member-facing receipt submission (today the coordinator attaches receipts members send on WhatsApp; needs member auth/OTP)

---

## How to work in this repo (summary for Claude)

Make the changes, keep types clean, keep BookAm tracking-only, update this file when features change — then **stop and let the developer commit and push.**
