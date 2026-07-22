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
- **Auth (email-first, Gmail-only):** email is the primary identity — one email, one account. **`RegisterDto`, `LoginDto` and `InviteMemberDto` require a `@gmail.com` address** (`@Matches(/@gmail\.com$/i)`) — everyone on BookAm uses a Google/Gmail identity; seed accounts use `@gmail.com` too. (Sign-out clears the whole session and lands on the landing page `/`; there are no landing links inside the authed shells.) Everyone registers as a contributor (MEMBER) with **email + password**; the email is verified by an emailed 6-digit code (`EmailOtp` model + `EmailOtpService`; sent over free Gmail SMTP in `backend/src/auth/email.service.ts` — set `GMAIL_USER` + `GMAIL_APP_PASSWORD`, else dev builds log the mail and surface the code as `devCode`). "Sign in with Google" (verified server-side via Google's tokeninfo endpoint, no SDK; enabled by `GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) signs in directly and **auto-links** to a same-email account — Google emails are already verified, so no extra step. A Google-only user adds a password via forgot-password (the emailed code proves ownership); registering a password on an already-verified email is refused (anti-takeover). **Phone/WhatsApp is optional**, verified in-app from the settings pages (authenticated `POST /auth/phone/send-otp` + `/auth/phone/verify`; `PhoneOtp` + `OtpService`, delivered over the WhatsApp Cloud API in `backend/src/auth/whatsapp.service.ts` — set `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN` + an approved Authentication template `WHATSAPP_TEMPLATE_NAME`, else dev logs the code as `devCode`); verifying a phone auto-claims any circle memberships coordinators created for that number. Becoming a COLLECTOR goes through a `CollectorApplication` (applied from `/me`, approved by the admin). JWT payload is `{ sub, email, role }`; JWT + role guards unchanged. Frontend: unified `/login` + `/register` (email+password, emailed-code step via `components/auth/EmailOtpForm`, Google button), `/forgot-password`, and a "WhatsApp number" verify card in `components/settings/ProfileSettings`. `SafeUser` mirror in `lib/admin/types.ts` (`email` required, `phone` nullable, `emailVerifiedAt`/`phoneVerifiedAt`).
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
│   │   ├── become-a-collector/ # public pitch page for alajos; adapts to the
│   │   │                       #   visitor (sign up → come back → apply inline)
│   │   ├── login/, register/   # unified auth (phone+password, OTP step,
│   │   │                       #   optional Google) — routes users by role
│   │   ├── forgot-password/    # OTP-verified password reset (auto sign-in)
│   │   ├── admin/              # platform-owner console
│   │   │   ├── login/          # admin sign-in
│   │   │   └── (dashboard)/    # guarded shell: overview, applications,
│   │   │                       #   subscriptions, users, settings
│   │   ├── dashboard/          # coordinator (alajo) workspace
│   │   │   ├── login/          # coordinator sign-in
│   │   │   └── (app)/          # guarded shell: circle list + settings + per-circle
│   │   │       └── circles/[id]/   # overview (+ appeal decisions), members,
│   │   │                           #   contributions, payout (shows collector's account)
│   │   ├── me/                 # member (contributor) dashboard — read-mostly
│   │   │   ├── login/          # (redirects to /login)
│   │   │   └── (app)/          # shell: my circles + settings + per-circle
│   │   │       └── circles/[id]/   # overview + my receipt (+ coordinator's
│   │   │                           #   "pay to" account), members, appeals
│   │   └── join/[token]/       # public invite page (member joins a circle)
│   ├── components/     # UI components (landing/*, admin/*, dashboard/*, member/*,
│   │                   #   auth/*, settings/* — shared profile/password form)
│   ├── lib/auth/       # unified auth client (login/register/OTP/Google, role routing)
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

- **User** ✓ — a person. May be a coordinator, a member, or both. Identified by **email** (unique, required; `emailVerifiedAt`). Optional `googleId` (linked on same-email Google sign-in), optional `phone` (unique, nullable; `phoneVerifiedAt` — verified in-app to claim memberships), and an optional `passwordHash` (Google-only users may have none). Has `role` (MEMBER | COORDINATOR | ADMIN), `status` (ACTIVE | SUSPENDED).
- **CollectorApplication** ✓ — a user's request to become a coordinator: applicant, status (PENDING | APPROVED | REJECTED), applicant's note, reviewNote, reviewedBy, reviewedAt. Approving promotes the applicant to COORDINATOR.
- **SubscriptionPlan** ✓ — a BookAm SaaS pricing tier: name, priceNaira, interval (MONTHLY | QUARTERLY | YEARLY), maxCircles (null = unlimited), features[], active. *This is BookAm's own revenue, not ajo money.*
- **Subscription** ✓ — which user is on which plan: status (ACTIVE | EXPIRED | CANCELLED), periodStart/periodEnd. Records only; Paystack charge collection is a marked TODO.
- **Circle** ✓ — one rotating savings group: name, contribution amount, frequency (daily/weekly/monthly), status (ACTIVE | COMPLETED | PAUSED), coordinator (User), `memberTarget` (planned rotation size), and an optional `inviteToken` for the shareable join link.
- **Membership** ✓ — an **account** in a Circle (`userId` always set; `name`/`phone` copied from their profile). Status: **INVITED** (coordinator added them by email → they accept from their dashboard), **REQUESTED** (they asked via the invite link → coordinator approves), **ACTIVE** (in the rotation with a 1-based `position`, assigned on activation), **REMOVED** (soft-removed so records survive). Every member is a real account so they can upload their own receipts — there is no offline name+phone member anymore. Position uniqueness among active members is enforced in the service layer. **Invite flow:** coordinator `POST /circles/:id/members/invite {email}` — **emails the Gmail an invite** (via `EmailService`, exported from AuthModule): if they have an account it links to `/me` to accept; if not, the row is created with `userId: null` + `invitedEmail`, the email links to `/register`, and `AuthService.claimEmailInvites` links it to their account on sign-up/Google sign-in (in `verifyEmail` + `googleSignIn`). Or the shareable link (`GET /invite/:token` public preview; `POST /invite/:token/join` **requires auth**, creates a REQUEST). Coordinator approves/rejects (`.../members/:mid/approve`, `DELETE .../members/:mid/pending`); the member accepts/declines (`/member/invites`, `/member/invites/:mid/accept`, `DELETE /member/invites/:mid`). `CircleDetail` carries `pendingRequests` + `pendingInvites`; the member home shows a "Circle invites" card.
- **Cycle** ✓ — one contribution period/round of a Circle: `index` (unique per circle), status (OPEN | COMPLETED), and the current **collector** (a Membership). One cycle is open at a time; completing a payout opens the next.
- **Contribution** ✓ — one member's payment record for a cycle: amount, status (AWAITING | PENDING_REVIEW | PAID | REJECTED), `receiptFileUrl` (latest proof), rejectionReason, reviewedBy/reviewedAt. Unique per (membership, cycle). **A record only — no funds move.**
- **ContributionReceipt** ✓ — installment ledger: a contribution can be paid **bit by bit**, each part a row with `amountNaira` + `receiptFileUrl` + uploader. `Contribution.paidNaira` (API-computed) = sum of receipts; the coordinator still confirms PAID. `Contribution.receiptFileUrl` mirrors the latest. Uploaded by the member (`/member/circles/:id/receipt`) or coordinator (`/circles/:id/contributions/:cid/receipt`), each accepting an optional `amount` form field (defaults to the full amount).
- **Payout** ✓ — the record of the pot handed to the cycle's collector: status (PENDING | COMPLETED), `receiptFileUrl` (latest transfer proof), amount (computed sum of PAID contributions), completedAt. Unique per cycle. **PayoutReceipt** mirrors ContributionReceipt for paying the collector in installments (`/circles/:id/payout/receipt` + optional `amount`). **BookAm does not disburse.**
- **Schedule** ✓ — `Circle.startDate` + `Cycle.dueAt` (both nullable). Create with `startDate` + `firstDueAt` (ISO); each new round auto-advances the deadline by frequency (`advanceDeadline` in `src/circles/schedule.ts` — daily +1d, weekly +7d, monthly +1mo) when the next cycle opens in `payouts.complete`. Adjustable via `PATCH /circles/:id {startDate, dueAt}` (dueAt updates the open round). **All deadlines are West Africa Time (fixed UTC+1)** — the frontend converts `datetime-local` ↔ ISO with `watInputToISO`/`isoToWatInput` and displays via `formatDeadline` (`timeZone: Africa/Lagos`), so every member sees the same time. Shown on the coordinator + member circle pages; editable in the coordinator settings card.
- **Coordinator fee** ✓ — `Circle.coordinatorFeePercent` (0–100, whole percent; set at create or via `PATCH /circles/:id {feePercent}`). The collector receives **pot − fee**: `PayoutInfo`/`MemberPayout` carry `feeNaira` + `netPayoutNaira` (computed in `src/circles/fee.ts`), and `MemberCircleDetail.coordinatorFeePercent` is shown to every member. Coordinators can **opt into their own circle's rotation** (`POST`/`DELETE /circles/:id/members/join-self`; `CircleDetail.iAmMember`) — running a circle no longer auto-joins them.
- Receipts are **visible to the whole circle** — the member circle-detail (`GET /member/circles/:id`) returns every member's `receipts` + the cycle `payout` receipts; the shared `components/circles/ReceiptLedger` renders them on both consoles.
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
  email `admin@bookam.test`, password `admin1234` — change via `SEED_ADMIN_*` env vars).
  Coordinator dashboard at `/dashboard` (seeded coordinator: email `iya.basira@bookam.test`,
  password `alajo1234` — change via `SEED_COORDINATOR_PASSWORD`; comes with a demo
  circle, members and mixed contribution statuses).
  Member dashboard at `/me` (seeded members, e.g. email `amina.yusuf@bookam.test`, password
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
- [x] Registration + phone OTP verification (everyone joins as contributor; OTP delivery is a `// TODO: WhatsApp/Termii` — dev shows the code; verified phones auto-claim memberships)
- [x] Unified `/login` + `/register` with role-based routing; member "apply to be a collector" flow feeding the existing admin review screen
- [x] Public `/become-a-collector` page (linked from the landing nav + final CTA) — pitch + three steps + auth-aware apply section; signs visitors up and returns them to apply. **Applying happens ONLY on this page** (it will be subscription-gated later — `// TODO: Paystack` in member.service.applyCollector); `/me` shows application *status* only.
- [x] Dual-role support: a collector can also save as a contributor in other circles (memberships are phone-based; `/member/*` has no role gate). Cross-links: "My contributions ↗" in the coordinator sidebar, "Circles I run ↗" in the member nav for coordinators.
- [ ] Google sign-in — built end to end but disabled until `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` are set (create an OAuth client in Google Cloud Console)
- [x] Forgot password (`/forgot-password`, linked from `/login`) — OTP proves phone ownership, sets the new password and signs straight in
- [x] Settings page shared by both dashboards (`/me/settings`, `/dashboard/settings`) — name, second phone, "account to be paid to" (bank/NUBAN/account name — display-only records), change password. User gained `altPhone` + bank fields.
- [x] Payout account surfacing: coordinator's payout screen shows the collector's saved account ("send the pot to"); a member's circle overview shows the coordinator's account ("pay your contribution to"). Records only — transfers stay outside BookAm.
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
