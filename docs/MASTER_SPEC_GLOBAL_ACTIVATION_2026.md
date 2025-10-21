# Master Spec — RETROFIT-GLOBAL-ACTIVATION-2026-01

**Initiative:** Global Expansion Activation  
**Phase:** 2 (Activation of RETROFIT-G-MVP-2025-01 scaffolds)  
**Status:** 🟡 Planning  
**Start Date:** January 21, 2026  
**Target Completion:** Q2 2026

---

## 🎯 Executive Summary

**Objective:** Activate global readiness scaffolds from RETROFIT-G-MVP-2025-01 to enable multi-region, multilingual, and compliance features in controlled phases.

**Approach:** Feature-flagged rollout with progressive activation by region (US → LATAM → EU → APAC), ensuring zero disruption to active tenants.

**Dependencies:** 
- RETROFIT-G-MVP-2025-01 (REQ-2025-901 through REQ-2025-905) ✅ Complete
- Supabase multi-region support
- Legal compliance review (GDPR, LGPD, DPDP)
- Currency API provider selection

---

## 📋 Requirements

### REQ-2026-001: Compliance Registry & Data Policy Framework
**Status:** 🟡 Pending  
**Priority:** Critical  
**Dependencies:** REQ-2025-901 (Tenant.data_policy_accepted)

**Description:**
Create compliance registry system mapping tenants to applicable legal frameworks (GDPR, LGPD, DPDP) with timestamped consent tracking.

**Acceptance Criteria:**
- [ ] `compliance_registry` table created with tenant-to-framework mapping
- [ ] `data_policy_acceptance_log` table for timestamped consent records
- [ ] Per-region policy prompts in UI (feature-flagged)
- [ ] Legal review workflow for policy text updates
- [ ] 100% tenants with valid policy acceptance in audit
- [ ] Registry aligned with regional laws

**Technical Scope:**
- Database migration for compliance tables
- API endpoints for policy acceptance
- UI components for policy prompts
- Admin dashboard for compliance reporting

**Rollback Plan:**
- Disable policy prompts via feature flag
- Retain existing `data_policy_accepted` flags
- Archive compliance_registry data

**Feature Flag:** `FF_COMPLIANCE_REGISTRY=false` (default OFF)

---

### REQ-2026-002: Multi-Region Supabase Clusters
**Status:** 🟡 Pending  
**Priority:** Critical  
**Dependencies:** REQ-2025-901 (Tenant.region)

**Description:**
Deploy read replicas in EU-West and APAC-SG with region-aware routing middleware for <300ms latency variance.

**Acceptance Criteria:**
- [ ] Read replicas deployed in EU-West and APAC-SG
- [ ] Region-aware routing middleware implemented
- [ ] Environment variables: `SUPABASE_REGION` and routing map
- [ ] 1 test tenant per region migrated and validated
- [ ] Latency variance <300ms across regions
- [ ] Replication and audit log consistency verified
- [ ] Rollback tested (route to US primary)

**Technical Scope:**
- Supabase regional cluster setup
- Routing middleware in API layer
- Connection pooling per region
- Replication monitoring

**Rollback Plan:**
- Route all traffic to US primary
- Disable multi-region read replicas
- Maintain single-region operation

**Feature Flag:** `FF_MULTI_REGION_ROUTING=false` (default OFF)

**Cost Impact:** High (Supabase regional expansion)

---

### REQ-2026-003: Currency API Live Sync
**Status:** 🟡 Pending  
**Priority:** High  
**Dependencies:** REQ-2025-905 (Currency-rate stub), REQ-2025-901 (Tenant.currency)

**Description:**
Replace mock currency job with real provider (ECB/OpenExchange) for daily live rate synchronization.

**Acceptance Criteria:**
- [ ] Real currency provider integrated (ECB or OpenExchange)
- [ ] Daily cron job `/jobs/rates/live` secured with service token
- [ ] Stored rates accuracy and rounding precision validated
- [ ] Sync latency and API health logged to metrics dashboard
- [ ] Multi-currency display accuracy per region confirmed
- [ ] 100% successful daily job runs over 7-day period
- [ ] Rollback to cached rate table tested

**Technical Scope:**
- Currency API integration (ECB/OpenExchange)
- Cron job scheduler (Railway Cron or external)
- Rate validation and precision logic
- Fallback to cached rates on API failure

**Rollback Plan:**
- Revert to cached rate table
- Disable live sync job via feature flag
- Use last-known-good rates

**Feature Flag:** `FF_CURRENCY_LIVE_SYNC=false` (default OFF)

**Cost Impact:** Low (API usage within free tier)

---

### REQ-2026-004: Localization Activation
**Status:** 🟡 Pending  
**Priority:** High  
**Dependencies:** REQ-2025-903 (FE i18n Scaffold), REQ-2025-901 (Tenant.language)

**Description:**
Activate i18n scaffolding with locale packs for en-US, es-MX, fr-FR with ≥95% translation coverage.

**Acceptance Criteria:**
- [ ] Locale packs added: `en-US`, `es-MX`, `fr-FR`
- [ ] i18next translation maps populated (≥95% coverage)
- [ ] Feature flag `FF_I18N_SCAFFOLD` enabled in staging (LATAM first)
- [ ] UI switching per locale without regressions verified
- [ ] Language selector added to Tenant Settings
- [ ] Visual regression tests pass in each locale
- [ ] Default en-US behavior unchanged

**Technical Scope:**
- Translation files for es-MX and fr-FR
- Language selector UI component
- Locale detection and persistence
- Translation completeness tests

**Rollback Plan:**
- Disable `FF_I18N_SCAFFOLD` flag
- Revert locale files to en-US default
- Remove language selector UI

**Feature Flag:** `FF_I18N_SCAFFOLD=false` (currently OFF, will enable)

**Cost Impact:** Low (translation services)

---

### REQ-2026-005: Regional SLA & Latency Dashboard
**Status:** 🟡 Pending  
**Priority:** Medium  
**Dependencies:** REQ-2025-904 (Observability tags)

**Description:**
Extend observability dashboards to show per-region latency, error rates, and uptime SLA (target ≥99.5%).

**Acceptance Criteria:**
- [ ] Grafana/Datadog panels show per-region latency
- [ ] Error-rate alerts configured (threshold <1%)
- [ ] Uptime SLA report (target ≥99.5%)
- [ ] DevOps notification channels integrated
- [ ] Dashboards reflect accurate region metrics
- [ ] No alert noise under normal load

**Technical Scope:**
- Extend existing Grafana dashboard
- Add per-region metrics collection
- Configure alert thresholds
- Integrate with Slack/PagerDuty

**Rollback Plan:**
- Revert to single-region dashboard
- Disable regional alerts

**Feature Flag:** N/A (observability always-on)

**Cost Impact:** Low (existing APM infrastructure)

---

### REQ-2026-006: Edge Routing Middleware
**Status:** 🟡 Pending  
**Priority:** Medium  
**Dependencies:** REQ-2026-002 (Multi-region clusters)

**Description:**
Deploy routing layer (Cloudflare Workers or edge functions) with region detection and fallback to US on failure.

**Acceptance Criteria:**
- [ ] Routing layer deployed (Cloudflare Workers or edge functions)
- [ ] Region detection based on tenant.region
- [ ] Fallback to US region on routing failure
- [ ] Edge response times tested across all regions
- [ ] P95 latency <300ms
- [ ] Rollback tested (force default routing to US)

**Technical Scope:**
- Cloudflare Workers or Vercel Edge Functions
- Region detection logic
- Fallback routing
- Health checks

**Rollback Plan:**
- Force default routing to US
- Disable Workers configuration

**Feature Flag:** `FF_EDGE_ROUTING=false` (default OFF)

**Cost Impact:** Low (Cloudflare Workers free tier)

---

### REQ-2026-007: Data Synchronization Validation
**Status:** 🟡 Pending  
**Priority:** High  
**Dependencies:** REQ-2026-002 (Multi-region clusters), REQ-2025-902 (Audit log)

**Description:**
Automated replication checks comparing tenant, inventory, and audit_log across regions with <0.5% drift tolerance.

**Acceptance Criteria:**
- [ ] Automated replication checks running daily
- [ ] Tenant, inventory, and audit_log compared across regions
- [ ] Drift <0.5% between regions
- [ ] Diff-report tool monitors daily sync
- [ ] Alerts configured for drift >0.5%
- [ ] Zero data loss after 7-day monitoring period

**Technical Scope:**
- Replication monitoring script
- Diff-report tool
- Drift detection alerts
- Data consistency validation

**Rollback Plan:**
- Disable replication checks
- Manual validation on-demand

**Feature Flag:** N/A (monitoring always-on)

**Cost Impact:** Low (monitoring infrastructure)

---

## 📊 Dependency Map

```
REQ-2025-901 (Tenant Metadata) ──┬──> REQ-2026-001 (Compliance Registry)
                                 ├──> REQ-2026-002 (Multi-Region Clusters)
                                 └──> REQ-2026-004 (Localization Activation)

REQ-2025-902 (Audit Log) ────────┬──> REQ-2026-001 (Compliance Registry)
                                 └──> REQ-2026-007 (Data Sync Validation)

REQ-2025-903 (FE i18n Scaffold) ─────> REQ-2026-004 (Localization Activation)

REQ-2025-904 (Observability) ────────> REQ-2026-005 (Regional SLA Dashboard)

REQ-2025-905 (Currency Stub) ────────> REQ-2026-003 (Currency Live Sync)

REQ-2026-002 (Multi-Region) ─────┬──> REQ-2026-006 (Edge Routing)
                                 └──> REQ-2026-007 (Data Sync Validation)
```

---

## 🚀 Phased Rollout Plan

### Phase 1: Foundation Validation (Week 1-2)
- [ ] Validate RETROFIT-G-MVP-2025-01 scaffolds in production
- [ ] Confirm all feature flags OFF and stable
- [ ] Review baseline telemetry (latency, uptime, audit volume)
- [ ] Legal review of regional compliance requirements
- [ ] Cost forecast for multi-region expansion

**Exit Criteria:** Governance sign-off, baseline metrics stable

---

### Phase 2: Localization Activation (Week 3-4)
- [ ] REQ-2026-004: Add es-MX and fr-FR locale packs
- [ ] Enable `FF_I18N_SCAFFOLD` in staging (LATAM tenants)
- [ ] Visual regression testing in all locales
- [ ] Language selector UI in Tenant Settings

**Exit Criteria:** ≥95% translation coverage, zero regressions

---

### Phase 3: Multi-Region Infrastructure (Week 5-8)
- [ ] REQ-2026-002: Deploy EU-West and APAC-SG read replicas
- [ ] REQ-2026-006: Implement edge routing middleware
- [ ] REQ-2026-007: Set up replication monitoring
- [ ] Migrate 1 test tenant per region

**Exit Criteria:** <300ms latency variance, <0.5% drift

---

### Phase 4: Currency & Compliance (Week 9-10)
- [ ] REQ-2026-003: Integrate live currency API
- [ ] REQ-2026-001: Deploy compliance registry
- [ ] Enable per-region policy prompts

**Exit Criteria:** 100% successful rate syncs, legal approval

---

### Phase 5: Monitoring & SLA (Week 11-12)
- [ ] REQ-2026-005: Extend regional dashboards
- [ ] Configure alerts and notification channels
- [ ] Validate SLA metrics across all regions

**Exit Criteria:** ≥99.5% uptime, dashboards operational

---

### Phase 6: Regional Enablement (Week 13-16)
| Region | Week | Flags Enabled | Validation KPIs | Stakeholder |
|--------|------|---------------|-----------------|-------------|
| 🇺🇸 US | 13 | FF_GLOBAL_TENANT_META | Baseline audit continuity | QA Lead |
| 🇲🇽 LATAM | 14 | +FF_I18N_SCAFFOLD + FF_CURRENCY_LIVE_SYNC | 95% translation + rate sync | Product Lead |
| 🇪🇺 EU | 15 | +FF_COMPLIANCE_REGISTRY + FF_MULTI_REGION_ROUTING | GDPR validation | Legal |
| 🌏 APAC | 16 | +FF_EDGE_ROUTING | DPDP readiness | DevOps |

**Exit Criteria:** All regions validated, formal sign-offs

---

## 🎯 Success Criteria

### Technical
- [ ] <300ms latency variance across regions
- [ ] ≥95% translation coverage (es-MX, fr-FR)
- [ ] 100% tenants with compliance policy acceptance
- [ ] ≥99.5% uptime across all regions
- [ ] Zero data drift or loss after 7-day monitoring
- [ ] 100% successful currency rate syncs

### Business
- [ ] Positive partner feedback from LATAM/EU pilots
- [ ] Zero customer-reported regressions
- [ ] Legal compliance validated in all regions
- [ ] Cost within forecasted budget

### Operational
- [ ] All runbooks updated with regional procedures
- [ ] DevOps trained on multi-region operations
- [ ] Incident response playbooks tested
- [ ] Rollback procedures validated

---

## 💰 Cost Forecast

| Item | Monthly Cost | Annual Cost | Notes |
|------|--------------|-------------|-------|
| Supabase EU-West Replica | $150 | $1,800 | Read replica |
| Supabase APAC-SG Replica | $150 | $1,800 | Read replica |
| Currency API (OpenExchange) | $29 | $348 | Unlimited plan |
| Cloudflare Workers | $5 | $60 | Within free tier |
| Translation Services | $500 | $500 | One-time |
| APM/Monitoring | $50 | $600 | Existing + regional |
| **Total** | **$384** | **$5,108** | Ongoing + one-time |

**Budget Approval Required:** Yes (>$5K annual)

---

## 🔄 Risk Assessment

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| Multi-region DB drift | Medium | High | Automated replication checks + alerts | DevOps |
| Currency API downtime | Low | Medium | 24h cached fallback | Backend |
| Translation inconsistencies | Medium | Low | Automated completeness tests | Product |
| Compliance policy lag | Low | High | Quarterly legal review | Legal |
| Routing errors | Low | Medium | Health checks + US fallback | DevOps |
| Performance regressions | Medium | High | Load tests per region | QA |
| Cost overruns | Low | Medium | Monthly budget review | Finance |

---

## 📝 Governance & Approvals

### Required Sign-offs
- [ ] **Engineering Lead:** Technical feasibility
- [ ] **Product Lead:** Feature scope and UX
- [ ] **Legal:** Compliance framework
- [ ] **Finance:** Budget approval
- [ ] **DevOps:** Infrastructure readiness
- [ ] **QA Lead:** Testing strategy

### Review Cadence
- **Weekly:** Engineering standup (progress, blockers)
- **Bi-weekly:** Stakeholder checkpoint (KPIs, risks)
- **Monthly:** Executive review (budget, timeline)

---

## 📚 Documentation Requirements

### Technical Docs
- [ ] Multi-region architecture diagram
- [ ] Routing logic flowchart
- [ ] Replication monitoring guide
- [ ] Currency API integration spec
- [ ] Compliance registry schema

### Operational Docs
- [ ] Regional deployment runbook
- [ ] Incident response playbook
- [ ] Rollback procedures per region
- [ ] SLA monitoring guide
- [ ] Cost tracking dashboard

### User-Facing Docs
- [ ] Language selector user guide
- [ ] Regional data policy (GDPR, LGPD, DPDP)
- [ ] Multi-currency pricing FAQ
- [ ] Regional support contacts

---

## 🏷️ Version Control

**Release Tag:** `v1.1-global-activation-2026-01`  
**Branch:** `feature/global-activation-2026`  
**Changelog:** `docs/CHANGELOG_GLOBAL_ACTIVATION_2026.md`

---

**Status:** 🟡 Planning Phase  
**Next Milestone:** Governance Sign-off (Week 1)  
**Owner:** Engineering Lead  
**Last Updated:** January 21, 2026
