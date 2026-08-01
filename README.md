# BookAm

> **Digital record-keeping for Nigerian _ajo / esusu / adashe_ savings circles.**
> _"BookAm"_ is Nigerian Pidgin for **"record it / write it down."**

🌐 **Live:** [bookam.xyz](https://bookam.xyz/)

BookAm replaces the paper collection card and notebook that an _alajo_ (ajo coordinator) uses to run a rotating savings group. A coordinator creates a **circle**, invites members, and marks contributions as they come in. Everyone sees the same live view of **who has paid, who is owing, and who collects next** — no more disputes over a smudged notebook.

---

## Table of contents

- [What is _ajo_?](#what-is-ajo)
- [The money rule (why BookAm is safe & legal)](#the-money-rule)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Seeded demo accounts](#seeded-demo-accounts)
- [API surface](#api-surface)
- [Roadmap](#roadmap)
- [Glossary](#glossary)

---

## What is _ajo_?

**Ajo** (also **esusu** or **adashe**, depending on the region and language) is a Nigerian **rotating savings and credit association (ROSCA)**. A group of people agree to contribute a fixed amount on a fixed schedule (daily, weekly, or monthly). Each cycle, the entire pooled sum — the **pot** — is handed to one member, in an agreed rotation, until everyone has collected once.

It's a trust-driven, community savings system used across markets, cooperatives, and associations. It has always run on paper: a collection card and the coordinator's notebook. BookAm digitises that record — **phone-first, WhatsApp-centric, and built for a not-very-technical audience.**

---

## The money rule

**BookAm is tracking-only. It never holds, pools, or moves money.**

Members pay each other **directly**, exactly as they do today. BookAm only *records* who paid what. Every money-related field in the app is a **label on a record**, never a balance BookAm controls.

This is a deliberate product **and legal** constraint: by never touching user funds, BookAm stays a pure software product and out of Nigeria's Mobile Money Operator (MMO) licensing regime. There are no wallets, no escrow, no custody, and no disbursement anywhere in the system.

> BookAm's own **SaaS subscription fees** (coordinators paying for the software) are separate, legitimate revenue — tracked in the admin console with a Paystack charge-collection integration point.

---

## Features

BookAm serves **three distinct roles**, each with its own console:

### 👤 Member / Contributor (`/me`)
- See all circles you belong to, with **"you collect in ~N turns."**
- Read-only circle view: the ajo card, who collects next, every member's status.
- **Upload your own payment receipt** (JPG/PNG/WebP/PDF) — pay in one go or **bit by bit** in installments.
- See the coordinator's saved **"pay your contribution to"** account.
- **Appeals + community voting:** ask to collect next with a reason, cast one changeable advisory vote per member, and watch a live tally.
- Receipts are visible to the whole circle — everyone can verify everyone.

### 🧑‍💼 Coordinator / Alajo (`/dashboard`)
- Create and manage **circles**: contribution amount, frequency, rotation size, schedule, and an optional coordinator fee.
- **Invite members** by Gmail (emailed invite) or via a **shareable join link**.
- Set the **rotation order** with drag-to-reorder; soft-remove members without losing records.
- **Record contributions:** review uploaded receipts → verify or reject → paid / owing.
- Run the **payout**: see the collector's saved "send the pot to" account, attach transfer proof, and advance the rotation to the next collector.
- Decide **appeals** — approving one reorders the rotation so the appellant collects next.
- Generate a **WhatsApp/SMS reminder** message + recipient list for those still owing.
- **Coordinator fee:** take an optional whole-percent cut; the collector receives *pot − fee* (all as records).
- Coordinators can also **opt into their own circle's rotation** and save as a contributor in other circles.

### 🛡️ Platform Admin (`/admin`)
- Overview metrics for the whole platform.
- Review **collector applications** (approve → promotes a member to coordinator).
- Manage **subscription plans** and subscription records.
- **Suspend / reactivate** users.
- Read the landing-page **waitlist** signups.

### 🔐 Authentication (email-first, Gmail-only)
- **Email is the primary identity** — one Gmail, one account. Register with email + password.
- Verify via an emailed **6-digit code** *or* by clicking the **magic link** in the same email.
- **"Sign in with Google"** — verified server-side against Google's tokeninfo endpoint (no SDK); auto-links to a same-email account.
- **Forgot / reset password** over the same emailed code + link mechanism.
- **Optional phone / WhatsApp verification** from settings — verifying a number auto-claims any circle memberships a coordinator created for it. Delivered over the WhatsApp Cloud API.
- Transactional email sent over **free Gmail SMTP**; in dev without credentials, codes are logged and surfaced as a `devCode`.

---

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | [Next.js 16](https://nextjs.org/) (App Router) · React 19 · TypeScript · [Tailwind CSS v4](https://tailwindcss.com/) |
| **Backend** | [NestJS 11](https://nestjs.com/) (TypeScript, CommonJS) — standalone API on port `4000` |
| **Database** | [PostgreSQL](https://www.postgresql.org/) via [Prisma 6](https://www.prisma.io/) (schema + migrations) |
| **Auth** | JWT (`@nestjs/jwt`) · `bcryptjs` · role guards (MEMBER / COORDINATOR / ADMIN) · Google OAuth (tokeninfo, no SDK) |
| **Email** | Gmail SMTP via `nodemailer` (verification + password-reset codes & magic links) |
| **Notifications** | WhatsApp Cloud API (Meta) for optional phone OTP; WhatsApp/SMS reminders |
| **File uploads** | Receipt files validated (JPG/PNG/WebP/PDF, ≤5 MB) — local disk in dev behind a storage adapter (S3/Cloudinary swap point) |
| **Package manager** | `pnpm` |
| **Testing** | Jest (backend unit + e2e) |

---

## Architecture

BookAm is a **monorepo with two independent apps** that communicate over HTTP.

```
BookAm/
├── backend/            # NestJS API server (TypeScript) — port 4000
│   ├── src/
│   │   ├── prisma/     # PrismaService + global module
│   │   ├── auth/       # JWT login, /auth/me, guards, email + WhatsApp OTP, Google sign-in
│   │   ├── admin/      # /admin/* — overview, applications, plans, subscriptions, users (ADMIN)
│   │   ├── circles/    # coordinator workspace /circles/*, public /invite/:token, receipts, appeals
│   │   ├── member/     # contributor view /member/* — read-mostly, own receipts + appeals/voting
│   │   └── waitlist/   # public POST /waitlist, admin GET /admin/waitlist
│   ├── prisma/         # schema.prisma, migrations/, seed.ts
│   ├── uploads/        # local-dev receipt files (gitignored)
│   └── .env.example
│
├── frontend/           # Next.js App Router — web app + marketing landing + admin console
│   ├── app/
│   │   ├── (marketing)/         # landing page
│   │   ├── become-a-collector/  # public alajo pitch page (sign up → apply inline)
│   │   ├── login/ register/     # unified auth (email+password, OTP step, Google) — routes by role
│   │   ├── forgot-password/     # code-verified password reset (auto sign-in)
│   │   ├── verify-email/        # magic-link landing (auto-verify + sign in)
│   │   ├── admin/               # platform-owner console (guarded shell)
│   │   ├── dashboard/           # coordinator (alajo) workspace (guarded shell)
│   │   ├── me/                  # member (contributor) dashboard (guarded shell)
│   │   └── join/[token]/        # public invite page (member joins a circle)
│   ├── components/     # landing/* admin/* dashboard/* member/* auth/* settings/* circles/*
│   ├── lib/auth/       # unified auth client (login/register/OTP/Google, role routing)
│   ├── lib/admin/      # typed API client + mirrored API types (admin)
│   ├── lib/dashboard/  # typed API client + mirrored API types (coordinator)
│   ├── lib/member/     # typed API client + mirrored API types (member)
│   └── .env.example
│
└── CLAUDE.md           # engineering source-of-truth for the repo
```

**Design notes**
- Three role-scoped API groups (`/admin`, `/circles`, `/member`) behind JWT + role guards; every query is ownership-scoped.
- The frontend keeps **hand-mirrored TypeScript types** of the API responses per console (`lib/*/types.ts`), so the UI is fully typed without sharing a package.
- **All deadlines are West Africa Time (fixed UTC+1)** — inputs convert `datetime-local ↔ ISO` and display via `Africa/Lagos`, so every member sees the same time.
- Contributions and payouts support **installment ledgers** (`ContributionReceipt` / `PayoutReceipt`) — pay a little at a time, each part its own receipt row.

---

## Data model

Core domain entities (all implemented in `backend/prisma/schema.prisma`):

| Entity | What it is |
|---|---|
| **User** | A person — may be member, coordinator, or both. Identified by **email** (unique); optional `googleId`, optional verified `phone`, optional `passwordHash`. Has `role` and `status`. |
| **CollectorApplication** | A user's request to become a coordinator. Approving promotes them to COORDINATOR. |
| **SubscriptionPlan** / **Subscription** | BookAm's own SaaS pricing tiers and who's on them. *(BookAm revenue, not ajo money.)* |
| **Circle** | One rotating savings group: name, amount, frequency, status, coordinator, rotation size, optional fee %, optional invite token & schedule. |
| **Membership** | An account's place in a circle. Status: INVITED · REQUESTED · ACTIVE (with 1-based rotation `position`) · REMOVED (soft). |
| **Cycle** | One round of a circle: `index`, status (OPEN / COMPLETED), and the current **collector**. One open at a time. |
| **Contribution** | A member's payment record for a cycle: amount, status (AWAITING / PENDING_REVIEW / PAID / REJECTED), latest receipt. **A record only — no funds move.** |
| **ContributionReceipt** | Installment ledger — a contribution paid bit by bit; `paidNaira` = sum of receipts. |
| **Payout** | The record of the pot handed to a cycle's collector; amount = sum of PAID contributions. **BookAm does not disburse.** |
| **PayoutReceipt** | Installment ledger for paying the collector over time. |
| **Appeal** / **AppealVote** | A member's "consider me to collect next" request + one changeable advisory vote per member; the coordinator decides. |

**Key rules encoded:** rotation position is managed per-circle in the service layer; completing a payout closes the cycle and advances to the next active member who hasn't collected (when everyone has, the circle is COMPLETED); every money field is a label on a record, never a balance BookAm controls.

---

## Getting started

**Prerequisites:** Node.js, `pnpm`, and a running PostgreSQL instance.

### Backend (`backend/`)

```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL etc.
pnpm install
npx prisma migrate dev        # apply migrations
npx prisma db seed            # load demo data
pnpm start:dev                # API on http://localhost:4000
```

### Frontend (`frontend/`)

```bash
cd frontend
cp .env.example .env.local    # defaults to the :4000 backend
pnpm install
pnpm dev                      # app on http://localhost:3000
```

Then open:
- **App / landing:** `http://localhost:3000`
- **Coordinator dashboard:** `/dashboard`
- **Member dashboard:** `/me`
- **Admin console:** `/admin`

### Tests

```bash
cd backend
pnpm test        # unit tests
pnpm test:e2e    # end-to-end tests
```

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Prisma). |
| `JWT_SECRET` | Secret for signing JWTs — set a long random value in production. |
| `PORT` | Backend HTTP port (default `4000`). |
| `CORS_ORIGIN` | Comma-separated allowed origins. |
| `FRONTEND_URL` | Base URL used to build invite / magic links. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Gmail SMTP for transactional email. Blank in dev → codes are logged. |
| `MAIL_FROM` | Optional "from" display; defaults to `GMAIL_USER`. |
| `GOOGLE_CLIENT_ID` | Google OAuth client id (must match the frontend's). Blank → Google sign-in disabled. |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_API_VERSION` | WhatsApp Cloud API for optional phone OTP. Blank in dev → code is logged. |
| `SEED_*` | Passwords / identities for the seeded demo accounts (see below). |

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the BookAm backend (default `http://localhost:4000`). |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client id (must match the backend's). Blank → Google button hidden. |

> Document every new env var in the relevant `.env.example`. Never commit real secrets.

---

## Seeded demo accounts

After `npx prisma db seed`, these accounts exist (passwords are overridable via `SEED_*` env vars):

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@bookam.test` | `admin1234` |
| **Coordinator** | `iya.basira@bookam.test` | `alajo1234` |
| **Member** | `amina.yusuf@bookam.test` | `member1234` |

The seed builds a demo circle with members, mixed contribution statuses, and an open appeal with votes — enough to explore every screen immediately.

---

## API surface

Routes are grouped by role and guarded by JWT + role checks:

- **`/auth/*`** — register, login, email OTP verify, magic-link verify, Google sign-in, forgot/reset password, phone OTP, `/auth/me`.
- **`/circles/*`** — coordinator workspace (COORDINATOR, ownership-scoped): circles, members & rotation, contributions & receipt review, payouts, appeals, reminders.
- **`/invite/:token`** — public circle preview; `POST /invite/:token/join` (auth required) creates a join request.
- **`/member/*`** — contributor view (any signed-in user, scoped to their ACTIVE memberships): my circles, own-receipt upload, appeals & voting.
- **`/admin/*`** — platform console (ADMIN): overview, collector applications, plans, subscriptions, users, waitlist.
- **`/waitlist`** — public landing-page email capture.
- **`/uploads/*`** — dev-only static serving of receipt files.

---

## Roadmap

**Done ✅**
- Marketing landing page + waitlist
- Database schema + migrations
- Email-first auth (register, emailed code + magic link, Google sign-in, forgot/reset password, optional phone/WhatsApp OTP)
- Unified `/login` + `/register` with role-based routing
- Public `/become-a-collector` pitch + apply flow
- Dual-role support (be a coordinator and a contributor)
- Shared settings (name, phones, payout account records, change password)
- Payout-account surfacing on both consoles
- Platform admin dashboard
- Create / manage circles; add members + set rotation (drag-to-reorder, soft remove)
- Record contributions (receipt upload → verify/reject → paid/owing), installment ledgers
- Coordinator dashboard (collection card, paid vs owing, who collects next, payout + rotation advance)
- Invite members via shareable link
- Member dashboard at `/me` with own-receipt submission
- Appeals + community voting

**Planned 🔜**
- Paystack integration for BookAm subscription fees (records exist; charge collection is the remaining piece)
- Actual send for WhatsApp / SMS reminders (message + recipient list already generated)
- Cloud receipt storage + signed URLs (S3 / Cloudinary; local disk in dev today)

---

## Glossary

| Term | Meaning |
|---|---|
| **Ajo / Esusu / Adashe** | Nigerian rotating savings & credit associations (ROSCA) — same idea, different regions. |
| **Circle** | One savings group in BookAm. |
| **Coordinator / Collector / Alajo** | The person who runs the circle and records payments. |
| **Rotation / Payout order** | The agreed order in which each member collects the pooled sum. |
| **Pot** | The pooled contributions collected in one cycle (conceptual — BookAm never holds it). |
| **Cycle** | One full round of the rotation. |

---

<p align="center">
  Built for the people who keep their communities saving — one record at a time.<br>
  🌍 <a href="https://bookam.xyz/">bookam.xyz</a>
</p>
