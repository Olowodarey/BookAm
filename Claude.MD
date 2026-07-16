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

> ⚠️ Backend choices below are **assumed** — developer to confirm/correct.

- **Frontend:** `frontend/` — Next.js (App Router) + TypeScript + Tailwind CSS (web app + marketing landing).
- **Backend:** `backend/` — standalone API server, separate from the frontend, TypeScript. *(Framework to confirm — e.g. Express / Fastify / NestJS.)*
- **Database:** PostgreSQL *(assumed, via Prisma ORM)*.
- **Auth:** phone-number OTP (no passwords).
- **Notifications:** WhatsApp / SMS *(e.g. WhatsApp Business API, or a provider like Termii / Africa's Talking)*.
- **Payments:** none held in-app. If "pay in app" is ever added, it must settle **directly** to the recipient via a licensed processor (Paystack/Flutterwave), never into a BookAm-controlled account.

---

## Project structure

Monorepo with separate backend and frontend apps. Update this map as the repo grows.

```
BOOKAM/
├── backend/            # standalone API server (TypeScript)
│   ├── src/            # routes/controllers, services, db access
│   ├── prisma/         # schema.prisma + migrations   (if using Prisma)
│   └── .env.example
├── frontend/           # Next.js (App Router) + TS + Tailwind — web app + landing
│   ├── app/            # routes, incl. the marketing landing
│   ├── components/     # UI components (landing/*, app/*)
│   └── lib/            # api client, helpers
├── .gitignore
└── CLAUDE.md           # this file (repo root)
```

The two apps are independent: the frontend talks to the backend over HTTP. Keep backend
logic in `backend/` and UI in `frontend/` — don't mix them.

---

## Core data model (starting point for the backend)

> These are the domain entities. Refine as you build; keep this section in sync with the actual schema.

- **User** — a person. May be a coordinator, a member, or both. Identified by phone number.
- **Circle** — one rotating savings group. Has: name, contribution amount, frequency (daily/weekly/monthly), member count, status, and the coordinator (a User).
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

## Current status / roadmap

> Keep these checkboxes current.

- [x] Marketing landing page (Next.js + TS + Tailwind)
- [ ] Database schema + migrations
- [ ] Phone OTP auth
- [ ] Create / manage circles
- [ ] Add members + set rotation order
- [ ] Record contributions (mark paid / owing)
- [ ] Coordinator dashboard (paid vs owing, who collects next)
- [ ] Invite members via shareable link
- [ ] WhatsApp / SMS reminders

---

## How to work in this repo (summary for Claude)

Make the changes, keep types clean, keep BookAm tracking-only, update this file when features change — then **stop and let the developer commit and push.**