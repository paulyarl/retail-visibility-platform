# Sprint Plan: Local Marketing Ops — Campaign Journey Module

**Document Version:** 2.0  
**Date:** 2026-07-28  
**Status:** Draft — Ready for Review  
**Platform Context:** Admin capability addition to existing full-stack web application

---

## 1. Executive Summary

This sprint plan delivers a **Local Marketing Operations** admin module within the existing platform. The module treats each local business prospect as a **campaign journey** — progressing through stages from initial discovery (prospecting) through conversion (paid deliverable) to retention (recurring retainer).

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Campaign Intake Form** | Structured audit capture during the discovery/seek phase |
| **Campaign Tracker** | Pipeline management with stage-based workflow and history |
| **Prompt Management** | Versioned seek/fulfill/filter templates with in-platform execution |
| **Ops Dashboard** | Real-time campaign health, conversion metrics, and revenue tracking |

**Sprint Duration:** 4 sprints (8 weeks)  
**Team Size:** 2–3 full-stack developers, 1 UX/UI designer, 1 QA engineer

---

## 2. Integration Disclaimer & Architecture Alignment

> **This module is designed to integrate into an existing full-stack platform.** All technical decisions below should be adapted to match the current platform's architecture patterns, conventions, and infrastructure. The schema, API patterns, and UI framework recommendations are illustrative — the implementation team should map these to existing equivalents.

### Alignment Principles

| Principle | Application |
|-----------|-------------|
| **Extend, don't replace** | New tables, endpoints, and UI routes added alongside existing ones |
| **Match existing auth** | Role-based access control (RBAC) leverages current user/permission system |
| **Match existing patterns** | API design (REST/GraphQL), state management, and component architecture follow platform conventions |
| **Reuse infrastructure** | File storage, database, caching, and deployment pipelines use existing services |
| **Feature flag gate** | Module deployable behind a feature flag for gradual rollout |

### Assumed Existing Platform Capabilities

The implementation team should verify the following exist or plan their equivalent:

- User authentication and session management
- Role-based permission system (or ability to add roles)
- Relational database with migration tooling
- File/object storage service
- Frontend framework with component library
- API layer with validation middleware
- Background job queue (for async prompt execution)

---

## 3. Conceptual Model: Prospect as Campaign Journey

Each local business is treated as a **campaign** with a lifecycle of status changes.

### Campaign Stages (Pipeline)

```
┌──────────┐    ┌─────────────┐    ┌────────┐    ┌──────┐    ┌───────────┐    ┌──────────────┐    ┌──────────┐
│  SEEK    │───→│ PREVIEW     │───→│ SHOWN  │───→│ PAID │───→│ DELIVERED │───→│ RETAINER     │───→│ RETAINER │
│(Prospect)│    │ BUILT       │    │        │    │      │    │           │    │ PITCHED      │    │ WON      │
└──────────┘    └─────────────┘    └────────┘    └──────┘    └───────────┘    └──────────────┘    └──────────┘
     │                                                                                    │
     │                                                                                    │
     └────────────────────────────────────────────────────────────────────────────────────┘
                                    (Lost / Dead — terminal stages)
```

| Stage | Description | Exit Triggers |
|-------|-------------|---------------|
| **Seek** | Business identified, audit data captured | Build preview → Preview Built; Skip → Dead |
| **Preview Built** | Deliverable preview created and ready | Show to business → Shown; Abandon → Dead |
| **Shown** | Preview presented to business owner | Business says yes → Paid; No response after 7 days → Lost |
| **Paid** | Payment received, full deliverable in production | Deliver complete → Delivered |
| **Delivered** | Package delivered to business | Pitch retainer → Retainer Pitched; No pitch → Closed |
| **Retainer Pitched** | Recurring service offer presented | Business signs → Retainer Won; Declines → Closed |
| **Retainer Won** | Active recurring revenue client | Ongoing; can churn → Lost |
| **Lost** | Prospect showed interest but did not convert | Terminal; can be reactivated |
| **Dead** | No opportunity or business unreachable | Terminal |

### Stage Transition Rules

- All transitions are **logged with timestamp, user, and notes**
- Certain transitions are **irreversible** (e.g., Paid → Seek is not allowed)
- **Automated stage advances** possible: Shown → Lost after 7 days of no response (configurable)
- **Batch transitions** supported for admin efficiency

---

## 4. Database Schema

> **Adapt table names, column types, and constraint syntax to match existing platform conventions.** The relationships and fields should remain conceptually equivalent.

### Core Campaign Table

```sql
CREATE TABLE marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id VARCHAR(20) UNIQUE NOT NULL, -- e.g., AUS-AD-001 (City-Category-Sequence)
    business_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    neighborhood VARCHAR(100),
    contact_method VARCHAR(50), -- email, dm, walk_in
    contact_info VARCHAR(255),

    -- Audit snapshot (denormalized for quick filtering)
    gbp_claimed BOOLEAN DEFAULT FALSE,
    unaddressed_reviews INTEGER DEFAULT 0,
    last_review_date DATE,
    has_website VARCHAR(20), -- working, broken, none
    nap_consistent BOOLEAN,
    estimated_tier VARCHAR(20), -- tier_1, tier_2, tier_3
    estimated_fee DECIMAL(10,2),
    pain_score INTEGER DEFAULT 0,

    -- Campaign journey tracking
    stage VARCHAR(50) DEFAULT 'seek',
    stage_entered_at TIMESTAMP DEFAULT NOW(),
    date_entered TIMESTAMP DEFAULT NOW(),
    date_preview_built TIMESTAMP,
    date_shown TIMESTAMP,
    date_paid TIMESTAMP,
    date_delivered TIMESTAMP,
    date_retainer_pitched TIMESTAMP,
    date_retainer_won TIMESTAMP,

    -- Financial tracking
    package_delivered TEXT,
    amount_paid DECIMAL(10,2),
    retainer_status VARCHAR(50) DEFAULT 'not_pitched', -- not_pitched, pitched, won, declined
    retainer_amount DECIMAL(10,2),
    retainer_start_date DATE,

    -- Metadata
    notes TEXT,
    assigned_to UUID REFERENCES users(id), -- nullable = shared pool
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaigns_stage ON marketing_campaigns(stage);
CREATE INDEX idx_campaigns_category ON marketing_campaigns(category);
CREATE INDEX idx_campaigns_city ON marketing_campaigns(city);
CREATE INDEX idx_campaigns_assigned ON marketing_campaigns(assigned_to);
CREATE INDEX idx_campaigns_dates ON marketing_campaigns(date_entered, date_paid);
```

### Platform Audit Data

```sql
CREATE TABLE marketing_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- google, yelp, facebook, apple_maps, bing, bbb
    review_count INTEGER DEFAULT 0,
    average_rating DECIMAL(2,1),
    unaddressed_reviews INTEGER DEFAULT 0,
    owner_response_rate INTEGER DEFAULT 0,
    photo_count INTEGER DEFAULT 0,
    claimed BOOLEAN DEFAULT FALSE,
    active_page BOOLEAN DEFAULT FALSE,
    has_booking BOOLEAN DEFAULT FALSE,
    has_contact_form BOOLEAN DEFAULT FALSE,
    mobile_friendly BOOLEAN,
    audit_data JSONB, -- flexible platform-specific fields
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Campaign Stage History (Audit Trail)

```sql
CREATE TABLE marketing_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    trigger_type VARCHAR(50) DEFAULT 'manual' -- manual, automated, system
);
```

### File Attachments

```sql
CREATE TABLE marketing_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    file_type VARCHAR(50) NOT NULL, -- preview, paid_deliverable, runsheet, invoice, audit_output
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT NOW()
);
```

### Prompt Templates (Versioned)

```sql
CREATE TABLE marketing_prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    prompt_type VARCHAR(50) NOT NULL, -- seek, fulfill, filter, retainer, category_analysis, city_analysis
    category VARCHAR(100), -- NULL = generic / all categories
    version INTEGER DEFAULT 1,
    body TEXT NOT NULL,
    variables JSONB, -- ["business_name", "city", "category", "voice"]
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Prompt Executions

```sql
CREATE TABLE marketing_prompt_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    template_id UUID REFERENCES marketing_prompt_templates(id),
    variables_used JSONB,
    raw_output TEXT,
    filtered_output TEXT,
    pass_rate INTEGER,
    flagged_count INTEGER,
    status VARCHAR(50) DEFAULT 'pending', -- pending, filtered, reviewed, delivered, archived
    executed_by UUID REFERENCES users(id),
    executed_at TIMESTAMP DEFAULT NOW(),
    ai_provider VARCHAR(50),
    ai_model VARCHAR(50),
    tokens_used INTEGER
);
```

### Quality Filter Flags

```sql
CREATE TABLE marketing_filter_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES marketing_prompt_executions(id),
    response_number INTEGER,
    failed_checks JSONB,
    suggested_fix TEXT,
    human_override TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending' -- pending, fixed, approved_as_is
);
```

### Daily Scorecard

```sql
CREATE TABLE marketing_scorecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL,
    category_focus VARCHAR(100),
    neighborhood_focus VARCHAR(100),
    previews_built INTEGER DEFAULT 0,
    previews_shown INTEGER DEFAULT 0,
    packages_paid INTEGER DEFAULT 0,
    packages_delivered INTEGER DEFAULT 0,
    revenue_collected DECIMAL(10,2) DEFAULT 0,
    retainers_pitched INTEGER DEFAULT 0,
    retainers_won INTEGER DEFAULT 0,
    notes TEXT,
    UNIQUE(user_id, date)
);
```

---

## 5. Sprint Breakdown

### Sprint 0: Foundation & Design (Week 0)
**Goal:** Lock architecture, design system, and data model. Verify platform compatibility.

| Task | Owner | Deliverable |
|------|-------|-------------|
| Map existing platform tech stack, auth, and UI patterns | Tech Lead | Compatibility matrix |
| Finalize database schema and generate migrations | Backend Dev | Migration files + ERD |
| Design UI component specs (forms, tables, kanban, modals) | UX/UI Designer | Figma prototypes |
| Define `marketing_ops` RBAC role and permissions | Tech Lead | Permission matrix |
| Set up feature branch and CI/CD pipeline | DevOps | Green build |
| Document API contract patterns (match existing) | Backend Dev | OpenAPI/ Swagger spec skeleton |

**Exit Criteria:**
- [ ] Schema approved; migration files run successfully in dev
- [ ] UI prototypes reviewed by stakeholders
- [ ] RBAC matrix documented and aligned with existing auth
- [ ] Feature branch builds and passes existing test suite

---

### Sprint 1: Database + API Foundation + Prompt Templates (Week 1–2)
**Goal:** Backend fully operational. CRUD APIs for campaigns, audits, stage history, files, and prompt templates.

| Task | Owner | Points |
|------|-------|--------|
| Run database migrations | Backend Dev | 2 |
| Build `marketing_campaigns` CRUD endpoints | Backend Dev | 5 |
| Build `marketing_audits` endpoints | Backend Dev | 3 |
| Build stage transition endpoint with validation | Backend Dev | 3 |
| Build `marketing_stage_history` audit trail | Backend Dev | 2 |
| Build file upload/download endpoints | Backend Dev | 5 |
| Build `marketing_prompt_templates` CRUD | Backend Dev | 3 |
| Build `marketing_scorecards` endpoints | Backend Dev | 2 |
| RBAC middleware for all marketing routes | Backend Dev | 3 |
| Seed data (10 sample campaigns across 3 categories) | Backend Dev | 2 |
| API documentation | Backend Dev | 2 |

**Exit Criteria:**
- [ ] All endpoints return proper status codes with validation
- [ ] Stage transitions enforce business rules (no invalid moves)
- [ ] RBAC rejects unauthorized access
- [ ] File upload/download works with existing storage service
- [ ] Prompt template CRUD accessible to admin role

---

### Sprint 2: Campaign Intake + Prompt Workspace + Tracker UI (Week 3–4)
**Goal:** Admin can create a campaign, fill the audit intake form, execute prompts in-platform, and manage pipeline stages.

| Task | Owner | Points |
|------|-------|--------|
| Build reusable form components (aligned with existing design system) | Frontend Dev | 5 |
| Build Campaign Create/Edit form | Frontend Dev | 5 |
| Build Audit Intake Form (multi-section, platform tabs, auto-scoring) | Frontend Dev | 8 |
| Build Prompt Template Library UI (CRUD, versioning, categorization) | Frontend Dev | 5 |
| Build Prompt Workspace side panel (variable injection, copy-paste bridge) | Frontend Dev | 8 |
| Build AI Output Viewer (raw + formatted preview, save to campaign) | Frontend Dev | 5 |
| Build Campaign Tracker list view (sortable, filterable, bulk actions) | Frontend Dev | 5 |
| Build Kanban pipeline board (drag-and-drop stage transitions) | Frontend Dev | 8 |
| Stage transition modal with notes and validation | Frontend Dev | 3 |
| Pipeline history timeline per campaign | Frontend Dev | 3 |
| File attachment upload within campaign record | Frontend Dev | 3 |
| Mobile-responsive layout | Frontend Dev | 5 |

**Exit Criteria:**
- [ ] Admin can create a campaign from scratch
- [ ] Audit form auto-calculates pain score and recommends tier
- [ ] Prompt workspace generates seek/fulfill/filter text with variable injection
- [ ] Kanban board updates stage and logs history
- [ ] Tracker filters by stage, category, city, tier, and assignment
- [ ] Works on tablet and mobile

---

### Sprint 3: Dashboard + Direct AI Integration + Filter Review (Week 5–6)
**Goal:** Real-time dashboard, in-platform AI execution, and quality filter review queue.

| Task | Owner | Points |
|------|-------|--------|
| Build Dashboard layout (metric cards + pipeline columns + weekly summary) | Frontend Dev | 5 |
| Build metric card components | Frontend Dev | 3 |
| Build live pipeline board with stage counts | Frontend Dev | 5 |
| Build Daily Scorecard form | Frontend Dev | 3 |
| Build Weekly Summary and revenue tracker | Frontend Dev | 3 |
| Build Category/Neighborhood breakdown views | Frontend Dev | 5 |
| Integrate OpenAI/Anthropic API (async execution via job queue) | Backend Dev | 8 |
| Build streaming response UI | Frontend Dev | 5 |
| Build Filter Review Inbox (queue, batch approve/edit) | Frontend Dev | 8 |
| Build Execution History timeline per campaign | Frontend Dev | 3 |
| Token usage tracking and cost estimation | Backend Dev | 3 |
| Data export (CSV/JSON) | Backend Dev | 2 |
| SSE/WebSocket for live dashboard updates (or polling if existing pattern) | Backend Dev | 5 |

**Exit Criteria:**
- [ ] Dashboard loads with real data in <2 seconds
- [ ] Prompt execution calls AI API and returns results in-platform
- [ ] Filter flags appear in review inbox; batch actions work
- [ ] Scorecard form submits and updates dashboard
- [ ] Revenue numbers calculate correctly
- [ ] Export produces valid CSV

---

### Sprint 4: Migration + Polish + Launch (Week 7–8)
**Goal:** Migrate existing data, polish UI, QA, and deploy.

| Task | Owner | Points |
|------|-------|--------|
| Build data migration script (spreadsheet/legacy → database) | Backend Dev | 5 |
| Build file migration script (local folders → cloud storage) | Backend Dev | 3 |
| Build prompt template seed script (default seek/fulfill/filter templates) | Backend Dev | 2 |
| Run migration in staging; validate integrity | QA | 3 |
| UI polish: animations, empty states, error handling, loading skeletons | Frontend Dev | 5 |
| Accessibility audit (WCAG 2.1 AA) | UX/UI Designer | 3 |
| Performance audit (Lighthouse >90) | Frontend Dev | 3 |
| End-to-end testing (Cypress/Playwright) for all CUJs | QA | 5 |
| Security audit (RBAC, file access, injection) | Backend Dev | 3 |
| Production deployment + monitoring | DevOps | 3 |
| Admin documentation (user guide + video walkthrough) | UX/UI Designer | 3 |

**Exit Criteria:**
- [ ] All legacy businesses migrated with files attached
- [ ] Default prompt templates seeded and active
- [ ] Zero critical or high bugs
- [ ] Lighthouse score ≥90
- [ ] RBAC penetration tests pass
- [ ] Admin documentation published
- [ ] Feature flag enabled for `marketing_ops` role

---

## 6. Prompt Management Module (Detailed)

### 6.1 Template Library

Admins can create, edit, version, and categorize prompt templates. The platform ships with defaults.

**Default Template Set:**

| Template | Type | Variables |
|----------|------|-----------|
| `Seek: Business Audit` | seek | `{business_name}`, `{city}`, `{category}` |
| `Seek: Category Analysis` | seek | `{category}`, `{city}` |
| `Seek: City Ecosystem` | seek | `{city}` |
| `Fulfill: Review Responses` | fulfill | `{business_name}`, `{city}`, `{category}`, `{voice}`, `{reviews}` |
| `Fulfill: Service Menu` | fulfill | `{business_name}`, `{category}`, `{services}` |
| `Fulfill: GBP Optimization` | fulfill | `{business_name}`, `{city}`, `{category}`, `{services}` |
| `Filter: Response Quality` | filter | `{business_name}`, `{voice}`, `{responses}` |
| `Retainer: Follow-up Sequence` | retainer | `{business_name}`, `{category}`, `{city}` |

### 6.2 Variable Injection Engine

When an admin selects a template within a campaign record, the platform auto-populates known variables:

```javascript
// Pseudo-code matching existing platform patterns
const variables = {
  business_name: campaign.business_name,
  city: campaign.city,
  category: campaign.category,
  voice: campaign.audit_voice || 'friendly',
  reviews: campaign.unaddressed_reviews,
  // etc.
};

const populatedPrompt = template.body.replace(/{(\w+)}/g, (match, key) => variables[key] || match);
```

Unknown variables render as editable fields in the Prompt Workspace.

### 6.3 Execution Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Copy-Paste Bridge** | Platform injects variables, generates prompt text. Admin copies to external AI, pastes result back. | Sprint 2 (immediate); fallback mode |
| **Direct API** | Platform calls AI provider directly. Admin clicks "Run." Result streams back in-platform. | Sprint 3 (primary) |
| **Batch Execution** | Select multiple campaigns, run same prompt with per-campaign variable injection. Results queued. | v1.1 |

### 6.4 Quality Filter Workflow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  FULFILL PROMPT │───→ │  AI OUTPUT      │───→ │  FILTER PROMPT  │───→ │  FILTER REVIEW  │
│  (30 responses) │     │  (raw text)     │     │  (auto-audit)   │     │  INBOX          │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
                                                                              │
                                                                              │
                                    ┌─────────────────┐    ┌─────────────────┐
                                    │  APPROVED       │←───│  HUMAN FIX      │
                                    │  (auto-save)    │    │  (edit + save)  │
                                    └─────────────────┘    └─────────────────┘
```

**Filter checks (configurable per template):**
- Name usage (thanks reviewer by name)
- Specific reference (mentions detail from review)
- Tone match (matches business voice)
- Length compliance (negative ≤75 words, positive ≤50)
- Negative handling (acknowledges without defensiveness)
- Fact safety (no invented details)
- Platform compliance (no promos, no review requests, no disclosures)
- Grammar/spelling

### 6.5 Cost Tracking

| Metric | Tracked Per | Displayed In |
|--------|------------|--------------|
| Tokens used (input + output) | Execution | Execution history, campaign detail |
| Cost per execution | Execution | Execution history, admin settings |
| Daily/weekly spend | Aggregate | Dashboard (admin settings panel) |
| Cost per campaign | Aggregate | Campaign detail, revenue report |

---

## 7. UI/UX Specifications

### 7.1 Design Principles

| Principle | Application |
|-----------|-------------|
| **Density over whitespace** | Admin tools need information density; compact tables, tight card grids |
| **Color = meaning** | Pipeline stages use distinct colors; revenue = green; flags = amber; dead = gray |
| **One-click actions** | Stage transitions, file downloads, and quick edits require minimal clicks |
| **Contextual prompts** | Prompt workspace accessible from campaign detail; no page jumps |
| **Mobile parity** | Kanban collapses to swipeable lists; forms use accordion sections |
| **Dark mode support** | All components respect system preference |

### 7.2 Key Screens

| Screen | Primary Action | Secondary Actions |
|--------|---------------|-------------------|
| **Dashboard** | View campaign pipeline health | Submit daily scorecard, export data, filter by date |
| **Campaign List (Tracker)** | Filter and sort prospects | Bulk stage update, export CSV, quick-view modal, assign admin |
| **Campaign Detail** | View full journey + execute prompts | Edit record, upload files, change stage, view timeline, run prompts |
| **Audit Intake Form** | Submit structured audit | Auto-calculate score, save draft, duplicate for another platform |
| **Prompt Workspace** | Generate and execute prompts | Copy-paste bridge, save output to campaign, view history |
| **Filter Review Inbox** | Review flagged responses | Batch approve, batch edit, view pass rates |
| **Kanban Board** | Drag card to new stage | View card detail, filter by category/neighborhood, collapse columns |
| **Scorecard Form** | Log daily metrics | View historical scorecards, compare weeks |
| **Prompt Library** | Manage templates | Create, edit, version, categorize, set defaults |

### 7.3 Component Inventory

| Component | Usage | Variants |
|-----------|-------|----------|
| `MetricCard` | Dashboard top row | Small (4-up), Large (hero), Trend (up/down arrow) |
| `PipelineColumn` | Kanban board | Collapsible, scrollable, count badge |
| `CampaignCard` | Kanban cards | Compact (title + tier + fee), Expanded (preview + notes) |
| `AuditSection` | Intake form | Platform tabs (Google/Yelp/Facebook), Score summary |
| `StageBadge` | Tracker table + cards | 9 color-coded variants for each stage |
| `PromptWorkspace` | Campaign detail | Variable editor, output viewer, execution history |
| `FilterReviewItem` | Review inbox | Flag list, suggested fix, inline editor |
| `FileAttachment` | Campaign detail | Upload zone, file list, download link |
| `ScorecardForm` | Daily check-in | Number inputs, category/neighborhood selectors, notes |

---

## 8. Migration Plan

### 8.1 Data Migration

| Source | Target | Method | Risk |
|--------|--------|--------|------|
| Spreadsheet rows | `marketing_campaigns` | CSV export → transform script → SQL INSERT | Low |
| Text files (audit outputs) | `marketing_audits` | Parse with regex/JSON → structured insert | Medium |
| Local folder structure | `marketing_files` + storage | Recursive scan → upload → DB record | Low |
| Manual stage notes | `marketing_stage_history` | Infer stage from dates/folders → insert | Medium |
| External prompt files | `marketing_prompt_templates` | Copy → seed script → version 1 | Low |

### 8.2 Migration Script Outline

```python
# migrate_legacy.py
# Adapt to existing platform's ORM, CLI tools, or job runner

import pandas as pd
from datetime import datetime

# 1. Load legacy data
campaigns_df = pd.read_csv('legacy_prospects.csv')

# 2. Transform to campaign schema
campaigns_df['campaign_id'] = campaigns_df.apply(generate_campaign_id, axis=1)
campaigns_df['stage'] = campaigns_df['status'].map(LEGACY_STATUS_TO_STAGE)
campaigns_df['pain_score'] = campaigns_df.apply(calculate_pain_score, axis=1)

# 3. Insert campaigns
for _, row in campaigns_df.iterrows():
    campaign = create_campaign(row)

    # 4. Migrate files
    legacy_path = f"./legacy/{row['date_entered']}/{row['folder_name']}/"
    migrate_files(campaign.id, legacy_path)

    # 5. Reconstruct stage history from dates
    if row['date_paid']:
        log_stage_transition(campaign.id, 'shown', 'paid', row['date_paid'])
    if row['date_delivered']:
        log_stage_transition(campaign.id, 'paid', 'delivered', row['date_delivered'])

# 6. Seed default prompt templates
seed_prompt_templates()
```

### 8.3 Rollback Plan

- Migration runs in a database transaction; rollback on any failure
- Legacy files remain untouched until validation is signed off
- Feature flag keeps module hidden until admin approval
- Staging environment receives full dry-run before production

---

## 9. Testing Strategy

### 9.1 Test Layers

| Layer | Method | Coverage Target |
|-------|--------|-----------------|
| **Unit** | Match existing platform test framework | 80% business logic |
| **Integration** | API contract tests | All CRUD + stage transition endpoints |
| **E2E** | Cypress/Playwright or existing E2E tool | All critical user journeys |
| **Accessibility** | axe-core + manual screen reader | WCAG 2.1 AA |
| **Performance** | Lighthouse CI + load tests | <2s dashboard load, 100 concurrent users |
| **Security** | OWASP ZAP + manual RBAC tests | Zero high/critical findings |

### 9.2 Critical User Journeys (CUJs)

1. Admin creates campaign → fills audit form → views pain score → saves
2. Admin selects prompt template → runs seek → saves audit output
3. Admin runs fulfill prompt → receives AI output → runs filter → reviews flags
4. Admin moves campaign from "Preview Built" to "Shown" → logs notes
5. Admin marks campaign "Paid" → uploads deliverable file → marks "Delivered"
6. Admin submits daily scorecard → views updated dashboard metrics
7. Admin filters tracker by category + stage → exports CSV
8. Admin edits prompt template → creates new version → sets as default

---

## 10. Success Metrics (Post-Launch)

| Metric | Baseline (Manual) | Target (Platform) | Measurement |
|--------|-------------------|-------------------|-------------|
| Previews built per day | 3 | 5 | Daily scorecard aggregate |
| Conversion rate (shown → paid) | 20% | 25% | Pipeline ratio from `marketing_campaigns` |
| Time per preview build | 20 min | 10 min | Time from `seek` to `preview_built` (stage history) |
| Time per paid build | 30 min | 15 min | Time from `paid` to `delivered` |
| Revenue per week | $1,500 | $2,500 | `amount_paid` weekly sum |
| Data loss incidents | Occasional | 0 | Audit trail verification |
| Admin onboarding time | N/A | <30 min | Time to first campaign record |
| Prompt execution in-platform | 0% | 90%+ | `marketing_prompt_executions` vs. manual logs |
| Filter pass rate | N/A | 85%+ | `marketing_filter_flags` aggregate |

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration corrupts legacy data | Low | High | Full backup, dry-run, transactional inserts |
| Existing auth system incompatible | Low | High | Sprint 0 compatibility audit; build adapter |
| AI API costs exceed budget | Medium | Medium | Token tracking, spend alerts, rate limiting |
| File storage costs spike | Medium | Medium | Size limits, compression, retention policy |
| Admin adoption resistance | Medium | Medium | Parallel run for 2 weeks; legacy mode available |
| Performance degradation at scale | Medium | Medium | Pagination, indexing, query optimization |
| Scope creep (additional features) | High | Medium | Strict backlog; v1.1 roadmap for new ideas |
| AI output quality inconsistent | Medium | High | Filter prompts, human review queue, template versioning |

---

## 12. v1.1 Roadmap (Post-MVP)

| Feature | Value | Effort |
|---------|-------|--------|
| **Batch prompt execution** — Run fulfill across 5 campaigns simultaneously | High | Medium |
| **Email integration** — Send previews and deliverables directly from platform | High | Low |
| **Calendar integration** — Due dates, follow-up reminders, retainer renewal alerts | Medium | Low |
| **Team leaderboard** — Compare admin performance (previews, conversions, revenue) | Medium | Medium |
| **Client portal** — Businesses view their audit results (read-only) | Medium | High |
| **Retainer automation** — Recurring billing tracking and renewal workflows | High | Medium |
| **Multi-city dashboard** — Aggregate view across cities | Low | Medium |
| **AI model A/B testing** — Compare GPT-4o vs. Claude outputs per template | Medium | Medium |
| **Smart recommendations** — Platform suggests next action based on stage and history | High | Medium |

---

## 13. Appendix

### A. Campaign ID Naming Convention

```
{CITY_CODE}_{CATEGORY_CODE}_{SEQUENCE}

Examples:
AUS_AD_001    → Austin, Auto Detailing, #1
AUS_HV_012    → Austin, HVAC, #12
DAL_DN_003    → Dallas, Dentist, #3
```

### B. File Naming Convention (System-Enforced)

| Pattern | Example |
|---------|---------|
| Preview deliverable | `{CAMPAIGN-ID}_preview_{DATE}.pdf` |
| Paid package | `{CAMPAIGN-ID}_paid_{TIER}_{DATE}.pdf` |
| Fulfillment runsheet | `{CAMPAIGN-ID}_runsheet_{DATE}.pdf` |
| Invoice | `{CAMPAIGN-ID}_invoice_{DATE}.pdf` |
| Audit output | `{CAMPAIGN-ID}_audit_{PLATFORM}_{DATE}.txt` |

### C. Stage Color Mapping (UI Reference)

| Stage | Color | Hex (Light) | Hex (Dark) |
|-------|-------|-------------|------------|
| Seek | Gray | `#6B7280` | `#9CA3AF` |
| Preview Built | Blue | `#3B82F6` | `#60A5FA` |
| Shown | Amber | `#F59E0B` | `#FBBF24` |
| Paid | Green | `#10B981` | `#34D399` |
| Delivered | Emerald | `#059669` | `#6EE7B7` |
| Retainer Pitched | Purple | `#8B5CF6` | `#A78BFA` |
| Retainer Won | Indigo | `#6366F1` | `#818CF8` |
| Lost | Rose | `#F43F5E` | `#FB7185` |
| Dead | Slate | `#475569` | `#94A3B8` |

---

## 14. Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | _______________ | _______________ | _______________ |
| Tech Lead | _______________ | _______________ | _______________ |
| UX/UI Designer | _______________ | _______________ | _______________ |
| QA Lead | _______________ | _______________ | _______________ |

---

*End of Sprint Plan Document v2.0*
