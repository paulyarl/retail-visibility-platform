# Implementation Checklist — RETROFIT-GLOBAL-ACTIVATION-2026-01

**Initiative:** Global Expansion Activation  
**Status:** 🟡 In Progress  
**Last Updated:** January 21, 2026

---

## 0) Prep & Governance ✅

- [x] **Create branch** `feature/global-activation-2026` 
- [x] **Define REQ-2026-001..007** in Master Spec
- [ ] **Verify backups & replication** — ensure Supabase snapshots available
- [ ] **Review regional compliance requirements** (GDPR, LGPD, DPDP) with Legal
- [ ] **Enable test tenants** in each target region: US, MX, EU, SG
- [ ] **Confirm baseline telemetry** (latency, uptime, audit volume)
- [ ] **Prepare cost forecast** for multi-region Supabase and API usage
- [ ] **Governance sign-off** from steering committee

**Exit:** Governance sign-off and branch ready for regional activation.

---

## 1) Environment & Deployment Plan

- [ ] Define environment mapping for each rollout phase
  - [ ] **Staging**: All regions simulated (Supabase US, EU, SG)
  - [ ] **Pre-Prod**: LATAM & EU tenants only
  - [ ] **Production**: Full global tenants (post-validation)
- [ ] Assign region ownership to DevOps leads
- [ ] Validate data residency compliance per environment

**Exit:** Deployment matrix approved; routing paths documented.

---

## 2) Localization Activation (REQ-2026-004)

- [ ] Add locale packs: `en-US`, `es-MX`, `fr-FR`
  - [x] `en-US` (already exists)
  - [ ] `es-MX` (Spanish - Mexico)
  - [ ] `fr-FR` (French - France)
- [ ] Populate i18next translation maps (≥95% coverage)
- [ ] Enable feature flag `FF_I18N_SCAFFOLD` in staging (LATAM first)
- [ ] Verify UI switching per locale without regressions
- [ ] Add language selector to Tenant Settings (read-only until full release)
- [ ] Visual regression tests pass in each locale
- [ ] **Rollback Plan:** Disable flag, revert locale files to `en-US` default

**Validation:** Visual regression tests pass; default en-US behavior unchanged.

---

## 3) Multi-Region Supabase Clusters (REQ-2026-002)

- [ ] Deploy read replicas in EU-West and APAC-SG
  - [ ] EU-West read replica
  - [ ] APAC-SG read replica
- [ ] Implement region-aware routing middleware
- [ ] Add environment variables: `SUPABASE_REGION` and routing map in config
- [ ] Migrate 1 test tenant per region and validate latency (<300 ms variance)
  - [ ] US test tenant
  - [ ] EU test tenant
  - [ ] APAC test tenant
- [ ] Validate replication and audit log consistency
- [ ] **Rollback Plan:** Route traffic to US primary, disable multi-region read replicas

**Validation:** Queries resolve to correct regional DB; data consistency verified; rollback tested.

---

## 4) Currency API Live Sync (REQ-2026-003)

- [ ] Select currency API provider (ECB vs OpenExchange)
- [ ] Sign up for API account and get credentials
- [ ] Replace mock currency job with real provider integration
- [ ] Add daily cron job `/jobs/rates/live` secured with service token
- [ ] Validate stored rates accuracy and rounding precision
- [ ] Log sync latency and API health to metrics dashboard
- [ ] Confirm multi-currency display accuracy per region
- [ ] **Rollback Plan:** Revert to cached rate table; disable live sync job

**Validation:** 100% successful daily job runs; price formatting consistent across locales.

---

## 5) Compliance Registry & Data Policy (REQ-2026-001, REQ-2026-007)

- [ ] Create `compliance_registry` table migration
- [ ] Create `data_policy_acceptance_log` table migration
- [ ] Implement API endpoints for policy acceptance
- [ ] Create admin dashboard for compliance reporting
- [ ] Enable per-region policy prompts in UI (FF_COMPLIANCE_REGISTRY)
- [ ] Implement Legal review flow for policy text updates
- [ ] **Rollback Plan:** Disable policy prompts, retain existing data_policy_accepted flags

**Validation:** Audit shows 100% tenants with valid policy acceptance; registry aligned with regional laws.

---

## 6) Regional SLA & Latency Dashboard (REQ-2026-005)

- [ ] Extend existing Grafana/Datadog panels to show per-region latency
- [ ] Add error-rate alerts (threshold <1%)
- [ ] Add uptime SLA report (target ≥99.5%)
- [ ] Integrate with DevOps notification channels (Slack/PagerDuty)
- [ ] **Monitoring Validation:** Confirm dashboards reflect accurate region metrics

**Validation:** SLA dashboards populated with regional metrics; no alert noise under normal load.

---

## 7) Edge Routing Middleware (REQ-2026-006)

- [ ] Deploy routing layer (Cloudflare Workers or edge functions)
- [ ] Implement region detection logic
- [ ] Ensure fallback to US region on routing failure
- [ ] Test edge response times across all regions
- [ ] **Rollback Plan:** Force default routing to US; disable Workers configuration

**Validation:** Edge routing operational; fallback triggers correctly; P95 latency <300 ms.

---

## 8) Data Synchronization Validation (REQ-2026-007)

- [ ] Run automated replication checks comparing tenant, inventory, and audit_log across regions
- [ ] Validate no drift >0.5% between regions
- [ ] Add diff-report tool to monitor daily sync
- [ ] Configure drift alerts

**Validation:** Synchronization verified; drift alerts configured.

---

## 9) QA & Regression

- [ ] Conduct full end-to-end QA across all regions
- [ ] Validate translations, region routing, compliance prompts, and analytics
- [ ] Run performance/load tests simulating regional latency
- [ ] Verify all flags ON/OFF states
- [ ] Document test results

**Validation:** 100% pass rate in both flag states; load tests within latency thresholds.

---

## 10) Staged Regional Enablement & Stakeholder Checkpoints

### 🇺🇸 US (Week 13)
- [ ] Enable `FF_GLOBAL_TENANT_META=true`
- [ ] Validate baseline audit continuity
- [ ] Monitor metrics (latency, uptime, error rate)
- [ ] **QA Lead Sign-off:** ☐

**KPIs:**
- Baseline audit continuity: 100%
- Latency: <200ms
- Uptime: ≥99.5%
- Error rate: <0.5%

---

### 🇲🇽 LATAM (Week 14)
- [ ] Enable `FF_I18N_SCAFFOLD=true`
- [ ] Enable `FF_CURRENCY_LIVE_SYNC=true`
- [ ] Validate es-MX translations (≥95%)
- [ ] Validate currency rate sync
- [ ] **Product Lead Sign-off:** ☐

**KPIs:**
- Translation coverage: ≥95%
- Currency sync success: 100%
- Latency: <300ms
- Partner satisfaction: Positive

---

### 🇪🇺 EU (Week 15)
- [ ] Enable `FF_COMPLIANCE_REGISTRY=true`
- [ ] Enable `FF_MULTI_REGION_ROUTING=true`
- [ ] Validate GDPR compliance
- [ ] Test EU-West read replica routing
- [ ] **Legal Sign-off:** ☐

**KPIs:**
- GDPR compliance: 100%
- Latency: <250ms
- Replication lag: <5 seconds
- Data drift: <0.5%

---

### 🌏 APAC (Week 16)
- [ ] Enable `FF_EDGE_ROUTING=true`
- [ ] Validate APAC-SG read replica routing
- [ ] Test edge routing performance
- [ ] Validate DPDP compliance (India)
- [ ] **DevOps Sign-off:** ☐

**KPIs:**
- DPDP readiness: Validated
- Latency: <300ms
- Edge routing P95: <300ms
- Uptime: ≥99.5%

---

## 11) Risk, Mitigation & Cost Review

### Risks Tracked
- [ ] Multi-region DB drift → Automated replication checks + diff logs
- [ ] Currency API downtime → Fallback to cached rates for 24h
- [ ] Translation inconsistencies → Automated completeness tests + manual review
- [ ] Compliance policy lag → Quarterly review + versioned text approval
- [ ] Routing errors → Health checks + fallback routing
- [ ] Performance regressions → Load tests per region before enablement
- [ ] Supabase regional expansion → Budget check before replication

### Cost Review
- [ ] Monthly cost tracking dashboard created
- [ ] Budget vs. actual reviewed monthly
- [ ] Finance approval for any overruns

---

## 12) Communication, Documentation & Version Control

- [ ] Announce activation schedule internally
- [ ] Update runbook with global enablement steps
- [ ] Add regional SOPs for compliance and localization
- [ ] Version control policy texts, translations, and SOPs
- [ ] Update changelog: `v1.1-global-activation-2026-01`
- [ ] Create public blog post for launch announcement

**Exit:** Documentation and communication complete; all assets versioned.

---

## 13) Success Criteria & Monitoring

### Technical Success Criteria
- [ ] <300 ms latency variance across regions
- [ ] ≥95% translation coverage
- [ ] 100% tenants with compliance policy acceptance
- [ ] ≥99.5% uptime across all regions
- [ ] Zero data drift or loss after 7-day replication monitoring
- [ ] 100% successful currency rate syncs

### Business Success Criteria
- [ ] Positive partner feedback from LATAM/EU pilots
- [ ] Zero customer-reported regressions
- [ ] Cost within forecasted budget

### Monitoring
- [ ] Regional latency dashboard operational
- [ ] Error rate alerts configured
- [ ] Uptime SLA tracking active
- [ ] Currency sync health monitoring
- [ ] Replication drift alerts active

**Final Outcome:** Platform globally active, compliant, and performance-stable across all regions.

---

## 14) Git Hygiene & Commit Protocol

### Branching
- [x] Branch created: `feature/global-activation-2026`
- [ ] PRs created per module:
  - [ ] Localization Activation (REQ-2026-004)
  - [ ] Multi-Region Clusters + Routing (REQ-2026-002, 006)
  - [ ] Currency Sync (REQ-2026-003)
  - [ ] Compliance Registry (REQ-2026-001, 007)
  - [ ] SLA Dashboards & Monitoring (REQ-2026-005)
  - [ ] Ops + Docs + Communication Bundle

### Commit Convention
- [ ] All commits follow Conventional Commits format
- [ ] All commits include REQ ID references
- [ ] Commit bodies include Motivation, Implementation, Risk & Rollback, Testing

### PR Review
- [ ] 2 approvals required (PM + Module Owner)
- [ ] CI gates configured (lint, tests, smoke suite)
- [ ] Auto-deploy to staging upon merge

### Versioning
- [ ] Tag final release: `v1.1-global-activation-2026-01`
- [ ] Update `CHANGELOG.md` with region-by-region highlights
- [ ] Maintain REQ linkage in Master Spec

---

## 📊 Progress Summary

**Overall Progress:** 2/14 sections complete (14%)

| Section | Status | Progress |
|---------|--------|----------|
| 0) Prep & Governance | 🟡 In Progress | 2/8 |
| 1) Environment Plan | ⚪ Not Started | 0/3 |
| 2) Localization | ⚪ Not Started | 0/7 |
| 3) Multi-Region | ⚪ Not Started | 0/6 |
| 4) Currency Sync | ⚪ Not Started | 0/7 |
| 5) Compliance | ⚪ Not Started | 0/6 |
| 6) SLA Dashboard | ⚪ Not Started | 0/5 |
| 7) Edge Routing | ⚪ Not Started | 0/5 |
| 8) Data Sync | ⚪ Not Started | 0/4 |
| 9) QA & Regression | ⚪ Not Started | 0/5 |
| 10) Regional Enablement | ⚪ Not Started | 0/4 |
| 11) Risk & Cost | ⚪ Not Started | 0/9 |
| 12) Communication | ⚪ Not Started | 0/6 |
| 13) Success Criteria | ⚪ Not Started | 0/11 |
| 14) Git Hygiene | 🟡 In Progress | 1/9 |

---

**Next Milestone:** Complete Prep & Governance (Week 2)  
**Owner:** Engineering Lead  
**Last Updated:** January 21, 2026
