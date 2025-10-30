# 🧭 Retail Visibility Platform — v3.6 Retrofit Canvas
**Date:** 2025-10-29  
**Version:** v3.6-Retrofit‑Draft‑1  
**Editor:** Retail Spec & Outreach GPT  
**Purpose:** Bridge functional and architectural gaps between v3.5 implementation and v3.6-prelaunch target, ensuring controlled retrofitting without redundant rebuilds.

---

## 1️⃣ Overview
### Objective
To merge all validated gap closures (from v3.0–v3.5) with remaining retrofit actions identified in **Gap Check v3.6 Baseline**. The result ensures the platform meets full **security**, **tenant isolation**, **SEO**, and **governance** standards before pilot scaling.

### Scope
| Domain | Source | Target | Status |
|---------|---------|---------|---------|
| Multi-Tenant Routing & Context | v3.4–v3.5 | v3.6 Hybrid | Pending retrofit |
| AuthZ / Admin Audience | v3.3–v3.5 | v3.6 Secure Auth | In-progress |
| Business Profile + GBP Connect | v3.5 | v3.6 Full | Ready for merge |
| SWIS Schema & Feed Stack | v3.4 | v3.6 | Complete |
| CI/CD Governance + Audit | v3.5 | v3.6 | In-progress |
| Observability & Logs | v3.5 | v3.6 | Pending completion |

---

## 2️⃣ Gap Retrofit Matrix
| Domain | Gap Description | Retrofit Plan | Priority | Related REQ/ENH | Owner |
|--------|------------------|----------------|----------|------------------|--------|
| **Tenant Context & Routing** | Tenant context in localStorage; query param routing | Replace with SSR tenant resolver `/t/{tenant}` and URL‑based routing context provider | 🔴 Critical | REQ‑2025‑907 | Backend Lead |
| **Admin Audience & AuthZ** | Shared JWT audience; no step‑up | Distinct audience & 5‑min reauth for sensitive ops | 🔴 Critical | REQ‑2025‑906 | Security Eng |
| **CSRF Isolation** | Partial CSRF coverage | Add CSRF middleware; scope cookies to `app.` | 🔴 Critical | REQ‑2025‑905 | Security Eng |
| **Business Profile Wizard** | Incomplete save flow | Implement `/api/tenant/profile` + wizard submission | 🟡 Medium | REQ‑2026‑010 | API Dev |
| **Google Connect Suite** | Partial OAuth governance | Enforce token rotation, CI scan, rollback plan | 🟠 High | ENH‑2026‑044 | API Lead |
| **MapCard + SWIS Preview** | Feature not integrated | Add feature flags `FF_MAP_CARD`, `FF_SWIS_PREVIEW` and backend APIs | 🟠 High | ENH‑2026‑041 / 042 | Frontend Lead |
| **Cache Invalidation** | No event-driven ISR | Add revalidation via domain events (<60s) | 🟠 High | REQ‑2025‑908 | Platform Eng |
| **Accessibility (A11y)** | Partial keyboard/nav coverage | Enforce ARIA + WCAG 2.1 AA | 🟡 Medium | REQ‑2025‑910 | QA Lead |
| **Observability / Logs** | Basic Datadog; no structured audit logs | Structured logs + redaction + audit_log table | 🟠 High | GAP‑2025‑001 | SRE Lead |
| **CI/CD Drift Detection** | Schema guard incomplete | Add nightly prod snapshot drift diff | 🟠 High | GAP‑2025‑004 | DevOps |
| **Tier Governance & Billing Snapshot** | Manual updates only | Automate entitlements cache recompute | 🟡 Medium | REQ‑2025‑803 | Backend Lead |

---

## 3️⃣ Retrofit Implementation Blueprint
### A. Tenant Context & Routing (REQ‑2025‑907)
- Introduce SSR middleware for tenant resolution.
- Remove localStorage reliance; use signed tenant cookie.
- Central `tenant_context` provider in Next.js `_app.tsx`.

### B. AuthZ / Audience Separation (REQ‑2025‑906)
- Create `aud:admin` and `aud:user` in JWT payload.
- Add step‑up auth (OTP or reauth window) for sensitive endpoints.
- Audit log on elevation and expiry.

### C. Business Profile + GBP Connect (REQ‑2026‑010 + ENH‑2026‑044)
- Finalize `tenant_business_profile` schema and CRUD API.
- Merge Google Connect Suite v3 spec for OAuth governance.
- Enable Figma handoff for DS v2.1 compliance.

### D. SWIS Schema & Preview (ENH‑2026‑041/042)
- Fully implement `swis_feed_view` and `swis_feed_quality_report`.
- Integrate SWIS Preview widget and MapCard toggle.
- Maintain p95 render <300 ms and preview CTR ≥25%.

### E. CI/CD Governance & Audit (REQ‑2025‑804)
- Add commitlint enforcement (REQ/ENH ID mandatory).
- Schema diff job with `PROD_DB_SNAPSHOT_URL`.
- Nightly validation of migrations and audit trail export.

### F. Observability & RUM (GAP‑2025‑005)
- Weighted tenant sampling for RUM metrics.
- Dashboards for SWIS preview latency, feed success, OAuth errors.
- Error budget reports per tenant.

---

## 4️⃣ Dependency Register
| ID | Depends On | Enables | Relation |
|----|-------------|----------|-----------|
| REQ‑2025‑905 | Cookie policy enforcement | Secure session scope | Security dependency |
| REQ‑2025‑906 | JWT multi‑audience | Admin console access | Security + AuthZ |
| REQ‑2025‑907 | Tenant context | RLS enforcement, feed preview isolation | Core platform |
| REQ‑2026‑010 | Tenant business profile | GBP/MapCard features | UI + Schema |
| ENH‑2026‑041/042 | Business profile | Visibility/SEO modules | Feature extension |
| ENH‑2026‑044 | Google Connect Suite | OAuth integration | Integration layer |
| REQ‑2025‑803 | Tier Automation / IAP | Billing entitlements | Governance |

---

## 5️⃣ QA & Deployment Readiness
| Area | Validation | Metric | Status |
|-------|-------------|---------|---------|
| Security | CSRF + AuthZ tests | 100% protected write ops | ⚙️ In-progress |
| Schema | `swis_feed_view` + `tenant_business_profile` | Migration validated | ✅ Complete |
| Performance | SWIS p95 < 300 ms | A/B test pilot | 🧪 Testing |
| Observability | RUM, logs, audit exports | Weighted sample OK | ⚙️ Partial |
| Accessibility | WCAG 2.1 AA | Lighthouse ≥95 | 🧪 Testing |
| Governance | CI/CD policy export | SOC2 evidence ready | ⚙️ Pending |

---

## 6️⃣ Next Steps
1. **Merge** v3.6 retrofit patch into `main` with controlled rollout (flags enabled: `FF_MAP_CARD`, `FF_SWIS_PREVIEW`, `FF_GOOGLE_CONNECT_SUITE`).  
2. **Run QA Sweep** for tenant context, CSRF, and AuthZ integration tests.  
3. **Activate Observability Dashboards** — feed health, latency, and OAuth metrics.  
4. **Prepare Outreach Phase 2** — 20 pilot stores with GBP Connect and SWIS Preview enabled.  

---

### ✅ Deliverable
Once merged, this canvas becomes `retail_visibility_master_spec_v3.6-final.md`, closing all critical gaps from v3.5 and formalizing prelaunch readiness.

