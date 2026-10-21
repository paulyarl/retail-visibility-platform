# NIL Youth Sports Platform — Technology Overview

**For:** Non-technical stakeholders, reviewers, and proposal evaluators
**Date:** 2026-10-20
**Companion document:** `TECH_STACK.md` (the detailed technical version for development teams bidding on this work)
**Purpose:** Explains — in plain language — the software tools and cloud platforms the NIL Youth Sports Platform will be built with, and the outside services that need to be set up.

---

## 1. What Is Being Built

The NIL Youth Sports Platform is an online marketplace that lets student-athletes (grade school through high school) build public profiles — athletic stats, academic achievements, highlight videos — so that sponsors, schools, coaches, and fans can discover and support them through NIL (Name, Image, Likeness) deals.

Because the platform handles **children's personal information and money**, safety is built into the foundation: nothing about a young athlete becomes public until a parent or legal guardian approves it, and sensitive details (contact information, finances, date of birth) are never exposed publicly.

The platform is **not being built from scratch**. It reuses the proven foundation of an existing, working product (a retail marketplace platform) that already has the account systems, security, and payment plumbing needed. The development team will copy that foundation, remove the retail-specific parts, and build the youth sports features on top. This significantly reduces cost and risk compared to a greenfield build.

## 2. How the Software Is Organized

| Item | Plain-language explanation |
|---|---|
| **One codebase, two applications** | The project lives in a single repository containing a customer-facing website and a behind-the-scenes server application that work together |
| **TypeScript** | The programming language used throughout — an industry standard chosen because it catches errors early and keeps large projects maintainable |
| **Node.js (version 22+)** | The engine that runs the server-side code |
| **pnpm** | The tool that manages the project's software components and keeps them organized |
| **GitHub** | Where the code is stored and versioned — a brand-new repository is created for this product |

## 3. What Users Will See — the Website

The website is the part athletes, parents, sponsors, coaches, and fans interact with.

| Tool / Platform | What it does for us |
|---|---|
| **Next.js 16 + React 19** | The industry-leading framework for building fast, modern websites — the same technology used by major consumer brands |
| **Mantine + Tailwind CSS** | The design system — pre-built, professional-looking components (dashboards, tables, forms, menus) so the site looks polished without designing every button from scratch |
| **Auth0** | The secure login system — handles sign-up, passwords, and the eight different user types (athlete, guardian, school, coach, sponsor, fan, admin, compliance auditor) |
| **Sentry** | Error monitoring — alerts the team the moment something breaks on a user's screen |
| **Vercel** | The hosting platform where the website lives — provides fast global delivery, automatic security certificates (HTTPS), and the custom domain |

Notably, the platform **does not host video**. Highlight reels stay on the services athletes already use (YouTube, Hudl) — the platform stores only the links, which keeps hosting costs low and lets families keep control of their footage.

## 4. Behind the Scenes — the Server & Data

| Tool / Platform | What it does for us |
|---|---|
| **Express** | The server application that answers every request from the website (Node.js/TypeScript) |
| **PostgreSQL on Supabase** | The database — stores profiles, consent records, deals, and rosters. Supabase is a managed database service, so backups, recovery, and scaling are handled for us |
| **Prisma** | The tool the code uses to read and write to the database safely |
| **Stripe** | Payments — handles sponsor deal payments, escrow-style milestone payouts to guardians (after identity verification), and subscription fees |
| **SendGrid** | Email delivery — invitations, approvals, notifications, receipts |
| **OpenAI** | Powers the in-platform assistant — a help bot that answers eligibility, onboarding, and compliance questions using the platform's own rulebook, with child-safety guardrails |
| **Railway** | The hosting platform where the server application runs |
| **Doppler** | Secrets management — keeps passwords, API keys, and credentials out of the code and centrally controlled across development, staging, and production |

## 5. How the System Protects Young Athletes

These design principles shape every technology choice above — worth understanding even without a technical background:

- **Two separate pipelines.** Public pages (rosters, profiles) are served from a fast, cached layer. Anything private — consent settings, deals, finances — travels a separate, never-cached, always-authenticated path.
- **Nothing goes public by default.** A new athlete profile starts invisible. It only appears publicly after a guardian grants specific permissions, content moderation clears it, and a compliance check passes.
- **Each athlete is a private compartment.** Every athlete's data is walled off as its own unit, making it structurally difficult for one athlete's information to leak into another's view.
- **Parents hold the keys.** The guardian — never the platform and never the child alone — controls what is visible, and can revoke it at any time. Revocation takes effect immediately.
- **Every action leaves a trail.** Approvals, deal changes, and administrative actions are logged for audit — without storing children's personal details in the audit records themselves.

## 6. Outside Accounts & Services to Set Up

Everything below is a **new account** created for this product (nothing is shared with the existing retail platform). These are also the recurring third-party costs of running the platform.

| Service | Role | Setup notes |
|---|---|---|
| **Supabase** (Pro plan) | Database | New project; supports recovery and growth headroom |
| **Auth0** | Login & user roles | New tenant; eight user types configured |
| **Vercel** | Website hosting | New project; custom domain and HTTPS included |
| **Railway** | Server hosting | New service |
| **Doppler** | Secrets management | Three environments: local, staging, production |
| **Stripe** | Payments | New account; guardian identity verification for payouts |
| **SendGrid** | Email | New or existing account; platform-branded email templates |
| **OpenAI** | Help bot / AI | New API key |
| **Sentry** | Error monitoring | New project; configured so children's data is never sent to it |
| **GitHub** | Code storage | New repository |

---

*For technical reviewers: the complete specification — including architecture invariants, testing gates, delivery estimates (≈39–73 engineer-weeks), and proposal evaluation guidance — is in `TECH_STACK.md` in this folder.*
