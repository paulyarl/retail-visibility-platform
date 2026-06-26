# NIL Youth Sports Platform — Frontend Specification

**Document Version:** 1.0
**Purpose:** Defines every frontend surface — public profiles, private dashboards, media assets, social engagement, and UX patterns — for the NIL platform. Derived from `TECHNICAL_SPEC.md` §2 (actor model), §15 (per-actor dashboards), §3 (firewall/visibility), §8 (privacy loop), §12 (gap analysis), and the user's wireframe input.

**Skills enforced:**
- `saas-navigation` — sidebar, Cmd+K, breadcrumbs, workspace switcher
- `skill-frontend-ux-guardrails` — responsive, loading/empty/error states, stable dimensions, no horizontal scroll
- `skill-saas-admin-dashboard` — dense admin screens, explicit filters, audit history, role-gated routes

**Reuse mandate (TECHNICAL_SPEC §15):** Do not build new shells. Reuse `CrmPageShell.tsx`, `CrmNavPanel.tsx`, `DashboardHeader.tsx`, `KpiCard.tsx`, `Sparkline.tsx`, `DashboardSkeleton.tsx`, `TierBadge.tsx`, `FeatureCard.tsx`, `CapabilityShowcase.tsx`, `QuickActions.tsx`, `GrowthTipCard.tsx`, `ServerResolvedContextProvider.tsx`.

---

## 1. Layout Architecture

### 1.1 Shell Pattern

Every authenticated surface uses the same shell:

```
┌─────────────────────────────────────────────────┐
│  Top Bar (context + utilities + user account)    │
├──────────┬──────────────────────────────────────┤
│          │  Breadcrumbs (full path to root)      │
│  Left    ├──────────────────────────────────────┤
│  Sidebar │  Page Title + Subtitle + Actions      │
│  (Nav)   ├──────────────────────────────────────┤
│          │                                       │
│          │  Content Area                         │
│          │  (KPI cards, tables, charts, feeds)   │
│          │                                       │
└──────────┴──────────────────────────────────────┘
```

- **Shell component:** `CrmPageShell` (Mantine-based, breadcrumbs, badge counts, nav panel, actions slot)
- **Sidebar:** Database-driven `navigation_links` table, rendered via `useNavLinks` hook → `DynamicTenantSidebar` / `AdminNavContent` / `UniversalNavContent`
- **Top bar:** Context (tenant/athlete name + avatar), Cmd+K palette, user account dropdown
- **Breadcrumbs:** Every drill-down page shows full path back to root (saas-navigation skill)

### 1.2 Public Surfaces (No Shell)

Public surfaces use a minimal layout — no sidebar, no auth context:
- `/` — Marketing landing (Stage E)
- `/roster` — Public athlete roster directory
- `/athletes/:athleteTenantId` — Public athlete profile
- `/institutions/:tenantId/public` — Public institution roster page

These use `NilPublicApiSingleton` (cached, no credentials, 5–15 min TTL).

### 1.3 Command Palette (Cmd+K)

Context-aware per actor:
- **Guardian:** "Go to [Athlete Name]", "Approve pending deal", "Revoke consent for [scope]"
- **Athlete:** "Edit profile", "Upload highlight", "View my deals"
- **Institution/Coach:** "Go to roster", "Add to recruiting board", "Verify achievement"
- **Sponsor:** "Propose deal", "View deal pipeline", "Search athletes"
- **Fan:** "Follow [Athlete]", "View feed", "My badges"
- **Compliance:** "Review queue", "Broadcast alert", "Audit log"

### 1.4 Workspace Switcher

**Guardian** sees a workspace switcher (sidebar header) listing their athlete-tenants — each athlete is a separate tenant. Visual differentiation via athlete avatar + name. This mirrors the hybrid model from saas-navigation skill.

**Institution** sees a switcher if they manage multiple teams (e.g., football + basketball).

**Sponsor** sees a switcher if they have multiple sponsor-tenants (rare but possible).

---

## 2. Public Athlete Profile

**Route:** `/athletes/:athleteTenantId`
**Base service:** `NilPublicRosterService` (extends `NilPublicApiSingleton`)
**Data source:** `GET /api/public/athletes/:athleteTenantId`
**Firewall rules:** `visibility_status = 'approved'` only; consent-gated field projection; no PII (§3.2)

### 2.1 Layout

```
┌─────────────────────────────────────────────────┐
│  Hero Banner                                     │
│  ┌──────┐  Name · Position · Grade               │
│  │Avatar│  Institution Name · Team               │
│  └──────┘  [Follow] [Share]                      │
├─────────────────────────────────────────────────┤
│  Tab Bar: Overview | Highlights | Stats |        │
│           Achievements | Deals                   │
├─────────────────────────────────────────────────┤
│                                                   │
│  Tab Content (scrollable)                        │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 2.2 Overview Tab

| Section | Fields | Consent Gate | Notes |
|---|---|---|---|
| **Athlete Card** | Name, position, grade, institution, team, avatar | `public_profile` | Always visible if approved |
| **Physical Stats** | Height, weight, wingspan | `public_profile` | Sport-agnostic JSON from `athlete_metrics_list` |
| **Academic** | GPA | `gpa_display` | Hidden if consent not granted; show "Academic info not shared" placeholder |
| **Performance Graph** | Stats over time (chart) | `public_profile` | `Sparkline` or `MiniAreaChart` component; sport-agnostic `stats_blob jsonb` |
| **Achievement Highlights** | Top 3 verified achievements | `public_profile` | From `athlete_achievements_list` where `status='approved'`; sorted by date |
| **Active Deals** | Count + sponsor names | `public_profile` | Only deal count + sponsor name (public); no financial amounts |
| **Fan Engagement** | Follower count, badge count | `public_profile` | From `fan_badges_list` aggregate |

### 2.3 Highlights Tab

| Section | Component | Consent Gate | Notes |
|---|---|---|---|
| **Photo Gallery** | Grid of `highlight_media_list` where `media_type='image'` | `media_display` | Each photo shows view count (stats below) |
| **Video Gallery** | `ProductVideoPlayer` facade (YouTube/Vimeo allowlisted) | `media_display` | Each video shows view count + engagement stats |
| **Media Stats** | Per-asset: views, likes, shares | `media_display` | Aggregate below gallery |

**Child-safety:** All media URLs validated against allowlist. Non-allowlisted hosts rejected at ingestion (§12.7). Moderation state must be `cleared`.

### 2.4 Stats Tab

| Section | Component | Notes |
|---|---|---|
| **Performance Over Time** | Line chart (Mantine Charts or Recharts) | X-axis: season/date; Y-axis: sport-agnostic metric from `stats_blob` |
| **Career Stats** | Table (dense, sortable) | Key-value pairs from `athlete_metrics_list` |
| **Physical Development** | Table | Height/weight over time if available |

### 2.5 Achievements Tab

| Section | Component | Notes |
|---|---|---|
| **Achievement Timeline** | Vertical timeline (Mantine Timeline) | Only `status='approved'` achievements; date, title, description, verified badge |
| **Verification Badge** | Icon + "Verified by [Institution]" | From `athlete_achievements_list.verified_by` |

### 2.6 Deals Tab (Public)

| Section | Fields | Notes |
|---|---|---|
| **Active Deals** | Sponsor name, deal type, start/end date | No financial amounts on public view |
| **Completed Deals** | Sponsor name, completion date | Historical record |

---

## 3. Private Dashboards

### 3.1 Guardian Dashboard

**Route:** `/guardian`
**Base service:** `GuardianService` (extends `GuardianApiSingleton`)
**Shell:** `CrmPageShell` + custom `GuardianNavPanel`
**Workspace switcher:** Yes — lists all linked athlete-tenants

#### Sidebar Navigation

```
My Athletes
Pending Approvals
Consent Management
Deal Inbox
Messages
Payouts & KYC
Alerts
Settings
```

#### Dashboard — Overview

```
┌──────────────────────────────────────────────────┐
│  DashboardHeader: "Welcome, [Guardian Name]"      │
│  Workspace switcher: [Athlete 1 ▾]                │
├──────────┬──────────┬──────────┬─────────────────┤
│ KPI Card │ KPI Card │ KPI Card │ KPI Card        │
│ My       │ Pending  │ Active   │ NIL Earnings    │
│ Athletes │ Approvals│ Deals    │ (YTD)           │
│ [n]      │ [n]      │ [n]      │ $[amount]       │
├──────────┴──────────┴──────────┴─────────────────┤
│                                                    │
│  My Athletes List [n + 1]                         │
│  ┌──────────────────────────────────────────┐    │
│  │ [Avatar] Name · Position · Grade          │    │
│  │           Institution · Team              │    │
│  │           Consent: [✓ Public] [✓ GPA]     │    │
│  │           [✗ Media] [✗ Deals]             │    │
│  │           Status: [Approved/Pending]      │    │
│  └──────────────────────────────────────────┘    │
│  (repeat for each athlete)                        │
│                                                    │
├────────────────────────────────────────────────────┤
│  Pending Approvals                                │
│  ┌──────────────────────────────────────────┐    │
│  │ [Type] From → Athlete · [Approve] [Deny]  │    │
│  │  Deal offer from [Sponsor] for [Athlete]  │    │
│  │  Media upload for [Athlete]               │    │
│  │  Institution link request for [Athlete]   │    │
│  │  Message request from [Coach]             │    │
│  └──────────────────────────────────────────┘    │
│  (repeat for each pending item)                   │
│                                                    │
├────────────────────────────────────────────────────┤
│  Payout & KYC Status                              │
│  ┌──────────────────────────────────────────┐    │
│  │ KYC Status: [Verified/Pending]            │    │
│  │ Next Payout: $[amount] on [date]          │    │
│  │ Payout Method: [Stripe/ACH]               │    │
│  └──────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

#### Consent Management Page

| Section | Component | Notes |
|---|---|---|
| **Consent Matrix** | Table: athlete × scope | Rows: athletes; Columns: `public_profile`, `gpa_display`, `media_display`, `nil_deals`, `messaging` |
| **Consent Toggle** | Switch (Radix) | Grant/revoke per scope; revocation triggers cascade (§12.6) |
| **Consent History** | Timeline | Versioned consent records from `consent_records_list` with timestamps |
| **Guardian Required** | Badge | If multiple guardians, "most-restrictive-wins" indicator (§12.6) |

#### Deal Inbox Page

| Section | Component | Notes |
|---|---|---|
| **Deal List** | Table with status chips | From `sponsorship_deals_list`; dual-visibility RLS |
| **Deal Detail** | Drawer/modal | Sponsor, amount, milestones, escrow state, guardian payout split |
| **Approve/Reject** | Action buttons | Guardian approval required for minor athlete deals |

### 3.2 Athlete Dashboard (Post Age-Out)

**Route:** `/athletes/:athleteTenantId/dashboard`
**Base service:** `AthleteService` (extends `AthleteApiSingleton`)
**Shell:** `CrmPageShell` + `AthleteNavPanel`

> **Pre age-out:** Athlete has no direct dashboard access. Guardian manages everything. After age-out (18), athlete gains financial scope and direct access.

#### Sidebar Navigation

```
Profile
Highlights
Stats & Performance
My Deals
Messages
Followers & Fans
Settings
```

#### Dashboard — Overview

```
┌──────────────────────────────────────────────────┐
│  DashboardHeader: "[Athlete Name]"                │
│  [Avatar] Position · Institution · Grade          │
├──────────┬──────────┬──────────┬─────────────────┤
│ KPI Card │ KPI Card │ KPI Card │ KPI Card        │
│ NIL      │ Active   │ Followers│ Profile         │
│ Earnings │ Deals    │          │ Completeness   │
│ $[amt]   │ [n]      │ [n]      │ [n]%           │
├──────────┴──────────┴──────────┴─────────────────┤
│                                                    │
│  Performance Graph (over time)                    │
│  ┌──────────────────────────────────────────┐    │
│  │  [Line chart: stats over seasons]         │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Active Deals                                     │
│  ┌──────────────────────────────────────────┐    │
│  │ [Sponsor] · $[amount] · [Status chip]     │    │
│  │  Milestone: [1/3] · Next: [date]          │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Highlights                                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │ [Photo]│ │ [Video]│ │ [Photo]│ │ [Video]│    │
│  │ Views  │ │ Views  │ │ Views  │ │ Views  │    │
│  │  [n]   │ │  [n]   │ │  [n]   │ │  [n]   │    │
│  └────────┘ └────────┘ └────────┘ └────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Profile Completeness                             │
│  ┌──────────────────────────────────────────┐    │
│  │ [Progress bar: 85%]                       │    │
│  │ Missing: Highlight video, Physical stats  │    │
│  └──────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

#### Profile Page

| Section | Component | Notes |
|---|---|---|
| **Edit Profile Form** | Mantine form (react-hook-form + Zod) | Name, position, grade, physical stats (JSON), bio |
| **Visibility Status** | Status chip (`draft`/`pending`/`approved`/`rejected`/`archived`) | Shows current firewall state |
| **Submit for Review** | Button | Transitions `draft → pending`; triggers compliance + moderation queue |

#### Highlights Page

| Section | Component | Notes |
|---|---|---|
| **Upload Form** | URL input + media type selector | Allowlisted hosts only; `ProductVideoPlayer` facade for video |
| **Media Grid** | Grid with moderation status chips | Each item: thumbnail, type, views, `moderation_status` chip |
| **Moderation State** | Per-asset: `pending`/`cleared`/`rejected` | Rejected items show rejection reason |

#### Stats & Performance Page

| Section | Component | Notes |
|---|---|---|
| **Stats Entry Form** | Key-value form for sport-agnostic metrics | Writes to `athlete_metrics_list` |
| **Performance Chart** | Line chart over time | `MiniAreaChart` or Recharts |
| **Stats History** | Sortable table | Date, metric, value |

#### My Deals Page

| Section | Component | Notes |
|---|---|---|
| **Deal Pipeline** | Kanban board (Mantine) | Columns: `proposed`, `funded`, `locked`, `milestone_released`, `settled`, `disputed` |
| **Deal Detail** | Drawer | Sponsor, amount, milestones, escrow state, payout schedule |
| **Deal Analytics** | KPI cards + chart | Total earnings, active deals, average deal size, ROI for sponsor |

### 3.3 Sponsor Dashboard

**Route:** `/sponsors/:tenantId`
**Base service:** `SponsorService` (extends `SponsorApiSingleton`)
**Shell:** `CrmPageShell` + `SponsorNavPanel`

#### Sidebar Navigation

```
Dashboard
Deal Pipeline
Athlete Discovery
Campaigns
Messages
Spending & Budget
Settings
```

#### Dashboard — Overview

```
┌──────────────────────────────────────────────────┐
│  DashboardHeader: "[Sponsor Name]"                │
│  [Logo] Sponsor Tenant · Tier: [badge]            │
├──────────┬──────────┬──────────┬─────────────────┤
│ KPI Card │ KPI Card │ KPI Card │ KPI Card        │
│ Active   │ Pending  │ NIL      │ Campaign        │
│ Deals    │ Deals    │ Spending │ Performance    │
│ [n+1]    │ [count]  │ $[amt]   │ [graph]        │
├──────────┴──────────┴──────────┴─────────────────┤
│                                                    │
│  Active Deals [n + 1]                             │
│  ┌──────────────────────────────────────────┐    │
│  │ [Athlete Avatar] Student Name             │    │
│  │   $[amount] · [Status chip]               │    │
│  │   Milestone: [1/3] · Next payout: [date]  │    │
│  └──────────────────────────────────────────┘    │
│  (repeat for each active deal)                    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Campaign Performance                             │
│  ┌──────────────────────────────────────────┐    │
│  │  [Bar/Line chart: ROI over time]          │    │
│  │  X: campaign · Y: engagement/spend        │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  NIL Spending                                     │
│  ┌──────────────────────────────────────────┐    │
│  │  Total: $[amount]                         │    │
│  │  This Quarter: $[amount]                  │    │
│  │  Budget Cap: $[amount] ([n]% used)        │    │
│  │  [Progress bar]                            │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Pending Deals                                    │
│  ┌──────────────────────────────────────────┐    │
│  │  Count: [n]                               │    │
│  │  [Deal 1] → [Athlete] · $[amount]         │    │
│  │  [Deal 2] → [Athlete] · $[amount]         │    │
│  └──────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

#### Deal Pipeline Page

| Section | Component | Notes |
|---|---|---|
| **Kanban Board** | Mantine Kanban (drag-drop) | Columns: `proposed`, `funded`, `locked`, `milestone_released`, `settled`, `disputed` |
| **Deal Card** | Athlete avatar + name + amount + milestone progress | Drag to change status (with guardian approval gate for minor deals) |
| **New Deal Button** | Modal form | Athlete search (consented/public only), offer amount, milestones, escrow terms |

#### Athlete Discovery Page

| Section | Component | Notes |
|---|---|---|
| **Search & Filter** | Search bar + filters (sport, position, grade, institution, region) | Queries `mv_athlete_discovery` via `NilPublicRosterService` |
| **Athlete Cards Grid** | Cards with avatar, name, position, institution, key stats | Only `approved` + `public_profile` consent; no PII |
| **Athlete Detail Link** | → `/athletes/:athleteTenantId` | Public profile page |
| **Propose Deal Button** | Per athlete (if `nil_deals` consent granted) | Opens deal creation modal |

#### Spending & Budget Page

| Section | Component | Notes |
|---|---|---|
| **Spend Summary** | KPI cards: total, this quarter, budget cap, % used | From `sponsor_spend_limits_list` |
| **Spend Timeline** | Line chart | Cumulative spend over time |
| **Budget Settings** | Form (tier-gated) | Set quarterly/annual spend caps |

### 3.4 School / Institution Dashboard

**Route:** `/institutions/:tenantId`
**Base service:** `InstitutionService` (extends `InstitutionApiSingleton`)
**Shell:** `CrmPageShell` + `InstitutionNavPanel`

#### Sidebar Navigation

```
Dashboard
Team Roster
Athletic Department
NIL Compliance
NIL Report
Recruiting
Achievements
Messages
Settings
```

#### Dashboard — Overview

```
┌──────────────────────────────────────────────────┐
│  DashboardHeader: "[Institution Name]"            │
│  [Logo] Institution Tenant · Tier: [badge]        │
├──────────┬──────────┬──────────┬─────────────────┤
│ KPI Card │ KPI Card │ KPI Card │ KPI Card        │
│ Team     │ Athletic │ NIL      │ NIL Report      │
│ Roster   │ Dept     │ Compliance│ (budget)      │
│ [n+1]    │ [graph]  │ [%]      │ $[amount]      │
├──────────┴──────────┴──────────┴─────────────────┤
│                                                    │
│  Team Roster [n + 1]                              │
│  ┌──────────────────────────────────────────┐    │
│  │ [Avatar] Student Name                     │    │
│  │   GPA: [x.xx] · Grade: [n]               │    │
│  │   Position: [pos] · Status: [chip]        │    │
│  └──────────────────────────────────────────┘    │
│  (repeat for each athlete)                        │
│                                                    │
├────────────────────────────────────────────────────┤
│  Athletic Department Performance                  │
│  ┌──────────────────────────────────────────┐    │
│  │  [Bar chart: team performance by season]  │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  NIL Compliance                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  Compliance Score: [n]%                   │    │
│  │  [Progress ring/bar]                       │    │
│  │  Pending reviews: [n]                      │    │
│  │  Eligibility rules: [state] · [status]    │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  NIL Report                                       │
│  ┌──────────────────────────────────────────┐    │
│  │  Operating Budget: $[amount]              │    │
│  │  NIL Funding: $[amount]                   │    │
│  │  Active Deals: [n]                        │    │
│  │  Total Athlete Earnings: $[amount]        │    │
│  └──────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

#### Team Roster Page

| Section | Component | Notes |
|---|---|---|
| **Roster Table** | Dense table (saas-admin-dashboard pattern) | Columns: name, position, grade, GPA (consent-gated), visibility status, compliance status |
| **Add Athlete** | Button → modal | Invite guardian to provision athlete-tenant linked to this institution |
| **Export Roster** | CSV/PDF export | Tier-gated |
| **Filters** | Status, grade, position, compliance | Explicit filter bar (UX guardrail) |

#### NIL Compliance Page

| Section | Component | Notes |
|---|---|---|
| **Compliance Score** | Progress ring | Percentage of athletes with cleared compliance |
| **Eligibility Rules** | Table from `nil_eligibility_rules_list` | State/association/bylaw rules with `deals_allowed` flag |
| **Pending Reviews** | Queue | Athletes awaiting compliance verification |
| **Audit Trail** | Timeline | Status changes with actor, timestamp, reason |

#### NIL Report Page

| Section | Component | Notes |
|---|---|---|
| **Operating Budget** | KPI card | Institution's athletic department budget |
| **NIL Funding** | KPI card | Total NIL funding facilitated |
| **Deal Summary** | Table | All deals involving institution's athletes |
| **Export** | PDF/CSV | For athletic department reporting |

### 3.5 Coach Dashboard

**Route:** `/institutions/:tenantId/coach`
**Base service:** `InstitutionService` (coach acts within institution-tenant)
**Shell:** `CrmPageShell` + `CoachNavPanel`

#### Sidebar Navigation

```
Dashboard
Team Roster
Recruiting Board
Messages
Events
Settings
```

#### Dashboard — Overview

```
┌──────────────────────────────────────────────────┐
│  DashboardHeader: "Coach [Name]"                  │
│  Position: [pos] · School: [institution]          │
├──────────┬──────────┬──────────┬─────────────────┤
│ KPI Card │ KPI Card │ KPI Card │ KPI Card        │
│ Team     │ Recruiting│ Messages│ Events          │
│ Roster   │ Board    │          │                 │
│ [n+1]    │ [n+1]    │ [n]      │ [n]             │
├──────────┴──────────┴──────────┴─────────────────┤
│                                                    │
│  Team Roster [n + 1]                              │
│  ┌──────────────────────────────────────────┐    │
│  │ [Avatar] Name · Position · Grade          │    │
│  │   Status: [chip] · Compliance: [chip]     │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Recruiting Board [n + 1]                        │
│  ┌──────────────────────────────────────────┐    │
│  │ [Avatar] Name · Position · Rating [★ n]   │    │
│  │   School: [current] · Grade: [n]          │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Messages                                         │
│  ┌──────────────────────────────────────────┐    │
│  │  [Thread] from [Guardian] re: [Athlete]   │    │
│  │  [Thread] from [Sponsor] re: [Athlete]    │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Events                                           │
│  ┌──────────────────────────────────────────┐    │
│  │  [Date] [Event name] · [Location]         │    │
│  │  Tryout · Signing · Game · Tournament     │    │
│  └──────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

#### Recruiting Board Page

| Section | Component | Notes |
|---|---|---|
| **Board Columns** | Kanban (e.g., "Watching", "Contacted", "Offered", "Committed") | From `recruiting_boards_list` |
| **Athlete Card** | Avatar, name, position, rating (stars), school, grade | Private — only visible to institution staff |
| **Add to Board** | Search + add button | Search public roster; add to board with rating |
| **Contact Athlete** | Button → guardian-gated message thread | **Adult→minor contact is guardian-gated** (§12.2); request lands in guardian's pending approvals |

### 3.6 Fan Dashboard

**Route:** `/fans`
**Base service:** `FanService` (extends `FanApiSingleton`)
**Shell:** `CrmPageShell` + `FanNavPanel`

> **Always-free, not tier-gated** (§12.9). No financial surfaces. No minor PII. No direct messaging to athletes.

#### Sidebar Navigation

```
Dashboard
Social Feed
Favorite Athletes
Followed Teams
Fan Badges
Settings
```

#### Dashboard — Overview

```
┌──────────────────────────────────────────────────┐
│  DashboardHeader: "[Fan Name]"                    │
│  Nickname: [nickname]                             │
├──────────┬──────────┬──────────┬─────────────────┤
│ KPI Card │ KPI Card │ KPI Card │ KPI Card        │
│ Favorite │ Followed │ Following│ Followers       │
│ Athletes │ Teams    │          │                 │
│ [n+1]    │ [n+1]    │ [count]  │ [count]         │
├──────────┴──────────┴──────────┴─────────────────┤
│                                                    │
│  Favorite Athletes [n + 1]                       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │[Avatar]│ │[Avatar]│ │[Avatar]│ │[Avatar]│    │
│  │ Name   │ │ Name   │ │ Name   │ │ Name   │    │
│  │ Pos    │ │ Pos    │ │ Pos    │ │ Pos    │    │
│  └────────┘ └────────┘ └────────┘ └────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Followed Teams [n + 1]                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │[Logo]  │ │[Logo]  │ │[Logo]  │ │[Logo]  │    │
│  │ Name   │ │ Name   │ │ Name   │ │ Name   │    │
│  └────────┘ └────────┘ └────────┘ └────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Fan Badges [n + 1]                              │
│  ┌──────────────────────────────────────────┐    │
│  │ [Badge Icon] Super Fan                    │    │
│  │ [Badge Icon] NIL Supporter                │    │
│  │ [Badge Icon] [Custom badge]               │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Fan Feed [n + 1]                                │
│  ┌──────────────────────────────────────────┐    │
│  │ [Fan Avatar] Fan 1                        │    │
│  │   "Message text..."                       │    │
│  │   [Photo]                                 │    │
│  │   ❤ [n] · 💬 [n] · [time]                 │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │ [Fan Avatar] Fan 2                        │    │
│  │   "Message text..."                       │    │
│  │   [Photo]                                 │    │
│  │   ❤ [n] · 💬 [n] · [time]                 │    │
│  └──────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

#### Social Feed Page

| Section | Component | Notes |
|---|---|---|
| **Feed Posts** | Card list (infinite scroll) | Posts from followed athletes + followed teams; only `approved` + consented content |
| **Post Card** | Avatar, name, message, photo/video, likes, comments, timestamp | `ProductVideoPlayer` facade for video content |
| **Create Post** | Text input + photo upload | Fans can post to the community feed; no PII about athletes allowed in posts |
| **Engagement** | Like, comment, share buttons | Gamified via `fan_badges_list` (e.g., "Super Fan" for 100+ likes given) |

#### Favorite Athletes Page

| Section | Component | Notes |
|---|---|---|
| **Athlete Grid** | Cards with avatar, name, position, institution | Only `approved` + `public_profile` consent |
| **Unfollow Button** | Per card | Removes from fan's followed list |
| **View Profile** | Link → `/athletes/:athleteTenantId` | Public profile page |

#### Followed Teams Page

| Section | Component | Notes |
|---|---|---|
| **Team Grid** | Cards with logo, name, sport | Institution public pages |
| **Unfollow Button** | Per card | |

#### Fan Badges Page

| Section | Component | Notes |
|---|---|---|
| **Badge Collection** | Grid of earned badges | From `fan_badges_list`; each badge has icon, name, description, earned date |
| **Badge Progress** | Progress bars for unearned badges | "X/100 likes to earn Super Fan" |

### 3.7 Compliance / Admin Dashboard

**Route:** `/admin/nil`
**Base service:** `ComplianceService` (extends `ComplianceApiSingleton`)
**Shell:** `CrmPageShell` + `AdminNavPanel` (reuses existing admin nav)

> Follows `skill-saas-admin-dashboard` guardrails: dense, calm, scannable. No hero sections. Explicit filters. Audit history.

#### Sidebar Navigation

```
Dashboard
Review Queue
Profiles
Media Moderation
Deals
Eligibility Rules
Audit Log
Erasure Requests
Broadcast Alerts
Users
Settings
```

#### Dashboard — Overview

```
┌──────────────────────────────────────────────────┐
│  DashboardHeader: "NIL Compliance Dashboard"      │
├──────────┬──────────┬──────────┬─────────────────┤
│ KPI Card │ KPI Card │ KPI Card │ KPI Card        │
│ Pending  │ Media    │ Active   │ Erasure         │
│ Reviews  │ Queue    │ Deals    │ Requests        │
│ [n]      │ [n]      │ [n]      │ [n]             │
├──────────┴──────────┴──────────┴─────────────────┤
│                                                    │
│  Review Queue (unified)                          │
│  ┌──────────────────────────────────────────┐    │
│  │ [Type] [Entity] · [Status] · [Approve]    │    │
│  │  Profile: [Athlete] · pending             │    │
│  │  Media: [Athlete] · [URL] · pending       │    │
│  │  Deal: [Sponsor]→[Athlete] · proposed     │    │
│  └──────────────────────────────────────────┘    │
│                                                    │
├────────────────────────────────────────────────────┤
│  Audit Log (recent)                              │
│  ┌──────────────────────────────────────────┐    │
│  │ [Timestamp] [Actor] [Action] [Entity]     │    │
│  │  2024-01-15 Guardian approved deal...     │    │
│  │  2024-01-15 Compliance cleared profile... │    │
│  └──────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

#### Review Queue Page

| Section | Component | Notes |
|---|---|---|
| **Unified Queue** | Table with type, entity, status, actor, timestamp | Profiles, media, deals in one queue |
| **Filters** | Type, status, date range, actor | Explicit filter bar (saas-admin-dashboard guardrail) |
| **Approve/Reject** | Action buttons with reason field | Rejection requires reason; triggers cache eviction |
| **Bulk Actions** | Select-all + bulk approve/reject | For high-volume moderation |

#### Media Moderation Page

| Section | Component | Notes |
|---|---|---|
| **Media Queue** | Grid of pending media items | Thumbnail, athlete, host, submitted date |
| **Allowlist Check** | Badge per item (allowlisted/not) | Non-allowlisted = auto-reject |
| **Approve/Reject** | Per item + bulk | Rejection reason required |

#### Eligibility Rules Page

| Section | Component | Notes |
|---|---|---|
| **Rules Table** | Dense table from `nil_eligibility_rules_list` | State, association, bylaw, `deals_allowed`, effective date |
| **Add/Edit Rule** | Form (admin-only) | Data-driven; no code change to update rules |
| **Filter** | State, association, status | Explicit filters |

#### Audit Log Page

| Section | Component | Notes |
|---|---|---|
| **Audit Table** | Dense, paginated table from `audit_log` | Timestamp, actor, action, entity, diff, IP |
| **Filters** | Actor, action, entity, date range, tenant | Explicit filter bar |
| **Export** | CSV | For compliance reporting |

#### Erasure Requests Page

| Section | Component | Notes |
|---|---|---|
| **Request Queue** | Table from `data_erasure_requests_list` | Athlete, guardian, requested date, scheduled deletion date, status |
| **Process Request** | Button → confirmation modal (destructive) | Triggers cascade: archive → anonymize → delete → evict caches → certificate |
| **Audit Certificate** | Per request | Proof of erasure for legal compliance |

---

## 3a. Standard Dashboard Panels (Cross-Actor)

Every private dashboard — regardless of actor — renders the same set of **5 standard panels** in a right-rail or below-the-fold section. These are cross-cutting widgets that provide proactive guidance, task tracking, contextual tips, and athlete status at a glance. They reuse existing platform primitives — no new shells.

### 3a.1 Panel Layout

```
┌────────────────────────────────────────────┬──────────────────┐
│                                              │  Standard Panels │
│  Main Dashboard Content                      │  (Right Rail)    │
│  (KPI cards, tables, charts, feeds)          │                  │
│                                              │  ┌────────────┐ │
│                                              │  │ Athlete     │ │
│                                              │  │ Summary     │ │
│                                              │  └────────────┘ │
│                                              │  ┌────────────┐ │
│                                              │  │ Athlete     │ │
│                                              │  │ Status      │ │
│                                              │  └────────────┘ │
│                                              │  ┌────────────┐ │
│                                              │  │ Next Steps  │ │
│                                              │  └────────────┘ │
│                                              │  ┌────────────┐ │
│                                              │  │ Task List   │ │
│                                              │  └────────────┘ │
│                                              │  ┌────────────┐ │
│                                              │  │ Actor-Aware │ │
│                                              │  │ Tips        │ │
│                                              │  └────────────┘ │
└──────────────────────────────────────────────┴──────────────────┘
```

**Responsive behavior:**
- **Desktop (1024px+):** Panels in right rail (320px width), main content fills remaining space
- **Tablet (768px):** Panels stack below main content in 2-column grid
- **Mobile (320–390px):** Panels stack below main content, full width, collapsible (accordion)

### 3a.2 Panel 1 — Athlete Summary Panel

**Purpose:** At-a-glance identity card for the currently selected athlete-tenant. Always visible at the top of the panels rail.

**Reuses:** `DashboardHeader` avatar pattern + `KpiCard` visual style

**Component:** `AthleteSummaryPanel`

```
┌──────────────────────────┐
│  ┌──────┐                │
│  │Avatar│  [Athlete Name]│
│  └──────┘  Position · Grade│
│            Institution    │
│            Team           │
│  ─────────────────────── │
│  Sport: [sport]           │
│  Height: [ht]  Weight: [wt]│
│  GPA: [x.xx or "Not shared"]│
│  ─────────────────────── │
│  [View Public Profile →]  │
└──────────────────────────┘
```

| Field | Source | Consent Gate | Notes |
|---|---|---|---|
| Avatar | `athlete_profiles_list.avatar_url` | — | Default placeholder if none |
| Name | `athlete_profiles_list.name` | — | First name + last initial for under-13 on guardian view |
| Position | `athlete_profiles_list.position` | — | |
| Grade | `athlete_profiles_list.grade` | — | |
| Institution | `athlete_tenant_memberships_list` → tenant name | — | Current institution membership |
| Team | `athlete_profiles_list.team` | — | |
| Sport | `athlete_profiles_list.sport` | — | |
| Height / Weight | `athlete_metrics_list` (JSON `stats_blob`) | — | Private view (guardian/athlete/institution); not consent-gated in private dashboard |
| GPA | `athlete_profiles_list.gpa` | `gpa_display` | Shows "Not shared" if consent not granted |
| View Public Profile | Link → `/athletes/:athleteTenantId` | — | Only if `visibility_status = 'approved'` |

**Actor-specific behavior:**

| Actor | Shows | Workspace Switcher |
|---|---|---|
| **Guardian** | All linked athletes (switcher lists each) | Yes — `AthleteWorkspaceSwitcher` |
| **Athlete** | Self only | No |
| **Institution/Coach** | All roster athletes (switcher lists each) | Yes — athlete selector |
| **Sponsor** | All deal-athletes (switcher lists each) | Yes — athlete selector |
| **Fan** | Followed athletes (switcher lists each) | Yes — athlete selector |
| **Compliance** | All athletes (search-driven, no switcher) | No — search instead |

### 3a.3 Panel 2 — Athlete Status Panel

**Purpose:** Real-time visibility/compliance/consent status for the selected athlete. This is the firewall state at a glance.

**Reuses:** Status chip color map from §9

**Component:** `AthleteStatusPanel`

```
┌──────────────────────────┐
│  ATHLETE STATUS           │
│  ─────────────────────── │
│  Visibility: [● Approved] │
│  Compliance: [● Cleared]  │
│  Consent: [● Public]      │
│             [● GPA]       │
│             [○ Media]     │
│             [○ Deals]     │
│  Moderation: [3 pending]  │
│  ─────────────────────── │
│  Profile Completeness     │
│  [████████──] 80%         │
│  Missing: Highlight video │
└──────────────────────────┘
```

| Status Row | Source | Chip Colors | Notes |
|---|---|---|---|
| **Visibility** | `athlete_profiles_list.visibility_status` | `draft`=gray, `pending`=yellow, `approved`=green, `rejected`=red, `archived`=gray(dark) | The firewall state (§3.1) |
| **Compliance** | `athlete_profiles_list.compliance_status` | `pending`=yellow, `cleared`=green, `flagged`=red | Manual (Phase 2) or automated (Phase 4) |
| **Consent** | `consent_records_list` per scope | Granted=green ●, Not granted=gray ○ | Scopes: `public_profile`, `gpa_display`, `media_display`, `nil_deals`, `messaging` |
| **Moderation** | `highlight_media_list` count where `moderation_status='pending'` | 0=green, 1–2=yellow, 3+=red | Click → navigates to moderation queue |
| **Profile Completeness** | Computed from required fields | Progress bar | Missing fields listed below bar |

**Actor-specific visibility:**

| Actor | Sees | Can Edit |
|---|---|---|
| **Guardian** | All status rows | Consent toggles, submit for review |
| **Athlete** | All status rows | Submit for review (post age-out) |
| **Institution/Coach** | Visibility, compliance, completeness (not consent details) | Verify achievements |
| **Sponsor** | Visibility only (approved/not) | No edit |
| **Fan** | Not shown (fan dashboard shows athlete card instead) | N/A |
| **Compliance** | All status rows + audit trail | Status overrides, broadcast alerts |

### 3a.4 Panel 3 — Next Steps Panel

**Purpose:** Backend-driven, capability-aware task checklist that guides the actor through what to do next. Reuses the platform's existing `NextStepsSingletonService` + `useNextSteps` hook + `TaskChecklist` component pattern.

**Reuses:** `TaskChecklist.tsx`, `NextStepsSingletonService.ts`, `useNextSteps.ts` — all adapted for NIL actor context.

**Component:** `NilNextStepsPanel` (extends `TaskChecklist` pattern)

```
┌──────────────────────────┐
│  NEXT STEPS               │
│  2 of 5 completed         │
│  ┌──────┐                 │
│  │ 40%  │  ○ Complete...  │
│  │ ring │  ○ Upload...   │
│  └──────┘  ● Submit...   │
│            ● Verify...   │
│  [View all tasks →]       │
└──────────────────────────┘
```

**Data source:** `GET /api/:actorScope/:tenantId/next-steps` — backend computes tasks based on actor type, athlete state, capability availability, and tier.

**NIL Next Steps categories (replacing commerce categories):**

| Category | Examples (per actor) |
|---|---|
| **profile** | "Complete athlete profile", "Add highlight video", "Add physical stats" |
| **visibility** | "Submit profile for review", "Grant public consent", "Upload profile photo" |
| **compliance** | "Clear compliance review", "Verify eligibility rules", "Complete KYC" (guardian) |
| **engagement** | "Respond to sponsor inquiry", "Approve media upload", "Verify achievement" |
| **finance** | "Set up payout method", "Review deal offer", "Fund escrow milestone" |

**Actor-specific next steps:**

| Actor | Sample Next Steps |
|---|---|
| **Guardian** | "Grant public_profile consent for [Athlete]", "Complete KYC for payouts", "Review pending deal from [Sponsor]", "Approve media upload (3 pending)" |
| **Athlete** | "Add highlight video", "Complete physical stats", "Submit profile for review", "Verify [achievement]" |
| **Institution** | "Invite athlete to roster", "Verify [Athlete]'s achievement", "Submit compliance report", "Review transfer request" |
| **Coach** | "Add athlete to recruiting board", "Rate [Athlete]", "Contact guardian for [Athlete]", "Schedule event" |
| **Sponsor** | "Propose deal to [Athlete]", "Fund escrow for [Deal]", "Set spend budget", "Review campaign performance" |
| **Fan** | "Follow [Athlete]", "Like a highlight", "Earn Super Fan badge", "Share athlete profile" |
| **Compliance** | "Review [Athlete] profile (pending)", "Moderate [n] media items", "Process erasure request", "Update eligibility rules" |

### 3a.5 Panel 4 — Task List Panel

**Purpose:** CRM-backed task list scoped to the actor and selected athlete. Reuses the platform's CRM task infrastructure (`CrmTask` entity, Kanban reorder, SLA timestamps).

**Reuses:** CRM task table pattern from `CrmTenantCrmService` / `CrmAdminService`, adapted for NIL actor scoping.

**Component:** `NilTaskListPanel`

```
┌──────────────────────────┐
│  TASKS                    │
│  ─────────────────────── │
│  ○ [High] Verify GPA...  │
│  ○ [Med] Upload photo... │
│  ● [Low] Update bio...   │
│  ─────────────────────── │
│  [+ Add Task]            │
│  [View all tasks →]      │
└──────────────────────────┘
```

| Field | Source | Notes |
|---|---|---|
| Task checkbox | `crm_tasks.status` (open/done) | Toggle via API |
| Priority badge | `crm_tasks.priority` | High=red, Medium=yellow, Low=gray |
| Task label | `crm_tasks.title` | Truncated with tooltip for long text |
| Due date | `crm_tasks.due_date` | Shows "Overdue" in red if past due |
| Add Task | Inline form | Creates `crm_task` scoped to actor + athlete-tenant |
| View all | Link → actor's task page | E.g., `/guardian/tasks`, `/admin/nil/tasks` |

**Scoping rules:**

| Actor | Task Scope | Assignee |
|---|---|---|
| **Guardian** | Tasks for their athlete-tenants | Guardian or system-generated |
| **Athlete** | Tasks for self (post age-out) | Athlete or guardian-assigned |
| **Institution/Coach** | Tasks for roster athletes | Institution admin or coach |
| **Sponsor** | Tasks for their deals | Sponsor or system-generated |
| **Fan** | Not shown (fans have no tasks) | N/A |
| **Compliance** | All tasks (global) | Compliance staff |

> **Fan dashboard:** The Task List panel is replaced by a **Fan Badges Progress** panel showing badge earning progress.

### 3a.6 Panel 5 — Actor-Aware Tips Panel

**Purpose:** Contextual, rotating tips that guide the actor based on their current state, capabilities, tier, and pending actions. Reuses the platform's `GrowthTipCard` + `GrowthTipSingletonService` + `tipEngine.ts` pattern, adapted for NIL actor context.

**Reuses:** `GrowthTipCard.tsx`, `GrowthTipSingletonService.ts`, `tipEngine.ts` — all adapted with NIL tip definitions.

**Component:** `NilActorTipsPanel` (extends `GrowthTipCard` pattern)

```
┌──────────────────────────┐
│  💡 TIP                    │
│  ─────────────────────── │
│  [Category badge]         │
│                            │
│  Complete your athlete's   │
│  highlight video to boost  │
│  recruiting visibility.    │
│                            │
│  [Add Highlight →]         │
│                            │
│  ○ ○ ○ (rotation dots)    │
└──────────────────────────┘
```

**Data source:** `GET /api/:actorScope/:tenantId/growth-tips` — backend returns actor-aware tips, or client-side `tipEngine` fallback with NIL `TipContext`.

**NIL TipContext (extends platform TipContext):**

```typescript
interface NilTipContext extends TipContext {
  actorType: 'guardian' | 'athlete' | 'institution' | 'coach' | 'sponsor' | 'fan' | 'compliance';
  athleteStatus: {
    visibilityStatus: VisibilityStatus;
    complianceStatus: ComplianceStatus;
    consentScopes: string[]; // granted scopes
    profileCompleteness: number; // 0-100
    pendingModeration: number;
    activeDeals: number;
    pendingApprovals: number;
  };
  nilCapabilities: {
    nilLanding?: CapabilityState;
    nilRoster?: CapabilityState;
    nilGuardian?: CapabilityState;
    nilRecruiting?: CapabilityState;
    nilSponsorship?: CapabilityState;
    nilAchievements?: CapabilityState;
    nilFanNetwork?: CapabilityState;
    nilCompliance?: CapabilityState;
    nilFinance?: CapabilityState;
    nilCrm?: CapabilityState;
    nilBot?: CapabilityState;
  };
}
```

**NIL tip categories (replacing commerce categories):**

| Category | Label | Examples |
|---|---|---|
| **onboarding** | "Get Started" | "Complete athlete profile", "Add first highlight", "Grant public consent" |
| **engagement** | "Engage" | "Respond to sponsor inquiry", "Verify an achievement", "Follow an athlete" |
| **upgrade** | "Upgrade" | "Unlock recruiting boards", "Enable NIL finance", "Activate CRM" |
| **optimization** | "Optimize" | "Add more highlights for visibility", "Set spend budget", "Complete KYC for faster payouts" |
| **retention** | "Action Needed" | "Consent expiring for [Athlete]", "Deal offer expires in 3 days", "3 media items pending moderation" |

**Actor-specific tip examples:**

| Actor | Sample Tips |
|---|---|
| **Guardian** | "[Athlete]'s profile is 80% complete — add a highlight video", "Complete KYC to enable deal payouts", "3 media items awaiting your approval", "Grant GPA consent to boost recruiting visibility" |
| **Athlete** | "Add highlight video to attract sponsors", "Your profile has 5 followers — share to grow audience", "Submit profile for compliance review", "Update physical stats for recruiting boards" |
| **Institution** | "Invite athletes to build your roster", "Verify achievements to boost credibility", "Submit NIL compliance report", "3 athletes pending compliance review" |
| **Coach** | "Add athletes to your recruiting board", "Rate athletes to track prospects", "Contact guardians for recruiting outreach", "Schedule upcoming events" |
| **Sponsor** | "Propose a deal to [Athlete]", "Fund escrow to lock in your deal", "Set a spend budget to track ROI", "Explore athletes in [sport]" |
| **Fan** | "Follow more athletes to earn Super Fan badge", "Like a highlight to support athletes", "Share athlete profiles to grow the community", "You're 20 likes away from NIL Supporter badge" |
| **Compliance** | "[n] profiles pending review", "[n] media items need moderation", "Review eligibility rules for [state]", "Process [n] erasure requests" |

**Rotation:** Auto-rotate every 15 seconds (configurable). User can dismiss a tip; dismissed tips are replaced by the next highest-scored tip. Rotation dots indicate position in tip queue.

### 3a.7 Panel Composition per Actor

| Actor | Athlete Summary | Athlete Status | Next Steps | Task List | Actor Tips |
|---|---|---|---|---|---|
| **Guardian** | Yes (with switcher) | Yes (full) | Yes | Yes | Yes (guardian tips) |
| **Athlete** | Yes (self) | Yes (full) | Yes | Yes | Yes (athlete tips) |
| **Institution** | Yes (with switcher) | Yes (limited) | Yes | Yes | Yes (institution tips) |
| **Coach** | Yes (with switcher) | Yes (limited) | Yes | Yes | Yes (coach tips) |
| **Sponsor** | Yes (with switcher) | Yes (visibility only) | Yes | Yes | Yes (sponsor tips) |
| **Fan** | Yes (with switcher) | Replaced by Badge Progress | Yes | Replaced by Badge Progress | Yes (fan tips) |
| **Compliance** | Yes (search-driven) | Yes (full + audit) | Yes | Yes | Yes (compliance tips) |

### 3a.8 Panel Data Flow

```
ServerResolvedContextProvider
  └── actor context (role, tenantId, athleteTenantId)
       └── React Query hooks
            ├── useNilNextSteps(actorType, tenantId, athleteTenantId)
            │    └── NilNextStepsService.getNextSteps()
            │         └── GET /api/:scope/:tenantId/next-steps
            │
            ├── useNilTasks(actorType, tenantId, athleteTenantId)
            │    └── NilTaskService.getTasks()
            │         └── GET /api/:scope/:tenantId/crm/tasks?athleteTenantId=
            │
            ├── useNilGrowthTips(actorType, tenantId, nilTipContext)
            │    └── NilGrowthTipService.getGrowthTips()
            │         └── GET /api/:scope/:tenantId/growth-tips
            │         └── fallback: tipEngine.resolveGrowthTips(nilTipContext)
            │
            ├── useAthleteSummary(athleteTenantId)
            │    └── AthleteService.getSummary()
            │         └── GET /api/athletes/:athleteTenantId/summary
            │
            └── useAthleteStatus(athleteTenantId)
                 └── AthleteService.getStatus()
                      └── GET /api/athletes/:athleteTenantId/status
```

**No polling loops** (§12.11 / `fix-tenant-dashboard-load-loop.md`): All hooks use React Query with `staleTime: 30s` and seed from server-resolved context. Unread counts via `getReadState()`, not re-polling lists.

### 3a.9 Panel Components to Build

| Component | Extends | Purpose |
|---|---|---|
| `NilNextStepsPanel` | `TaskChecklist` pattern | Progress ring + task checklist with NIL categories |
| `NilTaskListPanel` | CRM task list pattern | Priority-badged task list with add-task inline form |
| `NilActorTipsPanel` | `GrowthTipCard` pattern | Rotating actor-aware tips with NIL TipContext |
| `AthleteSummaryPanel` | `DashboardHeader` avatar pattern | Identity card with sport/position/stats |
| `AthleteStatusPanel` | Status chip pattern | Firewall/compliance/consent/moderation status board |
| `FanBadgeProgressPanel` | `FeatureCard` pattern | Replaces Task List + Athlete Status for fan dashboards |
| `NilNextStepsService` | `NextStepsSingletonService` | NIL-scoped next steps API service |
| `NilTaskService` | CRM task service pattern | NIL-scoped CRM task service |
| `NilGrowthTipService` | `GrowthTipSingletonService` | NIL-scoped growth tips API service |
| `useNilNextSteps` | `useNextSteps` hook pattern | React Query hook for NIL next steps |
| `useNilTasks` | CRM task hook pattern | React Query hook for NIL tasks |
| `useNilGrowthTips` | Growth tips hook pattern | React Query hook for NIL growth tips |
| `useAthleteSummary` | — | React Query hook for athlete summary |
| `useAthleteStatus` | — | React Query hook for athlete status |

---

## 4. Public Roster Directory

**Route:** `/roster`
**Base service:** `NilPublicRosterService`
**Data source:** `GET /api/public/roster?sport=&position=&grade=&institution=&page=`

### 4.1 Layout

```
┌─────────────────────────────────────────────────┐
│  Search Bar + Filters                            │
│  [Sport ▾] [Position ▾] [Grade ▾] [Region ▾]    │
│  [Search: "name"]                                │
├─────────────────────────────────────────────────┤
│                                                   │
│  Athlete Cards Grid (responsive)                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │[Avatar]│ │[Avatar]│ │[Avatar]│ │[Avatar]│   │
│  │ Name   │ │ Name   │ │ Name   │ │ Name   │   │
│  │ Pos    │ │ Pos    │ │ Pos    │ │ Pos    │   │
│  │ School │ │ School │ │ School │ │ School │   │
│  │ Grade  │ │ Grade  │ │ Grade  │ │ Grade  │   │
│  └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                   │
│  [Load More] or [Pagination]                     │
└─────────────────────────────────────────────────┘
```

### 4.2 Card Content

| Field | Consent Gate | Notes |
|---|---|---|
| Avatar | `public_profile` | Default placeholder if no photo |
| Name | `public_profile` | First name + last initial for under-13 (COPPA) |
| Position | `public_profile` | |
| Institution | `public_profile` | |
| Grade | `public_profile` | |
| GPA | `gpa_display` | Hidden if not consented |
| Key Stat | `public_profile` | One highlight stat from `athlete_metrics_list` |
| Follow Button | — | Fan follow (always-free) |

### 4.3 Responsive Behavior (UX Guardrail)

- **Mobile (320–390px):** 1 column, cards stack vertically, filters collapse into a drawer
- **Tablet (768px):** 2 columns, filters in a collapsible bar
- **Desktop (1024px+):** 3–4 columns, filters in a persistent sidebar

---

## 5. Marketing Landing Page

**Route:** `/`
**Service:** `NilLeadService` (extends `NilPublicApiSingleton`)

### 5.1 Sections

| Section | Content | Notes |
|---|---|---|
| **Hero** | Brand headline + CTA ("Get Started" / "Explore Athletes") | Edge-cached; no auth required |
| **Value Prop** | 3 cards: For Athletes, For Sponsors, For Institutions | Tailored messaging per audience |
| **Featured Athletes** | Carousel of approved athletes (3–5) | From public roster; cached |
| **How It Works** | 3-step process: Create Profile → Get Verified → Connect | |
| **Lead Capture Form** | Tabbed: Athlete/Parent, Sponsor, Investor | Zod-validated; writes to `nil_leads_list` |
| **Footer** | Legal links, privacy policy, terms | COPPA/FERPA compliance links |

### 5.2 Lead Form

| Tab | Fields | Notes |
|---|---|---|
| **Athlete/Parent** | Athlete name, sport, grade, guardian email, state | COPPA: must be guardian-initiated |
| **Sponsor** | Company name, contact name, email, budget range, sports of interest | |
| **Investor** | Name, email, organization, interest area | |

---

## 6. Media Asset System

### 6.1 Video Player

Reuse `ProductVideoPlayer` component (facade pattern):
- YouTube thumbnail facade → click to load iframe
- Supports YouTube (including /shorts/, /embed/, youtu.be), Vimeo, YouTube playlists
- Graceful fallback with external link for invalid/unavailable videos
- **NIL addition:** Host allowlist validation at upload; moderation state gate before public display

### 6.2 Photo Gallery

| Component | Usage |
|---|---|
| **Mantine Carousel** (`@mantine/carousel`) | Highlight photo carousel on athlete profile |
| **Responsive Grid** | Photo gallery on highlights tab |
| **Lightbox** | Full-screen view on click (Mantine Image component) |

### 6.3 Upload Flow

```
Guardian/Athlete → Select media type (photo/video)
  → Enter URL (allowlisted hosts only)
  → Submit → moderation_status = 'pending'
  → Compliance reviews → moderation_status = 'cleared' or 'rejected'
  → If cleared + profile approved → appears on public profile
```

### 6.4 Media Stats Display

Per asset:
- View count
- Like count
- Share count
- Engagement rate (views / followers)

Displayed below each asset in the highlights tab and in the athlete dashboard.

---

## 7. Social Engagement System

### 7.1 Follow System

| Action | Actor | Target | Notes |
|---|---|---|---|
| Follow athlete | Fan | Athlete-tenant | Writes to fan follow list; always-free |
| Follow team | Fan | Institution-tenant | |
| Unfollow | Fan | Any | |
| Block | Fan | Any | Prevents engagement |

### 7.2 Fan Feed

| Content Source | Filter | Notes |
|---|---|---|
| Athlete highlights | `approved` + `media_display` consent | New highlight media appears in feed |
| Achievement posts | `approved` + `public_profile` consent | New verified achievements |
| Deal announcements | `public_profile` consent | Sponsor + athlete name only; no amounts |
| Fan posts | Community feed | Text + photo; no athlete PII in posts |

### 7.3 Fan Badges

| Badge | Criteria | Notes |
|---|---|---|
| **Super Fan** | 100+ likes given | Gamified engagement |
| **NIL Supporter** | Followed 10+ athletes | |
| **Early Adopter** | Joined during beta | |
| **Custom badges** | Platform-defined | Extensible via `fan_badges_list` |

### 7.4 Messaging (Guardian-Gated)

| Thread Type | Participants | Rules |
|---|---|---|
| Coach → Athlete | Coach + Guardian (+ Athlete if adult) | Guardian must approve thread; adult→minor direct contact impossible without guardian (§12.2) |
| Sponsor → Athlete | Sponsor + Guardian (+ Athlete if adult) | Guardian must approve; deal context attached |
| Guardian → Compliance | Guardian + Compliance | Direct support channel |

**Messaging UI:** Thread list + thread detail view (mirrors CRM ticket message pattern). Unread count via `getReadState()`.

---

## 8. Component Inventory

### 8.1 Reused from Platform (No Changes)

| Component | Source | Usage |
|---|---|---|
| `CrmPageShell` | `components/crm/` | All dashboard shells |
| `CrmNavPanel` | `components/crm/` | Sidebar nav (adapted per actor) |
| `DashboardHeader` | `components/dashboard/` | Page headers |
| `KpiCard` | `components/dashboard/` | Metric cards |
| `Sparkline` | `components/dashboard/` | Mini charts in KPI cards |
| `MiniAreaChart` | `components/dashboard/` | Performance graphs |
| `DashboardSkeleton` | `components/dashboard/` | Loading states |
| `TierBadge` | `components/dashboard/` | Tier display |
| `FeatureCard` | `components/dashboard/` | Capability showcase |
| `CapabilityShowcase` | `components/dashboard/` | Feature display |
| `QuickActions` | `components/dashboard/` | Dashboard quick links |
| `GrowthTipCard` | `components/dashboard/` | Proactive nudges |
| `ProductVideoPlayer` | `components/products/` | Video facade (highlights) |
| `ServerResolvedContextProvider` | `components/tenant/` | Auth/tenant context |
| `TenantAuthGate` | `components/tenant/` | Auth gating |
| `AuthContext` | `contexts/` | Auth state |
| All Mantine components | `@mantine/*` | UI primitives |
| All Radix components | `@radix-ui/*` | Switch, dialog, tabs, etc. |
| Lucide icons | `lucide-react` | Icon system |
| Tabler icons | `@tabler/icons-react` | Icon system |

### 8.2 New Components to Build

| Component | Purpose | Based On |
|---|---|---|
| `NilLandingHero` | Marketing landing hero | — |
| `NilLeadForm` | Lead capture form (tabbed) | Mantine form pattern |
| `AthleteCard` | Public athlete card (roster grid) | `SmartProductCard` pattern |
| `AthleteProfileHero` | Public profile hero banner | `DashboardHeader` pattern |
| `ConsentMatrix` | Guardian consent management table | Mantine Table + Radix Switch |
| `DealKanbanBoard` | Deal pipeline Kanban | Mantine Kanban (existing CRM Kanban pattern) |
| `DealCard` | Deal card in Kanban | CRM Task card pattern |
| `DealDetailDrawer` | Deal detail drawer | Mantine Drawer |
| `AthleteDiscoveryGrid` | Sponsor athlete search grid | `RandomFeaturedProducts` pattern |
| `RecruitingBoard` | Coach recruiting Kanban | Mantine Kanban |
| `RecruitingCard` | Athlete card in recruiting board | `AthleteCard` variant |
| `FanFeedPost` | Fan feed post card | Social media post card pattern |
| `FanBadgeGrid` | Fan badge collection grid | `FeatureCard` pattern |
| `ComplianceScoreRing` | Compliance progress ring | Mantine RingProgress |
| `ReviewQueueTable` | Compliance unified review queue | CRM ticket table pattern |
| `MediaModerationGrid` | Media moderation grid | Mantine Image grid |
| `ErasureRequestTable` | Erasure request queue | CRM task table pattern |
| `EligibilityRulesTable` | Eligibility rules admin table | Dense admin table (saas-admin-dashboard) |
| `AuditLogTable` | Audit log viewer | Dense admin table |
| `NilEventTimeline` | Event timeline | Mantine Timeline |
| `AchievementTimeline` | Achievement timeline | Mantine Timeline |
| `SpendBudgetBar` | Sponsor spend vs cap progress | Mantine Progress |
| `PayoutStatusCard` | Guardian payout/KYC status | KpiCard variant |
| `GuardianNavPanel` | Guardian sidebar nav | `CrmNavPanel` pattern |
| `AthleteNavPanel` | Athlete sidebar nav | `CrmNavPanel` pattern |
| `SponsorNavPanel` | Sponsor sidebar nav | `CrmNavPanel` pattern |
| `InstitutionNavPanel` | Institution sidebar nav | `CrmNavPanel` pattern |
| `CoachNavPanel` | Coach sidebar nav | `CrmNavPanel` pattern |
| `FanNavPanel` | Fan sidebar nav | `CrmNavPanel` pattern |
| `ComplianceNavPanel` | Compliance sidebar nav | `CrmNavPanel` pattern |
| `AthleteWorkspaceSwitcher` | Guardian athlete-tenant switcher | Org switcher pattern (saas-navigation) |
| `NilNextStepsPanel` | NIL next steps checklist with progress ring | `TaskChecklist` pattern |
| `NilTaskListPanel` | NIL CRM task list with priority badges | CRM task list pattern |
| `NilActorTipsPanel` | Rotating actor-aware tips | `GrowthTipCard` pattern |
| `AthleteSummaryPanel` | Athlete identity card (avatar, sport, stats) | `DashboardHeader` avatar pattern |
| `AthleteStatusPanel` | Firewall/compliance/consent status board | Status chip pattern |
| `FanBadgeProgressPanel` | Fan badge earning progress (replaces task list) | `FeatureCard` pattern |
| `CapabilityUpsellCard` | Upgrade CTA for disabled NIL capabilities | `FeatureCard` pattern |
| `useNilCapabilities` | Aggregate hook for all 11 NIL capability states | `useCapabilityAccess` pattern |
| `InvitationWidgetPanel` | Pending invitations panel for dashboard right rail | Standard panel pattern (§3a) |
| `InvitationModal` | Send invitation modal with connection type + email + message | Platform modal pattern |
| `InvitationAcceptancePage` | Public token-authenticated page for accepting/rejecting invitations | Public route page |
| `InvitationManagementPage` | Sent/received invitations with status chips and filters | Two-tab list pattern |
| `OnboardingWizard` | Multi-step actor-aware onboarding modal | Platform wizard pattern |
| `OnboardingProgressBanner` | Persistent banner for incomplete onboarding | Dashboard banner pattern |
| `InviteButton` | Contextual invite button with pre-selected connection type | Button + modal trigger |

### 8.3 Navigation Links to Seed

```sql
-- Guardian nav
('guardian', 'My Athletes', '/guardian', 'all', 1);
('guardian', 'Pending Approvals', '/guardian/approvals', 'all', 2);
('guardian', 'Consent Management', '/guardian/consent', 'all', 3);
('guardian', 'Deal Inbox', '/guardian/deals', 'all', 4);
('guardian', 'Messages', '/guardian/messages', 'all', 5);
('guardian', 'Payouts & KYC', '/guardian/payouts', 'all', 6);
('guardian', 'Alerts', '/guardian/alerts', 'all', 7);
('guardian', 'Settings', '/guardian/settings', 'all', 8);

-- Athlete nav
('athlete', 'Profile', '/athletes/{tenantId}/dashboard', 'tenant', 1);
('athlete', 'Highlights', '/athletes/{tenantId}/highlights', 'tenant', 2);
('athlete', 'Stats & Performance', '/athletes/{tenantId}/stats', 'tenant', 3);
('athlete', 'My Deals', '/athletes/{tenantId}/deals', 'tenant', 4);
('athlete', 'Messages', '/athletes/{tenantId}/messages', 'tenant', 5);
('athlete', 'Followers & Fans', '/athletes/{tenantId}/fans', 'tenant', 6);
('athlete', 'Settings', '/athletes/{tenantId}/settings', 'tenant', 7);

-- Sponsor nav
('sponsor', 'Dashboard', '/sponsors/{tenantId}', 'tenant', 1);
('sponsor', 'Deal Pipeline', '/sponsors/{tenantId}/deals', 'tenant', 2);
('sponsor', 'Athlete Discovery', '/sponsors/{tenantId}/discovery', 'tenant', 3);
('sponsor', 'Campaigns', '/sponsors/{tenantId}/campaigns', 'tenant', 4);
('sponsor', 'Messages', '/sponsors/{tenantId}/messages', 'tenant', 5);
('sponsor', 'Spending & Budget', '/sponsors/{tenantId}/spending', 'tenant', 6);
('sponsor', 'Settings', '/sponsors/{tenantId}/settings', 'tenant', 7);

-- Institution nav
('institution', 'Dashboard', '/institutions/{tenantId}', 'tenant', 1);
('institution', 'Team Roster', '/institutions/{tenantId}/roster', 'tenant', 2);
('institution', 'Athletic Department', '/institutions/{tenantId}/athletic', 'tenant', 3);
('institution', 'NIL Compliance', '/institutions/{tenantId}/compliance', 'tenant', 4);
('institution', 'NIL Report', '/institutions/{tenantId}/report', 'tenant', 5);
('institution', 'Recruiting', '/institutions/{tenantId}/recruiting', 'tenant', 6);
('institution', 'Achievements', '/institutions/{tenantId}/achievements', 'tenant', 7);
('institution', 'Messages', '/institutions/{tenantId}/messages', 'tenant', 8);
('institution', 'Settings', '/institutions/{tenantId}/settings', 'tenant', 9);

-- Coach nav (subset of institution)
('coach', 'Dashboard', '/institutions/{tenantId}/coach', 'tenant', 1);
('coach', 'Team Roster', '/institutions/{tenantId}/coach/roster', 'tenant', 2);
('coach', 'Recruiting Board', '/institutions/{tenantId}/coach/recruiting', 'tenant', 3);
('coach', 'Messages', '/institutions/{tenantId}/coach/messages', 'tenant', 4);
('coach', 'Events', '/institutions/{tenantId}/coach/events', 'tenant', 5);
('coach', 'Settings', '/institutions/{tenantId}/coach/settings', 'tenant', 6);

-- Fan nav
('fan', 'Dashboard', '/fans', 'all', 1);
('fan', 'Social Feed', '/fans/feed', 'all', 2);
('fan', 'Favorite Athletes', '/fans/athletes', 'all', 3);
('fan', 'Followed Teams', '/fans/teams', 'all', 4);
('fan', 'Fan Badges', '/fans/badges', 'all', 5);
('fan', 'Settings', '/fans/settings', 'all', 6);

-- Compliance/Admin nav
('admin', 'Dashboard', '/admin/nil', 'admin', 1);
('admin', 'Review Queue', '/admin/nil/review', 'admin', 2);
('admin', 'Profiles', '/admin/nil/profiles', 'admin', 3);
('admin', 'Media Moderation', '/admin/nil/media', 'admin', 4);
('admin', 'Deals', '/admin/nil/deals', 'admin', 5);
('admin', 'Eligibility Rules', '/admin/nil/eligibility', 'admin', 6);
('admin', 'Audit Log', '/admin/nil/audit', 'admin', 7);
('admin', 'Erasure Requests', '/admin/nil/erasure', 'admin', 8);
('admin', 'Broadcast Alerts', '/admin/nil/alerts', 'admin', 9);
('admin', 'Users', '/admin/nil/users', 'admin', 10);
('admin', 'Settings', '/admin/nil/settings', 'admin', 11);
```

---

## 9. State Design (Every User-Visible State)

Per `skill-frontend-ux-guardrails` §5, every surface must handle:

| State | Implementation |
|---|---|
| **Loading** | `DashboardSkeleton` for dashboards; Mantine `Skeleton` for cards/tables; no blank canvas |
| **Empty** | Mantine `EmptyState` component with illustration + CTA ("No athletes yet — Add your first athlete") |
| **Error** | Mantine `Alert` with error message + retry button; Sentry capture |
| **Disabled** | Radix `disabled` prop; reduced opacity; tooltip explaining why (e.g., "KYC required to approve deals") |
| **Success** | Mantine `Notification` (toast) — "Deal approved", "Profile submitted for review" |
| **Pending** | Status chips (`pending`, `in_review`, `cleared`, `approved`, `rejected`); Mantine `Badge` with color coding |
| **Destructive** | Mantine `Modal` confirmation — "Revoke consent? This will remove [Athlete]'s profile from public view." |

### Status Chip Color Map

| Status | Color | Mantine Color |
|---|---|---|
| `draft` | Gray | `gray` |
| `pending` | Yellow | `yellow` |
| `in_review` | Blue | `blue` |
| `approved` / `cleared` | Green | `green` |
| `rejected` | Red | `red` |
| `archived` | Gray (dark) | `gray` (variant 7) |
| `funded` | Teal | `teal` |
| `locked` | Orange | `orange` |
| `settled` | Green | `green` |
| `disputed` | Red | `red` |

---

## 10. Responsive Breakpoints

Per `skill-frontend-ux-guardrails` §3:

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile S | 320px | 1 column; sidebar collapses to drawer; filters collapse; KPI cards stack |
| Mobile L | 390px | 1 column; same as above |
| Tablet | 768px | 2 columns (cards); sidebar as collapsible; filters in bar |
| Desktop | 1024px | 3 columns (cards); sidebar persistent; filters in sidebar |
| Desktop L | 1440px | 4 columns (cards); max content width 1280px for readability |

**Rules:**
- No horizontal scroll for core comprehension (UX guardrail)
- Tables degrade: first column sticky, horizontal scroll with labels visible
- Modals fit within viewport at 320px (full-screen on mobile)
- Sticky headers/footer safe areas respected

---

## 11. Accessibility

- Keyboard focus order and visible focus styles for all interactive elements
- ARIA labels on icon-only buttons (follow, like, share)
- Screen reader announcements for status changes (Mantine `Notifications`)
- Color contrast: WCAG AA minimum (4.5:1 for text)
- Status chips have text labels (not color-only)
- Charts have accessible text alternatives

---

## 12. Child-Safety UI Constraints

These are **P0 blocking** constraints that affect the frontend directly:

| Constraint | UI Implementation |
|---|---|
| Under-13 self-registration → 403 | Registration form detects age; if under-13, shows "A parent or guardian must register for you" message; no athlete registration path |
| Adult→minor direct contact impossible | Coach/Sponsor "Message Athlete" button → routes to guardian-gated thread creation; if athlete is minor, button says "Contact Guardian" |
| No minor PII on public routes | Public profile DTO strips: DOB, precise location, guardian contact, financial routing; first name + last initial for under-13 |
| Consent revocation cascade | Guardian consent toggle → confirmation modal → "This will remove [Athlete]'s profile, media, and achievements from public view" → revoke → visual confirmation |
| Media moderation gate | Unmoderated media shows "Pending Review" badge; never appears on public profile |
| Bot child-safety | Bot widget shows "This is a moderated conversation" banner for minor-related threads; no PII in bot responses |

---

## 13. Route Map Summary

### Public Routes (no auth)

| Route | Page | Service |
|---|---|---|
| `/` | Marketing landing | `NilLeadService` |
| `/roster` | Public athlete directory | `NilPublicRosterService` |
| `/athletes/:athleteTenantId` | Public athlete profile | `NilPublicRosterService` |
| `/institutions/:tenantId/public` | Public institution roster | `NilPublicRosterService` |
| `/invite/:token` | Invitation acceptance page (token-authenticated) | `NilInvitationService` |

### Authenticated Routes

| Route | Actor | Service | Shell |
|---|---|---|---|
| `/guardian` | Guardian | `GuardianService` | `CrmPageShell` + `GuardianNavPanel` |
| `/guardian/approvals` | Guardian | `GuardianService` | Same |
| `/guardian/consent` | Guardian | `GuardianService` | Same |
| `/guardian/deals` | Guardian | `GuardianService` | Same |
| `/guardian/messages` | Guardian | `GuardianService` | Same |
| `/guardian/payouts` | Guardian | `GuardianService` | Same |
| `/guardian/alerts` | Guardian | `GuardianService` | Same |
| `/guardian/settings` | Guardian | `GuardianService` | Same |
| `/athletes/:tenantId/dashboard` | Athlete (post age-out) | `AthleteService` | `CrmPageShell` + `AthleteNavPanel` |
| `/athletes/:tenantId/highlights` | Athlete | `AthleteService` | Same |
| `/athletes/:tenantId/stats` | Athlete | `AthleteService` | Same |
| `/athletes/:tenantId/deals` | Athlete | `AthleteService` | Same |
| `/athletes/:tenantId/messages` | Athlete | `AthleteService` | Same |
| `/athletes/:tenantId/fans` | Athlete | `AthleteService` | Same |
| `/athletes/:tenantId/settings` | Athlete | `AthleteService` | Same |
| `/sponsors/:tenantId` | Sponsor | `SponsorService` | `CrmPageShell` + `SponsorNavPanel` |
| `/sponsors/:tenantId/deals` | Sponsor | `SponsorService` | Same |
| `/sponsors/:tenantId/discovery` | Sponsor | `SponsorService` | Same |
| `/sponsors/:tenantId/campaigns` | Sponsor | `SponsorService` | Same |
| `/sponsors/:tenantId/messages` | Sponsor | `SponsorService` | Same |
| `/sponsors/:tenantId/spending` | Sponsor | `SponsorService` | Same |
| `/sponsors/:tenantId/settings` | Sponsor | `SponsorService` | Same |
| `/institutions/:tenantId` | Institution Admin | `InstitutionService` | `CrmPageShell` + `InstitutionNavPanel` |
| `/institutions/:tenantId/roster` | Institution Admin | `InstitutionService` | Same |
| `/institutions/:tenantId/athletic` | Institution Admin | `InstitutionService` | Same |
| `/institutions/:tenantId/compliance` | Institution Admin | `InstitutionService` | Same |
| `/institutions/:tenantId/report` | Institution Admin | `InstitutionService` | Same |
| `/institutions/:tenantId/recruiting` | Institution Admin | `InstitutionService` | Same |
| `/institutions/:tenantId/achievements` | Institution Admin | `InstitutionService` | Same |
| `/institutions/:tenantId/messages` | Institution Admin | `InstitutionService` | Same |
| `/institutions/:tenantId/settings` | Institution Admin | `InstitutionService` | Same |
| `/institutions/:tenantId/coach` | Coach | `InstitutionService` | `CrmPageShell` + `CoachNavPanel` |
| `/institutions/:tenantId/coach/roster` | Coach | `InstitutionService` | Same |
| `/institutions/:tenantId/coach/recruiting` | Coach | `InstitutionService` | Same |
| `/institutions/:tenantId/coach/messages` | Coach | `InstitutionService` | Same |
| `/institutions/:tenantId/coach/events` | Coach | `InstitutionService` | Same |
| `/institutions/:tenantId/coach/settings` | Coach | `InstitutionService` | Same |
| `/fans` | Fan | `FanService` | `CrmPageShell` + `FanNavPanel` |
| `/fans/feed` | Fan | `FanService` | Same |
| `/fans/athletes` | Fan | `FanService` | Same |
| `/fans/teams` | Fan | `FanService` | Same |
| `/fans/badges` | Fan | `FanService` | Same |
| `/fans/settings` | Fan | `FanService` | Same |
| `/admin/nil` | Compliance/Admin | `ComplianceService` | `CrmPageShell` + `ComplianceNavPanel` |
| `/admin/nil/review` | Compliance | `ComplianceService` | Same |
| `/admin/nil/profiles` | Compliance | `ComplianceService` | Same |
| `/admin/nil/media` | Compliance | `ComplianceService` | Same |
| `/admin/nil/deals` | Compliance | `ComplianceService` | Same |
| `/admin/nil/eligibility` | Compliance | `ComplianceService` | Same |
| `/admin/nil/audit` | Compliance | `ComplianceService` | Same |
| `/admin/nil/erasure` | Compliance | `ComplianceService` | Same |
| `/admin/nil/alerts` | Compliance | `ComplianceService` | Same |
| `/admin/nil/users` | Compliance | `ComplianceService` | Same |
| `/admin/nil/settings` | Compliance | `ComplianceService` | Same |
| `/guardian/invitations` | Guardian | `NilInvitationService` | `CrmPageShell` + `GuardianNavPanel` |
| `/guardian/onboarding` | Guardian | `NilOnboardingService` | Onboarding wizard modal |
| `/athletes/:athleteTenantId/invitations` | Athlete | `NilInvitationService` | `CrmPageShell` + `AthleteNavPanel` |
| `/athletes/:athleteTenantId/onboarding` | Athlete | `NilOnboardingService` | Onboarding wizard modal |
| `/institutions/:tenantId/invitations` | Institution | `NilInvitationService` | `CrmPageShell` + `InstitutionNavPanel` |
| `/institutions/:tenantId/onboarding` | Institution | `NilOnboardingService` | Onboarding wizard modal |
| `/sponsors/:tenantId/invitations` | Sponsor | `NilInvitationService` | `CrmPageShell` + `SponsorNavPanel` |
| `/sponsors/:tenantId/onboarding` | Sponsor | `NilOnboardingService` | Onboarding wizard modal |
| `/fans/invitations` | Fan | `NilInvitationService` | `CrmPageShell` + `FanNavPanel` |
| `/fans/onboarding` | Fan | `NilOnboardingService` | Onboarding wizard modal |

---

## 12a. Onboarding & Invitation UI (TECHNICAL_SPEC §18)

The platform's growth is driven by a bidirectional invitation system (TECHNICAL_SPEC §18). Every actor encounters an onboarding wizard on first login and can send/receive invitations to establish platform connections.

### 12a.1 Invitation UI Surfaces

**Invitation Widget (Standard Panel on all dashboards):**

```
┌──────────────────────────────────┐
│  📬 Pending Invitations (3)       │
│  ────────────────────────────── │
│  🏫 [Institution] wants [Athlete]│
│     to join their roster         │
│     [Accept] [Reject] [View]     │
│                                  │
│  💰 [Sponsor] has a NIL deal     │
│     opportunity for [Athlete]    │
│     [Accept] [Reject] [View]     │
│                                  │
│  👥 [Guardian] invites you to    │
│     co-manage [Athlete]          │
│     [Accept] [Reject] [View]     │
└──────────────────────────────────┘
```

- Renders as a standard panel in the right rail of every dashboard (§3a)
- Shows only pending invitations for the logged-in actor
- Guardian-gated invitations show "Awaiting guardian approval" badge after invitee accepts
- Empty state: "No pending invitations — invite someone to get started"

**Invite Button (Contextual):**

Present on multiple surfaces with connection type pre-selected:

| Surface | Invite Button Label | Connection Type |
|---|---|---|
| Guardian dashboard (athlete card) | "Invite School/Club" | `membership` |
| Guardian dashboard (athlete card) | "Invite Sponsor" | `sponsorship` |
| Guardian dashboard (athlete card) | "Invite Coach" | `coaching` |
| Guardian dashboard (athlete card) | "Invite Co-Guardian" | `co_guardianship` |
| Guardian dashboard (athlete card) | "Invite Fan" | `follow` |
| Institution roster | "Invite Athlete" | `membership` |
| Institution dashboard | "Invite Coach" | `coaching` (role assignment) |
| Sponsor discovery grid | "Connect with Athlete" | `sponsorship` |
| Sponsor discovery grid | "Send Deal Inquiry" | `deal_inquiry` |
| Coach recruiting board | "Invite Athlete to Follow" | `coaching` |
| Athlete public profile | "Follow" (fan) | `follow` (auto-accept) |

**Invitation Modal:**

```
┌──────────────────────────────────────┐
│  Send Invitation                       │
│  ──────────────────────────────────── │
│                                        │
│  Connection type: [Membership ▾]       │
│                                        │
│  Invitee email: [________________]     │
│                                        │
│  Athlete: [Select athlete ▾]           │
│  (if guardian has multiple athletes)   │
│                                        │
│  Personal message (optional):          │
│  [____________________________]        │
│  [____________________________]        │
│                                        │
│  ⚠️ Guardian consent will be required  │
│     for this connection.               │
│                                        │
│  [Cancel]              [Send Invite]   │
└──────────────────────────────────────┘
```

**Invitation Acceptance Page (`/invite/:token`):**

Public route — no auth required (token-authenticated). Shows:
- Inviter name, actor type, and institution/sponsor branding (if applicable)
- Connection type and what it means (plain language)
- Athlete name and photo (if applicable)
- Personal message from inviter
- Guardian consent notice (if applicable): "This connection requires guardian approval for [Athlete]. The guardian will be notified."
- [Accept] / [Reject] buttons
- If not registered: "You'll need to create an account to accept this invitation" → redirects to registration with token preserved

**Invitation Management Page (`/:actorScope/invitations`):**

Two-tab layout:
- **Sent** tab: List of sent invitations with status chips (sent/viewed/accepted/rejected/expired/withdrawn) + withdraw button for pending
- **Received** tab: List of received invitations with accept/reject/view buttons
- Filter by status and connection type
- Sort by date

### 12a.2 Onboarding UI Surfaces

**Onboarding Wizard (first login):**

Multi-step modal flow shown when `nil_onboarding_sessions_list.status = 'in_progress'`. Steps are actor-specific (TECHNICAL_SPEC §18.5).

```
┌──────────────────────────────────────┐
│  Welcome to [Platform Name]            │
│  ──────────────────────────────────── │
│                                        │
│  ●━━━●━━━○━━━○━━━○━━━○              │
│  Step 2 of 7: Verify Your Email        │
│                                        │
│  We sent a verification link to        │
│  parent@example.com                    │
│                                        │
│  [Resend Email]    [I've Verified]     │
│                                        │
│  [Skip for now]                        │
└──────────────────────────────────────┘
```

- Progress bar at top (step indicators)
- "Skip for now" link on non-blocking steps (skipped steps appear as Next Steps)
- "Back" button to revisit previous steps
- Auto-advances when step is completed (e.g., email verification detected via auth state)
- On completion: "You're all set!" screen with confetti animation → dashboard

**Onboarding Progress Banner (dashboard):**

If user left onboarding incomplete, dashboard shows a persistent banner:

```
┌──────────────────────────────────────────────────┐
│  ⚡ Continue setup — 60% complete                  │
│  Next: Complete athlete profile                    │
│  [Continue Setup →]            [Dismiss]          │
└──────────────────────────────────────────────────┘
```

- Dismissible per session but reappears on next login if onboarding still incomplete
- Clicking "Continue Setup" resumes the wizard at the current step

**Actor-Specific Onboarding Flows (UI per actor):**

| Actor | Wizard Steps (UI screens) |
|---|---|
| **Guardian** | Register → Email verify → Create athlete-tenant → COPPA consent (if under-13) → Complete athlete profile → Grant scoped consent → Invite connections |
| **Athlete** | Accept transfer → Identity verification → Review existing profile/deals/consent → Complete |
| **Institution** | Register → Email verify → Create institution-tenant → Select tier → Invite athletes → Assign coaches |
| **Coach** | Register → Email verify → Accept institution invitation → Complete profile → Invite athletes |
| **Sponsor** | Register → Email verify → Create sponsor-tenant → Select tier → Business verification → Discover athletes |
| **Fan** | Register → Email verify → Follow athletes |
| **Compliance** | Register → Email verify → Identity verification |

### 12a.3 Invitation Status Chips

| Status | Color | Icon | Notes |
|---|---|---|---|
| `sent` | blue | paper-plane | Waiting for response |
| `viewed` | indigo | eye | Invitee has seen the invitation |
| `accepted` | green | check | Connection established |
| `rejected` | red | x | 30-day re-invitation block |
| `expired` | gray | clock | 7 days passed; can re-send after 7 days |
| `withdrawn` | gray | minus | Inviter cancelled |
| `pending_guardian` | amber | shield | Invitee accepted; awaiting guardian approval |

### 12a.4 Child-Safety in Invitations

| Constraint | UI Implementation |
|---|---|
| Minor cannot self-accept invitations | Accept button disabled with tooltip: "Your guardian must approve this connection" |
| Guardian consent gate | Guardian sees invitation in their dashboard with approve/reject buttons; most-restrictive-wins shown as per-guardian status |
| Coach/Sponsor identity required before invitation | Invitation acceptance page shows "This actor must complete identity verification before connecting" if not verified |
| Fan follow auto-accept | No guardian gate for public profiles; follow is instant; shows "Following" confirmation |
| Re-invitation block | Send button disabled with tooltip: "You recently sent this invitation and it was rejected. Try again after [date]." |

---

## 13a. Capability-Aware Architecture (Cross-Cutting)

The existing platform's capability-gating system is the backbone of feature access control. **Every NIL surface inherits this architecture unchanged** — the same 8-phase deployment pipeline, the same tier + merchant resolution, the same `requireFeature` / `requireLimit` gates, the same `UnifiedCapabilityService` mapping, and the same `CapabilityShowcase` display. The only difference is the domain: commerce capability keys become NIL capability keys, commerce resolvers become NIL resolvers, commerce merchant-pref tables become NIL options-settings tables.

### 13a.1 Capability Registry (11 NIL Capabilities)

From TECHNICAL_SPEC §7, every NIL capability follows the full 8-phase pipeline (`capability-deployment-flow.md`):

| Capability Key | Phase | Gate Type | Merchant Pref Table | Actor Scope | Notes |
|---|---|---|---|---|---|
| `nil_landing` | 1 | tier-only | — | All | Static marketing + leads; enabled at all tiers |
| `nil_roster` | 2 | master toggle | `tenant_nil_roster_options_settings` | Institution | Tier-gated row caps; `resolveNilRoster` returns `{ enabled, allowed_row_count, ... }` |
| `nil_guardian` | 3 | per-feature | `tenant_nil_guardian_options_settings` | Guardian | **Platform-default, not tier-gated** (§12.9); consent + role governed |
| `nil_recruiting` | 3 | per-feature | `tenant_nil_recruiting_options_settings` | Institution/Coach | Tier-gated by institution tenant |
| `nil_sponsorship` | 3 | per-feature | `tenant_nil_sponsorship_options_settings` | Sponsor | Tier-gated by sponsor tenant; deal volume caps |
| `nil_achievements` | 3 | master toggle | `tenant_nil_achievements_options_settings` | Institution | Tier-gated by institution tenant |
| `nil_fan_network` | 3 | per-feature | `tenant_nil_fan_options_settings` | Fan | **Platform-default, not tier-gated** (§12.9); always-free |
| `nil_compliance` | 4 | tier-only (hard) | — | Compliance | Highest tier; hard gate; expired → 200 disabled manifest (R13) |
| `nil_finance` | 4 | per-feature | `tenant_nil_finance_options_settings` | Sponsor/Guardian | Highest tier; escrow + payouts + KYC gate |
| `nil_crm` | 3 | per-feature | `tenant_nil_crm_options_settings` | Institution/Sponsor/Guardian | Mirrors `crm-options`; three CRM surfaces |
| `nil_bot` | 3 | per-feature | `tenant_nil_bot_options_settings` | Institution/Sponsor/Guardian | Mirrors `chatbot-options`; child-safety guardrails |

### 13a.2 Gating Ownership (§12.9 Resolution)

The capability system gates by **tenant tier**, but not all actors are tenants. The resolution:

| Actor | Gating | How It Works |
|---|---|---|
| **Institution (School/Club)** | Tenant tier | `tier_features_list` → institution's tier gates roster size, achievement verification, recruiting boards, CRM/bot access |
| **Sponsor** | Tenant tier | `tier_features_list` → sponsor's tier gates deal volume, spend caps, analytics depth, CRM/bot access |
| **Athlete** | Inherited | Athlete-facing features inherit from the membership's institution tenant tier (most-permissive across memberships, narrowed by home tenant policy) |
| **Guardian** | Platform-default | **Always-on, not tier-gated** (§12.9); `nil_guardian` resolver returns from platform default, never `tier_features_list` |
| **Fan** | Platform-default | **Always-on, not tier-gated** (§12.9); `nil_fan_network` resolver returns from platform default |
| **Compliance** | Platform-level | `nil_compliance` is tier-only (hard gate at highest tier); compliance staff are platform-admin-scoped |

### 13a.3 8-Phase Pipeline per Capability

Every NIL capability goes through all 8 phases (per `capability-deployment-flow.md`). For each `nil_xxx`:

| Phase | Deliverable | File Location |
|---|---|---|
| **1. Define** | Feature key(s) in `canonical-features.ts` + tier assignment in `tier-hierarchies.ts` | `apps/api/src/config/canonical-features.ts`, `apps/api/src/config/tier-hierarchies.ts` |
| **2. Seed DB** | `features_list` → `capability_features_list` → `tier_features_list` rows | Seed SQL in migration |
| **3. Store prefs** | `tenant_nil_xxx_options_settings` table + Prisma model + `generateNilXxxOptionsSettingsId` | `apps/api/prisma/schema.prisma`, `apps/api/src/lib/id-generator.ts` |
| **4. Resolve** | `resolveNilXxx(features, merchantPrefs)` resolver + wire into `EffectiveCapabilityResolver.ts` + disabled entry in `buildExpiredCapabilitiesResponse` | `apps/api/src/services/resolvers/NilXxxResolver.ts`, `apps/api/src/services/EffectiveCapabilityResolver.ts` |
| **5. Route** | `GET /api/:scope/:tenantId/nil-xxx-options-settings` (returns `{ success, settings, tierState }`) + `PUT` (tier-validates + `invalidateEffectiveCapabilities`) | `apps/api/src/routes/nil-xxx-options-settings.ts` |
| **6. Map** | `UnifiedCapabilityService.mapNilXxx()` + state interface in `CapabilityResolutionService.ts` + `useNilXxxCapability` hook | `apps/web/src/services/UnifiedCapabilityService.ts`, `apps/web/src/hooks/tenant-access/useCapabilityAccess.ts` |
| **7. Display** | `PlanSummaryPanel` entry + `CapabilityShowcase` row (correct group-level `merchantGated` counting) | `apps/web/src/components/dashboard/` |
| **8. Verify** | `pnpm checkapi` + `pnpm checkweb` (zero TS errors) + `verify-capability-deployment.md` checklist | — |

### 13a.4 Capability Gates in Frontend Services

Every NIL web service checks capabilities before rendering or mutating. The pattern mirrors the existing platform:

```typescript
// Example: AthleteService (extends AthleteApiSingleton)
async submitForReview(athleteTenantId: string) {
  // Capability gate — requireFeature before mutation
  await this.requireFeature(athleteTenantId, 'nil_roster');
  return this.makeDefaultRequest(`/api/athletes/${athleteTenantId}/submit`, { method: 'POST' });
}

// Example: SponsorService (extends SponsorApiSingleton)
async proposeDeal(sponsorTenantId: string, deal: DealProposal) {
  await this.requireFeature(sponsorTenantId, 'nil_sponsorship');
  await this.requireLimit(sponsorTenantId, 'nil_sponsorship_monthly_volume', 1);
  return this.makeDefaultRequest(`/api/sponsors/${sponsorTenantId}/deals`, { method: 'POST', body: ... });
}
```

**`requireFeature` / `requireLimit`** are inherited from the singleton base classes (via `UniversalSingleton` → `TenantApiSingleton` → `AthleteApiSingleton`). They call `UnifiedCapabilityService` which calls the backend `/api/capabilities/:tenantId/effective` endpoint, which dispatches to `EffectiveCapabilityResolver` → `resolveNilXxx()`.

### 13a.5 Capability Gates in UI Components

Every dashboard surface that renders a capability-gated feature uses the `useNilXxxCapability` hook pattern:

```typescript
// Example: Guardian dashboard — consent management section
const { nilGuardian } = useNilCapabilities(tenantId);

{nilGuardian?.enabled && (
  <ConsentMatrix athleteTenantId={selectedAthlete} />
)}
```

```typescript
// Example: Sponsor dashboard — deal pipeline
const { nilSponsorship } = useNilCapabilities(sponsorTenantId);

{nilSponsorship?.enabled ? (
  <DealKanbanBoard tenantId={sponsorTenantId} />
) : (
  <CapabilityUpsellCard
    capability="nil_sponsorship"
    tierState={nilSponsorship?.tierState}
    message="Upgrade to start proposing deals"
  />
)}
```

```typescript
// Example: Institution dashboard — recruiting board
const { nilRecruiting } = useNilCapabilities(institutionTenantId);

{nilRecruiting?.enabled ? (
  <RecruitingBoard tenantId={institutionTenantId} />
) : (
  <CapabilityUpsellCard capability="nil_recruiting" ... />
)}
```

### 13a.6 Capability-Aware Standard Panels

The 5 standard panels (§3a) are all capability-aware:

| Panel | How Capabilities Affect It |
|---|---|
| **Athlete Summary** | No capability gate — always shows athlete identity (consent-gated instead) |
| **Athlete Status** | `nil_roster` capability affects whether "Submit for Review" button is enabled |
| **Next Steps** | Backend computes next steps based on which NIL capabilities are enabled/disabled for the actor's tenant — e.g., if `nil_sponsorship` is disabled, no "Propose deal" step appears for sponsors |
| **Task List** | CRM tasks are gated by `nil_crm` capability — if disabled, task list shows empty state with upgrade CTA |
| **Actor-Aware Tips** | `NilTipContext.nilCapabilities` feeds into `tipEngine` — tips recommend enabling/upgrading capabilities (e.g., "Enable NIL Finance to start processing deal payouts") |

### 13a.7 Capability-Aware Dashboard Sections

Each dashboard's sections are conditionally rendered based on capability state:

| Dashboard | Section | Capability Gate | Disabled State |
|---|---|---|---|
| **Guardian** | Consent Management | `nil_guardian` (always-on) | N/A — always enabled |
| **Guardian** | Deal Inbox | `nil_sponsorship` (on athlete's institution tier) | Shows "No deals — institution tier doesn't enable NIL deals" |
| **Guardian** | Payouts & KYC | `nil_finance` | Shows upgrade CTA |
| **Athlete** | Highlights upload | `nil_roster` | Shows "Profile not enabled for public roster" |
| **Athlete** | My Deals | `nil_sponsorship` | Shows "No deal capability enabled" |
| **Sponsor** | Deal Pipeline | `nil_sponsorship` | Shows upgrade CTA |
| **Sponsor** | Athlete Discovery | `nil_roster` (on athlete's institution) | Shows "No athletes with public profiles yet" |
| **Sponsor** | Spending & Budget | `nil_finance` | Shows upgrade CTA |
| **Institution** | Team Roster | `nil_roster` | Shows "Roster capability not enabled" |
| **Institution** | NIL Compliance | `nil_compliance` | Shows "Compliance module not enabled" |
| **Institution** | Recruiting | `nil_recruiting` | Shows upgrade CTA |
| **Coach** | Recruiting Board | `nil_recruiting` | Shows upgrade CTA |
| **Fan** | Social Feed | `nil_fan_network` (always-on) | N/A — always enabled |
| **Fan** | Fan Badges | `nil_fan_network` (always-on) | N/A — always enabled |
| **Compliance** | Review Queue | `nil_compliance` | N/A — compliance is always enabled for compliance role |
| **Compliance** | Eligibility Rules | `nil_compliance` | N/A |
| **Compliance** | Erasure Requests | `nil_compliance` | N/A |
| **All** | CRM surfaces | `nil_crm` | Shows "CRM not enabled" empty state |
| **All** | Bot widget | `nil_bot` | Widget doesn't render |

### 13a.8 Capability Upsell Pattern

When a capability is disabled (tier-gated off or merchant-pref off), the UI shows a `CapabilityUpsellCard` instead of the feature:

```
┌──────────────────────────┐
│  🔒 NIL Finance            │
│  ─────────────────────── │
│  Upgrade to the Enterprise │
│  tier to unlock:           │
│                            │
│  • Deal escrow & payouts   │
│  • Guardian KYC/W-9        │
│  • Non-profit allocations  │
│  • Transaction fee tracking│
│                            │
│  [Upgrade Plan →]          │
└──────────────────────────┘
```

**Component:** `CapabilityUpsellCard` (reuses `FeatureCard` pattern)

| Prop | Type | Notes |
|---|---|---|
| `capability` | `string` | e.g., `'nil_finance'` |
| `tierState` | `TierState \| undefined` | From `useNilXxxCapability().tierState` |
| `message` | `string` | Custom messaging |
| `features` | `string[]` | Bullet list of what unlocking enables |

### 13a.9 Expired/Trial Tenant Behavior (R13 Pattern)

Per `capability-data-flow-rules.md` R13, when a tenant's subscription is expired or in trial-lapsed state:

- Backend: `buildExpiredCapabilitiesResponse` returns **HTTP 200** with all NIL capabilities set to `{ enabled: false, tierState: 'expired' }`
- Frontend: `useNilXxxCapability` hooks receive disabled state → all gated sections show `CapabilityUpsellCard` with "Renew subscription" CTA
- **Safety exception:** `nil_guardian` and `nil_fan_network` remain enabled even for expired tenants (they're platform-default, not tier-gated — §12.9). This ensures guardians can always revoke consent and fans can always unfollow, even if the institution's subscription lapses.

### 13a.10 Capability Data Flow (End-to-End)

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (Web)                                               │
│                                                                │
│  useNilXxxCapability(tenantId)                                │
│    └── UnifiedCapabilityService.getEffectiveCapabilities()   │
│         └── GET /api/capabilities/:tenantId/effective        │
│              ↓                                                │
│  If enabled → render feature (DealKanban, ConsentMatrix, etc)│
│  If disabled → render CapabilityUpsellCard                    │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│  Backend (API)                                                │
│                                                                │
│  GET /api/capabilities/:tenantId/effective                    │
│    └── EffectiveCapabilityResolver.resolve()                  │
│         ├── Fetch tenant tier from tenants table              │
│         ├── Fetch tier features from tier_features_list       │
│         ├── Fetch merchant prefs from tenant_nil_xxx_options  │
│         ├── Dispatch to resolveNilXxx(features, prefs)        │
│         │    └── Returns { enabled, is_flexible, ... }        │
│         ├── If tenant expired → buildExpiredCapabilitiesResponse│
│         └── Return unified capability manifest                │
│                                                                │
│  Service-level gates:                                         │
│    requireFeature(tenantId, 'nil_xxx')                        │
│    requireLimit(tenantId, 'nil_xxx_limit', n)                 │
│    └── Throws 403 if capability disabled or limit exceeded    │
└──────────────────────────────────────────────────────────────┘
```

### 13a.11 Capability Hooks Inventory

| Hook | Capability | Returns | Used By |
|---|---|---|---|
| `useNilLandingCapability` | `nil_landing` | `{ enabled, tierState }` | Marketing landing (lead form visibility) |
| `useNilRosterCapability` | `nil_roster` | `{ enabled, allowedRowCount, tierState }` | Institution roster, athlete profile submit |
| `useNilGuardianCapability` | `nil_guardian` | `{ enabled, tierState }` (always-on) | Guardian consent management |
| `useNilRecruitingCapability` | `nil_recruiting` | `{ enabled, tierState }` | Coach recruiting board |
| `useNilSponsorshipCapability` | `nil_sponsorship` | `{ enabled, dealVolumeCap, tierState }` | Sponsor deal pipeline |
| `useNilAchievementsCapability` | `nil_achievements` | `{ enabled, tierState }` | Institution achievement verification |
| `useNilFanNetworkCapability` | `nil_fan_network` | `{ enabled, tierState }` (always-on) | Fan dashboard, social feed |
| `useNilComplianceCapability` | `nil_compliance` | `{ enabled, tierState }` | Compliance review queue |
| `useNilFinanceCapability` | `nil_finance` | `{ enabled, tierState }` | Sponsor escrow, guardian payouts |
| `useNilCrmCapability` | `nil_crm` | `{ enabled, tierState }` | All CRM surfaces |
| `useNilBotCapability` | `nil_bot` | `{ enabled, tierState }` | Bot widget rendering |

**Aggregate hook:** `useNilCapabilities(tenantId)` — returns all 11 capability states in one call (cached by React Query, `staleTime: 60s`).

### 13a.12 Capability Display in Plan Summary

The `PlanSummaryPanel` (reused from platform) shows the NIL capability matrix:

```
┌──────────────────────────────────────────────────┐
│  YOUR NIL PLAN: [Tier Name]                       │
│  ─────────────────────────────────────────────── │
│  ✅ Athlete Roster        (nil_roster)            │
│  ✅ Guardian Tools        (nil_guardian)          │
│  ✅ Fan Network           (nil_fan_network)       │
│  ✅ Achievements          (nil_achievements)      │
│  🔒 Recruiting Boards     (nil_recruiting)        │
│  🔒 NIL Finance           (nil_finance)           │
│  ✅ CRM                   (nil_crm)               │
│  ✅ Bot                   (nil_bot)               │
│  ─────────────────────────────────────────────── │
│  [Upgrade to unlock locked features →]           │
└──────────────────────────────────────────────────┘
```

The `CapabilityShowcase` component (reused from platform) renders the detailed feature list per capability with group-level `merchantGated` counting, exactly as it does for commerce capabilities.

---

## 14. Frontend Skill Compliance Checklist

### saas-navigation

- [ ] Primary navigation uses left sidebar (CrmPageShell pattern)
- [ ] Top bar reserved for context, Cmd+K, user account
- [ ] Command palette accessible via Cmd+K from anywhere
- [ ] Command palette is context-aware per actor
- [ ] Workspace switcher uses visual differentiation (athlete avatars)
- [ ] Every drill-down page has breadcrumbs showing full path to root

### skill-frontend-ux-guardrails

- [ ] No unintended page-level horizontal overflow
- [ ] Mobile (320px) and desktop (1440px) layouts intentionally designed
- [ ] All user-visible states handled: loading, empty, error, disabled, success, pending, destructive
- [ ] Stable dimensions for metric cards, charts, tables, sidebars
- [ ] No critical actions hidden only behind hover on touch layouts
- [ ] No horizontal scrolling for core comprehension
- [ ] Text is spelled correctly and UTF-8 safe
- [ ] Long realistic values tested (athlete names, institution names, deal amounts)

### skill-saas-admin-dashboard

- [ ] Admin UIs dense, calm, scannable (no hero sections in admin)
- [ ] Admin routes gated with backend/session role checks
- [ ] Explicit filters for tenant, user, status, date range, risk state
- [ ] Manual changes auditable with actor, reason, before/after, timestamp
- [ ] No PII rendered unless admin workflow explicitly needs it
- [ ] Paginated tables with indexes for common filters
