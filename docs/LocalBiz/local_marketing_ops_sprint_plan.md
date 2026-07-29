# Sprint Plan: Local Marketing Ops Platform — Admin Capability Build

**Document Version:** 1.0  
**Date:** 2026-07-28  
**Status:** Draft — Ready for Review  
**Platform Context:** Existing full-stack web application (admin capability addition)


## 1. Executive Summary

This sprint plan delivers a complete **Local Marketing Operations** admin module within the existing platform. The module consists of three core capabilities:

1. **Audit Intake Form** — Structured data capture during the business discovery/seek phase

2. **Prospect Tracker** — CRM-style pipeline management with stage-based workflow

3. **Ops Dashboard** — Real-time visual pipeline with daily/weekly metrics

All three components are built as an **admin-only capability** with role-based access, modern UI/UX, and a migration path from any existing manual or spreadsheet-based workflows.

**Sprint Duration:** 4 sprints (8 weeks)  
**Team Size:** 2–3 developers (full-stack), 1 UX/UI designer, 1 QA


## 2. Current State Assessment

| Aspect | Current State | Target State |
| - | - | - |
| **Data Storage** | Manual (spreadsheets, text files, local folders) | Centralized database with relational schema |
| **Intake** | Ad-hoc prompt outputs, no standardization | Structured form with validation, auto-scoring, and persistence |
| **Tracking** | Spreadsheet rows, no pipeline visualization | Kanban-style pipeline with stage transitions, filters, and history |
| **Reporting** | Manual counting, no real-time visibility | Live dashboard with daily/weekly aggregates, category/neighborhood breakdowns |
| **Access** | Single operator, local files | Multi-admin with RBAC, cloud-accessible, mobile-responsive |
| **File Management** | Local folder hierarchy (`/2026-07-28/AUS-AD-001/...`) | Cloud storage with business-record attachment linking |



## 3. Architecture & Tech Stack

### 3.1 Recommended Stack (Aligned with Existing Platform)

| Layer | Recommendation | Rationale |
| - | - | - |
| **Frontend** | React/Vue/Angular (match existing) + Tailwind CSS | Consistent with platform; Tailwind for rapid modern UI |
| **State Management** | React Query / SWR / Vuex (match existing) | Server-state sync for real-time dashboard |
| **Backend API** | REST or GraphQL (match existing) + new endpoints | Extend existing API layer; no new infrastructure |
| **Database** | PostgreSQL / MySQL (existing) + new tables | Relational schema for businesses, audits, pipeline stages |
| **File Storage** | S3 / Cloud Storage / Existing storage service | Attach previews, deliverables, and runsheets to business records |
| **Auth/RBAC** | Existing auth system + new `marketing\_ops` role | Leverage current user/role system |
| **Real-time** | Server-Sent Events (SSE) or WebSockets (if existing) | Live dashboard updates without polling |


### 3.2 New Database Schema

```
-- Core business record  
CREATE TABLE businesses (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    business\_id VARCHAR(20) UNIQUE NOT NULL, -- e.g., AUS-AD-001  
    name VARCHAR(255) NOT NULL,  
    category VARCHAR(100) NOT NULL,  
    city VARCHAR(100) NOT NULL,  
    neighborhood VARCHAR(100),  
    contact\_method VARCHAR(50), -- email, dm, walk-in  
    contact\_info VARCHAR(255),  
    gbp\_claimed BOOLEAN DEFAULT FALSE,  
    unaddressed\_reviews INTEGER DEFAULT 0,  
    last\_review\_date DATE,  
    has\_website VARCHAR(20), -- working, broken, none  
    nap\_consistent BOOLEAN,  
    estimated\_tier VARCHAR(20), -- tier\_1, tier\_2, tier\_3  
    estimated\_fee DECIMAL(10,2),  
    pipeline\_stage VARCHAR(50) DEFAULT 'seek', -- seek, preview\_built, shown, paid, delivered, retainer\_pitched, retainer\_won, lost, dead  
    date\_entered TIMESTAMP DEFAULT NOW(),  
    date\_shown TIMESTAMP,  
    date\_paid TIMESTAMP,  
    date\_delivered TIMESTAMP,  
    package\_delivered TEXT,  
    amount\_paid DECIMAL(10,2),  
    retainer\_status VARCHAR(50) DEFAULT 'not\_pitched',  
    retainer\_amount DECIMAL(10,2),  
    notes TEXT,  
    created\_by UUID REFERENCES users(id),  
    created\_at TIMESTAMP DEFAULT NOW(),  
    updated\_at TIMESTAMP DEFAULT NOW()  
);  
  
-- Audit intake data (one-to-many with businesses)  
CREATE TABLE business\_audits (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    business\_id UUID REFERENCES businesses(id) ON DELETE CASCADE,  
    platform VARCHAR(50) NOT NULL, -- google, yelp, facebook, apple\_maps, bing  
    review\_count INTEGER DEFAULT 0,  
    average\_rating DECIMAL(2,1),  
    unaddressed\_reviews INTEGER DEFAULT 0,  
    owner\_response\_rate INTEGER DEFAULT 0, -- percentage  
    photo\_count INTEGER DEFAULT 0,  
    claimed BOOLEAN DEFAULT FALSE,  
    active\_page BOOLEAN DEFAULT FALSE,  
    has\_booking BOOLEAN DEFAULT FALSE,  
    pain\_score INTEGER DEFAULT 0,  
    audit\_data JSONB, -- flexible schema for platform-specific fields  
    created\_at TIMESTAMP DEFAULT NOW()  
);  
  
-- Pipeline stage history (audit trail)  
CREATE TABLE pipeline\_history (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    business\_id UUID REFERENCES businesses(id) ON DELETE CASCADE,  
    from\_stage VARCHAR(50),  
    to\_stage VARCHAR(50) NOT NULL,  
    changed\_by UUID REFERENCES users(id),  
    changed\_at TIMESTAMP DEFAULT NOW(),  
    notes TEXT  
);  
  
-- File attachments (previews, deliverables, runsheets)  
CREATE TABLE business\_files (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    business\_id UUID REFERENCES businesses(id) ON DELETE CASCADE,  
    file\_type VARCHAR(50) NOT NULL, -- preview, paid\_deliverable, runsheet, invoice  
    file\_name VARCHAR(255) NOT NULL,  
    storage\_path VARCHAR(500) NOT NULL,  
    file\_size INTEGER,  
    mime\_type VARCHAR(100),  
    uploaded\_by UUID REFERENCES users(id),  
    uploaded\_at TIMESTAMP DEFAULT NOW()  
);  
  
-- Daily scorecard entries  
CREATE TABLE daily\_scorecards (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    user\_id UUID REFERENCES users(id),  
    date DATE NOT NULL,  
    category\_focus VARCHAR(100),  
    neighborhood\_focus VARCHAR(100),  
    previews\_built INTEGER DEFAULT 0,  
    previews\_shown INTEGER DEFAULT 0,  
    packages\_paid INTEGER DEFAULT 0,  
    packages\_delivered INTEGER DEFAULT 0,  
    revenue\_collected DECIMAL(10,2) DEFAULT 0,  
    retainers\_pitched INTEGER DEFAULT 0,  
    retainers\_won INTEGER DEFAULT 0,  
    notes TEXT,  
    UNIQUE(user\_id, date)  
);
```


## 4. Sprint Breakdown

### Sprint 0: Foundation & Design (Week 0)

**Goal:** Lock architecture, design system, and data model. No feature code.

| Task | Owner | Deliverable |
| - | - | - |
| Audit existing platform tech stack and auth system | Tech Lead | Compatibility report |
| Finalize database schema and migrations | Backend Dev | Migration files + ERD diagram |
| Design UI component library (forms, tables, cards, kanban) | UX/UI Designer | Figma prototypes + component specs |
| Define RBAC rules for `marketing\_ops` admin role | Tech Lead | Role permission matrix |
| Set up feature branch and CI/CD pipeline | DevOps/Backend | Green build pipeline |


**Sprint 0 Exit Criteria:**

- [ ] Schema approved and migration files generated

- [ ] Figma prototypes for all three capabilities reviewed

- [ ] RBAC matrix documented

- [ ] Feature branch builds successfully


### Sprint 1: Database + API Foundation (Week 1–2)

**Goal:** Backend is fully operational. APIs support CRUD for businesses, audits, and pipeline transitions.

| Task | Owner | Story Points |
| - | - | - |
| Run database migrations | Backend Dev | 2 |
| Build `Business` model + CRUD endpoints | Backend Dev | 5 |
| Build `BusinessAudit` model + endpoints | Backend Dev | 3 |
| Build `PipelineHistory` audit trail | Backend Dev | 3 |
| Build `BusinessFile` upload/download endpoints | Backend Dev | 5 |
| Build `DailyScorecard` endpoints | Backend Dev | 3 |
| Implement RBAC middleware for admin routes | Backend Dev | 3 |
| API documentation (OpenAPI/Swagger) | Backend Dev | 2 |
| Seed data for testing (10 sample businesses) | Backend Dev | 2 |


**Sprint 1 Exit Criteria:**

- [ ] All endpoints return 200/201 with proper validation

- [ ] RBAC rejects non-admin users

- [ ] File upload/download works with existing storage service

- [ ] Postman/curl tests pass for all endpoints


### Sprint 2: Intake Form + Tracker UI (Week 3–4)

**Goal:** Admin can create a business record, fill the audit intake form, and manage pipeline stages.

| Task | Owner | Story Points |
| - | - | - |
| Build reusable form components (inputs, selects, toggles, score displays) | Frontend Dev | 5 |
| Build Business Create/Edit form | Frontend Dev | 5 |
| Build Audit Intake Form (multi-section, platform tabs) | Frontend Dev | 8 |
| Auto-calculate pain score and recommended tier on form | Frontend Dev | 3 |
| Build Prospect Tracker list view (sortable, filterable table) | Frontend Dev | 5 |
| Build Kanban pipeline board (drag-and-drop stage transitions) | Frontend Dev | 8 |
| Stage transition modal with notes | Frontend Dev | 3 |
| Pipeline history sidebar (timeline view per business) | Frontend Dev | 3 |
| File attachment upload within business record | Frontend Dev | 3 |
| Mobile-responsive layout for all views | Frontend Dev | 5 |


**Sprint 2 Exit Criteria:**

- [ ] Admin can create a business from scratch

- [ ] Audit form auto-calculates pain score and tier recommendation

- [ ] Kanban board updates pipeline stage and logs history

- [ ] Table filters work by category, city, stage, and tier

- [ ] Works on tablet and mobile


### Sprint 3: Dashboard + Reporting (Week 5–6)

**Goal:** Real-time dashboard with daily scorecard, weekly metrics, and visual pipeline.

| Task | Owner | Story Points |
| - | - | - |
| Build Dashboard layout (metric cards + pipeline columns + weekly summary) | Frontend Dev | 5 |
| Build metric card components (previews, conversions, revenue, etc.) | Frontend Dev | 3 |
| Build live pipeline board (real-time stage counts) | Frontend Dev | 5 |
| Build Daily Scorecard form (operator check-in) | Frontend Dev | 3 |
| Build Weekly Summary section (aggregated from scorecards) | Frontend Dev | 3 |
| Build Category/Neighborhood breakdown charts | Frontend Dev | 5 |
| Build Revenue tracker (daily, weekly, monthly views) | Frontend Dev | 3 |
| Implement SSE/WebSocket for live dashboard updates | Backend Dev | 5 |
| Build data export (CSV/JSON for business lists) | Backend Dev | 2 |


**Sprint 3 Exit Criteria:**

- [ ] Dashboard loads with real data in \<2 seconds

- [ ] Scorecard form submits and updates dashboard

- [ ] Pipeline stage changes reflect on dashboard without refresh

- [ ] Revenue numbers calculate correctly from paid/delivered records

- [ ] Export produces valid CSV


### Sprint 4: Migration + Polish + Launch (Week 7–8)

**Goal:** Migrate existing data, polish UI, QA, and deploy to production.

| Task | Owner | Story Points |
| - | - | - |
| Build data migration script (spreadsheet → database) | Backend Dev | 5 |
| Build file migration script (local folders → cloud storage) | Backend Dev | 3 |
| Run migration in staging environment | Backend Dev | 2 |
| Validate migrated data integrity | QA | 3 |
| UI polish: animations, empty states, error handling | Frontend Dev | 5 |
| Accessibility audit (WCAG 2.1 AA) | UX/UI Designer | 3 |
| Performance audit (Lighthouse score \>90) | Frontend Dev | 3 |
| End-to-end testing (Cypress/Playwright) | QA | 5 |
| Security audit (RBAC, file access, SQL injection) | Backend Dev | 3 |
| Production deployment + monitoring setup | DevOps | 3 |
| Admin documentation (user guide + video walkthrough) | UX/UI Designer | 3 |


**Sprint 4 Exit Criteria:**

- [ ] All existing businesses migrated with files attached

- [ ] Zero critical or high bugs

- [ ] Lighthouse score ≥90

- [ ] RBAC penetration tests pass

- [ ] Admin documentation published

- [ ] Feature flag enabled for `marketing\_ops` role


## 5. UI/UX Design Specifications

### 5.1 Design Principles

| Principle | Application |
| - | - |
| **Density over whitespace** | Admin tools need information density; compact tables, tight card grids |
| **Color = meaning** | Pipeline stages use distinct colors; revenue = green; flags = amber; dead = gray |
| **One-click actions** | Stage transitions, file downloads, and quick edits require minimal clicks |
| **Mobile parity** | Kanban board collapses to swipeable lists; forms use accordion sections |
| **Dark mode support** | All components respect system preference |


### 5.2 Key Screens

| Screen | Primary Action | Secondary Actions |
| - | - | - |
| **Dashboard** | View pipeline health | Submit daily scorecard, export data, filter by date |
| **Business List (Tracker)** | Filter and sort prospects | Bulk stage update, export CSV, quick-view modal |
| **Business Detail** | View full audit history | Edit record, upload files, change stage, view pipeline timeline |
| **Audit Intake Form** | Submit structured audit | Auto-calculate score, save draft, duplicate for another platform |
| **Kanban Board** | Drag card to new stage | View card detail, filter by category/neighborhood, collapse columns |
| **Scorecard Form** | Log daily metrics | View historical scorecards, compare weeks |


### 5.3 Component Inventory

| Component | Usage | Variants |
| - | - | - |
| `MetricCard` | Dashboard top row | Small (4-up), Large (hero), Trend (up/down arrow) |
| `PipelineColumn` | Kanban board | Collapsible, scrollable, count badge |
| `PipelineCard` | Kanban cards | Compact (title + tier + fee), Expanded (preview + notes) |
| `AuditSection` | Intake form | Platform tabs (Google/Yelp/Facebook), Score summary |
| `StageBadge` | Tracker table + cards | 9 color-coded variants for each stage |
| `FileAttachment` | Business detail | Upload zone, file list, download link |
| `ScorecardForm` | Daily check-in | Number inputs, category/neighborhood selectors, notes |



## 6. Migration Plan

### 6.1 Data Migration

| Source | Target | Method | Risk |
| - | - | - | - |
| Spreadsheet rows | `businesses` table | CSV export → Python/Pandas script → SQL INSERT | Low |
| Text files (audit outputs) | `business\_audits` table | Parse with regex → JSONB insert | Medium |
| Local folder structure | `business\_files` table + cloud storage | Recursive file scan → upload → DB record | Low |
| Manual stage notes | `pipeline\_history` table | Infer stage from folder name/date → insert | Medium |


### 6.2 Migration Script Outline

```
\# migrate\_businesses.py  
import pandas as pd  
from sqlalchemy import create\_engine  
  
\# 1. Load spreadsheet  
df = pd.read\_csv('legacy\_prospects.csv')  
  
\# 2. Transform columns to match schema  
df\['business\_id'\] = df.apply(generate\_business\_id, axis=1)  
df\['pipeline\_stage'\] = df\['status'\].map(STATUS\_MAP)  
df\['estimated\_tier'\] = df\['tier'\].map(TIER\_MAP)  
  
\# 3. Insert to database  
engine = create\_engine(DATABASE\_URL)  
df.to\_sql('businesses', engine, if\_exists='append', index=False)  
  
\# 4. Migrate files  
for business in df.itertuples():  
    local\_path = f"./legacy/\{business.date\_entered\}/\{business.folder\_name\}/"  
    migrate\_files\_to\_cloud(business.id, local\_path)  
  
\# 5. Generate pipeline history from dates  
for business in df.itertuples():  
    if business.date\_paid:  
        insert\_stage\_transition(business.id, 'shown', 'paid', business.date\_paid)  
    if business.date\_delivered:  
        insert\_stage\_transition(business.id, 'paid', 'delivered', business.date\_delivered)
```

### 6.3 Rollback Plan

- Migration runs in a transaction; rollback on failure

- Legacy files remain untouched until validation complete

- Feature flag keeps new module hidden until admin approval

- Staging environment mirrors production for dry-run testing


## 7. Admin Capability Specifications

### 7.1 Role: `marketing\_ops\_admin`

| Permission | Description |
| - | - |
| `business:create` | Add new business records |
| `business:read` | View all business records and audits |
| `business:update` | Edit business details and stage |
| `business:delete` | Soft-delete (archive) business records |
| `audit:create` | Submit audit intake forms |
| `audit:read` | View all audit data |
| `file:upload` | Attach files to business records |
| `file:download` | Download attached files |
| `dashboard:read` | View ops dashboard and metrics |
| `scorecard:create` | Submit daily scorecards |
| `scorecard:read` | View own and team scorecards |
| `export:data` | Export business lists and reports |


### 7.2 Multi-Admin Considerations

| Feature | Implementation |
| - | - |
| **Assignment** | Businesses can be assigned to specific admins; unassigned = shared pool |
| **Visibility** | Admins see all businesses by default; filter by "My assignments" |
| **Collision** | Optimistic locking on business records; warn if another admin is editing |
| **Audit Trail** | Every stage change, edit, and file upload logged with user + timestamp |
| **Notifications** | In-app alerts when a business you built is paid/delivered by another admin |



## 8. Testing Strategy

| Layer | Method | Coverage Target |
| - | - | - |
| **Unit** | Jest/Vitest (frontend), Pytest/Jest (backend) | 80% logic coverage |
| **Integration** | API contract tests (supertest/httpx) | All CRUD endpoints |
| **E2E** | Cypress/Playwright | Critical user journeys |
| **Accessibility** | axe-core + manual screen reader | WCAG 2.1 AA |
| **Performance** | Lighthouse CI + k6 load tests | \<2s dashboard load, 100 concurrent users |
| **Security** | OWASP ZAP + manual RBAC tests | Zero high/critical findings |


### 8.1 Critical User Journeys (CUJs)

1. Admin creates business → fills audit form → views pain score → saves

2. Admin moves business from "Preview Built" to "Shown" → logs notes

3. Admin marks business "Paid" → uploads deliverable file → marks "Delivered"

4. Admin submits daily scorecard → views updated dashboard metrics

5. Admin filters tracker by category "Auto Detailing" + stage "Paid" → exports CSV


## 9. Success Metrics (Post-Launch)

| Metric | Baseline (Manual) | Target (Platform) | Measurement |
| - | - | - | - |
| Previews built per day | 3 | 5 | Daily scorecard aggregate |
| Conversion rate | 20% | 25% | `shown` → `paid` pipeline ratio |
| Time per preview build | 20 min | 12 min | Time from `seek` to `preview\_built` |
| Revenue per week | $1,500 | $2,500 | `amount\_paid` weekly sum |
| Data loss incidents | Occasional (file misplacement) | 0 | Audit trail verification |
| Admin onboarding time | N/A (single user) | \<30 min | Time to first business record |



## 10. Risk Register

| Risk | Likelihood | Impact | Mitigation |
| - | - | - | - |
| Migration corrupts legacy data | Low | High | Full backup, dry-run in staging, transactional inserts |
| Existing auth system incompatible | Low | High | Sprint 0 compatibility audit; build adapter if needed |
| File storage costs spike | Medium | Medium | Implement file size limits, auto-compression, retention policy |
| Admin adoption resistance | Medium | Medium | Parallel run for 2 weeks; legacy spreadsheet stays available |
| Performance degradation at scale | Medium | Medium | Pagination, indexing, query optimization in Sprint 3 |
| Scope creep (additional features) | High | Medium | Strict backlog; new ideas go to v1.1 roadmap |



## 11. v1.1 Roadmap (Post-MVP)

| Feature | Value | Effort |
| - | - | - |
| **AI integration** — Auto-generate review responses from within the platform | High | Medium |
| **Email integration** — Send previews and deliverables directly from the app | High | Low |
| **Calendar integration** — Due dates and follow-up reminders | Medium | Low |
| **Team leaderboard** — Compare admin performance (previews, conversions, revenue) | Medium | Medium |
| **Client portal** — Businesses can view their own audit results (read-only) | Medium | High |
| **Retainer automation** — Recurring billing tracking and renewal alerts | High | Medium |
| **Multi-city view** — Dashboard aggregates across cities | Low | Medium |
| **Template library** — Save and reuse common review response templates | High | Low |



## 12. Appendix: File Naming Convention (System-Enforced)

| Pattern | Example | Description |
| - | - | - |
| `\{CITY-CODE\}\_\{CAT-CODE\}\_\{SEQ\}` | `AUS\_AD\_001` | Business ID (unique, permanent) |
| `\{BIZ-ID\}\_preview\_\{DATE\}` | `AUS\_AD\_001\_preview\_2026-07-28.pdf` | Preview deliverable |
| `\{BIZ-ID\}\_paid\_\{TIER\}\_\{DATE\}` | `AUS\_AD\_001\_paid\_tier2\_2026-07-28.pdf` | Paid package deliverable |
| `\{BIZ-ID\}\_runsheet\_\{DATE\}` | `AUS\_AD\_001\_runsheet\_2026-07-28.pdf` | Fulfillment runsheet |
| `\{BIZ-ID\}\_invoice\_\{DATE\}` | `AUS\_AD\_001\_invoice\_2026-07-28.pdf` | Invoice document |



## 13. Sign-Off

| Role | Name | Signature | Date |
| - | - | - | - |
| Product Owner | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| Tech Lead | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| UX/UI Designer | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |
| QA Lead | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ | \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_ |



## *Prompt Management Module (Add to Sprint 2 + Sprint 3)*

### *What It Does*

*Table *

| Feature | Description |
| - | - |
| **Template Library** | Seek, fulfill, and filter prompts stored as versioned templates |
| **Variable Injection** | Operator selects a business; platform auto-fills `\{BUSINESS\_NAME\}`, `\{CITY\}`, `\{CATEGORY\}`, etc. |
| **Execution Workspace** | Run the prompt in-platform via API (OpenAI/Anthropic) or copy-paste mode |
| **Result Storage** | AI outputs auto-saved to the business record, timestamped, linked to the prompt version |
| **Filter Queue** | Quality filter results flagged for human review appear in a dedicated inbox |
| **History** | Every prompt run, every output, every edit is logged per business |


### *Data Model Addition*

*sql *

```
*`-- Prompt templates (versioned)`*

*`CREATE TABLE prompt\_templates (`*

*`    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),`*

*`    name VARCHAR(100) NOT NULL, -- "Seek: Business Audit", "Fulfill: Review Responses"`*

*`    type VARCHAR(50) NOT NULL, -- seek, fulfill, filter, retainer`*

*`    category VARCHAR(100), -- auto\_detailing, dentist, generic (NULL = all)`*

*`    version INTEGER DEFAULT 1,`*

*`    body TEXT NOT NULL, -- the prompt text with \{VARIABLES\}`*

*`    variables JSONB, -- \["business\_name", "city", "category", "voice"\]`*

*`    is\_active BOOLEAN DEFAULT TRUE,`*

*`    created\_by UUID REFERENCES users(id),`*

*`    created\_at TIMESTAMP DEFAULT NOW()`*

*`);`*


*`-- Prompt executions (audit trail)`*

*`CREATE TABLE prompt\_executions (`*

*`    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),`*

*`    business\_id UUID REFERENCES businesses(id) ON DELETE CASCADE,`*

*`    template\_id UUID REFERENCES prompt\_templates(id),`*

*`    variables\_used JSONB, -- snapshot of what was injected`*

*`    raw\_output TEXT, -- the AI response`*

*`    filtered\_output TEXT, -- after quality filter (if applicable)`*

*`    pass\_rate INTEGER, -- from filter (NULL if not filtered)`*

*`    flagged\_count INTEGER,`*

*`    status VARCHAR(50), -- pending, filtered, reviewed, delivered`*

*`    executed\_by UUID REFERENCES users(id),`*

*`    executed\_at TIMESTAMP DEFAULT NOW(),`*

*`    ai\_provider VARCHAR(50), -- openai, anthropic, manual`*

*`    ai\_model VARCHAR(50), -- gpt-4o, claude-3-5-sonnet, etc.`*

*`    tokens\_used INTEGER`*

*`);`*


*`-- Quality filter flags (human review queue)`*

*`CREATE TABLE filter\_flags (`*

*`    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),`*

*`    execution\_id UUID REFERENCES prompt\_executions(id),`*

*`    response\_number INTEGER,`*

*`    failed\_checks JSONB, -- \["name\_usage", "tone\_match"\]`*

*`    suggested\_fix TEXT,`*

*`    human\_override TEXT, -- what the admin actually wrote`*

*`    reviewed\_by UUID REFERENCES users(id),`*

*`    reviewed\_at TIMESTAMP,`*

*`    status VARCHAR(50) DEFAULT 'pending' -- pending, fixed, approved\_as\_is`*

*`);`*
```


### *UI Screens to Add*

*Table *

| Screen | Sprint | Description |
| - | - | - |
| **Prompt Library** | Sprint 2 | CRUD for templates. Admins can edit, version, and categorize prompts. |
| **Business Prompt Workspace** | Sprint 2 | Side panel on the business detail page. Select template → auto-inject variables → run. |
| **AI Output Viewer** | Sprint 2 | Split-pane view: raw output on left, formatted preview on right. Save to business record. |
| **Filter Review Inbox** | Sprint 3 | Queue of flagged responses. One-click approve or edit. Batch actions. |
| **Execution History** | Sprint 3 | Timeline of every prompt run for a business. Rollback to previous version. |


### *Workflow In-Platform (No External Tools)*

*plain *

```
*`┌─────────────────────────────────────────────────────────────┐`*

*`│  BUSINESS DETAIL PAGE                                       │`*

*`│  ─────────────────────────────────────                      │`*

*`│  \[Prompt Workspace\]  \[Audit Form\]  \[Files\]  \[Pipeline\]      │`*

*`│                                                             │`*

*`│  ┌─────────────────────────────────────┐                    │`*

*`│  │ Select Prompt: \[Seek: Business ▼\]   │                    │`*

*`│  │ Variables: Business Name: Austin    │                    │`*

*`│  │            City: Austin, TX         │                    │`*

*`│  │            Category: Auto Detailing │                    │`*

*`│  │                                     │                    │`*

*`│  │ \[▶ Run Prompt\]  \[Copy to Clipboard\] │                    │`*

*`│  └─────────────────────────────────────┘                    │`*

*`│                                                             │`*

*`│  ┌─────────────────────────────────────┐                    │`*

*`│  │ OUTPUT                              │                    │`*

*`│  │ • 23 unaddressed reviews            │                    │`*

*`│  │ • 4 negative, 19 positive           │                    │`*

*`│  │ • Voice: friendly                   │                    │`*

*`│  │                                     │                    │`*

*`│  │ \[Save to Audit\]  \[Run Fulfill ▶\]    │                    │`*

*`│  └─────────────────────────────────────┘                    │`*

*`└─────────────────────────────────────────────────────────────┘`*
```


### *API Integration Strategy*

*Table *

| Phase | Implementation | Sprint |
| - | - | - |
| **Phase 1: Copy-Paste Bridge** | Platform injects variables, generates prompt text, operator copies to external AI, pastes result back. Platform stores the I/O. | Sprint 2 |
| **Phase 2: Direct API** | Platform calls OpenAI/Anthropic directly. Operator clicks "Run," result streams back in 10–15 seconds. Auto-saved. | Sprint 3 or v1.1 |
| **Phase 3: Batch Execution** | Select 5 businesses, run the same fulfill prompt across all 5 with variable injection. Results queued and processed. | v1.1 |

***Recommendation:** Build Phase 1 in Sprint 2 (low risk, immediate workflow consolidation). Add Phase 2 in Sprint 3 if API keys and budget are ready.*


### *Updated Sprint Assignments*

***Sprint 2 (Revised):** Add Prompt Template CRUD + Business Prompt Workspace + Copy-Paste Bridge*

*Table *

| New Task | Points |
| - | - |
| Prompt template data model + endpoints | 3 |
| Prompt template CRUD UI (library) | 3 |
| Variable injection engine (`\{BUSINESS\_NAME\}` → auto-fill) | 3 |
| Business Prompt Workspace side panel | 5 |
| Copy-paste bridge (generate → copy → paste back → store) | 3 |
| Execution history log | 2 |

***Sprint 3 (Revised):** Add Direct API Integration + Filter Review Inbox*

*Table *

| New Task | Points |
| - | - |
| OpenAI/Anthropic API integration | 5 |
| Streaming response UI | 3 |
| Filter Review Inbox (queue + batch actions) | 5 |
| Token usage tracking | 2 |


### *Cost Estimation (Direct API Phase)*

*Table *

| Package Size | Avg Tokens | Cost per Run (GPT-4o) | Cost per Run (Claude 3.5 Sonnet) |
| - | - | - | - |
| Seek audit | ~2K input + 1K output | $0.03 | $0.045 |
| Preview build (5 responses) | ~3K input + 2K output | $0.05 | $0.075 |
| Paid build (30 responses) | ~8K input + 6K output | $0.14 | $0.21 |
| Quality filter (30 responses) | ~10K input + 2K output | $0.12 | $0.18 |
| **Total per business (Tier 2)** |  | **~$0.34** | **~$0.51** |

*At 20 businesses per week: **~$7/week** in API costs. Negligible compared to revenue.*


### *The Bottom Line*

*The original sprint plan treated prompts as external artifacts. They are not — they are the **core production tool**. Adding prompt management to the platform means:*

- *Operators never leave the app*

- *Every output is versioned and auditable*

- *You can A/B test prompt versions (Template v1.2 vs v1.3) and measure conversion*

- *You can onboard new operators in minutes, not days*

- *The platform becomes the single source of truth for the entire workflow*


*End of Sprint Plan Document*

