# Implementation Roadmap — RETROFIT-GLOBAL-ACTIVATION-2026-01

**Initiative:** Global Expansion Activation  
**Timeline:** 16 weeks (Q1-Q2 2026)  
**Status:** 🟡 Planning

---

## 📅 Week-by-Week Breakdown

### Week 1-2: Foundation Validation & Governance
**Phase:** Prep & Governance  
**Owner:** Engineering Lead + Product Lead

**Tasks:**
- [ ] Create `feature/global-activation-2026` branch ✅
- [ ] Define REQ-2026-001 through REQ-2026-007 in Master Spec ✅
- [ ] Review RETROFIT-G-MVP-2025-01 foundation in production
- [ ] Verify Supabase snapshots and backup strategy
- [ ] Legal review: GDPR (EU), LGPD (Brazil), DPDP (India)
- [ ] Create test tenants: US, MX, EU, SG
- [ ] Baseline telemetry collection (latency, uptime, audit volume)
- [ ] Cost forecast and budget approval request
- [ ] Stakeholder kickoff meeting

**Deliverables:**
- Master Spec document (REQ-2026-001..007)
- Governance sign-off document
- Cost forecast spreadsheet
- Test tenant accounts in each region

**Exit Criteria:**
- ✅ All stakeholders signed off
- ✅ Budget approved
- ✅ Baseline metrics stable
- ✅ Legal compliance requirements documented

---

### Week 3-4: Localization Activation (REQ-2026-004)
**Phase:** Localization  
**Owner:** Frontend Lead + Product Lead

**Tasks:**
- [ ] Create `apps/web/src/locales/es-MX.json` (Spanish - Mexico)
- [ ] Create `apps/web/src/locales/fr-FR.json` (French - France)
- [ ] Populate translation maps (≥95% coverage)
- [ ] Update `i18n.ts` to include new locales
- [ ] Create language selector component
- [ ] Add language selector to Tenant Settings page
- [ ] Enable `FF_I18N_SCAFFOLD=true` in staging
- [ ] Visual regression testing (Playwright/Chromatic)
- [ ] Translation completeness automated tests
- [ ] User acceptance testing with LATAM partners

**Deliverables:**
- es-MX and fr-FR locale files
- Language selector UI component
- Visual regression test suite
- Translation coverage report (≥95%)

**Exit Criteria:**
- ✅ ≥95% translation coverage
- ✅ Zero visual regressions
- ✅ Language switching works without page reload
- ✅ Default en-US behavior unchanged

**PR:** `feat(i18n): enable multi-locale activation for LATAM (REQ-2026-004)`

---

### Week 5-6: Multi-Region Infrastructure Setup (REQ-2026-002)
**Phase:** Infrastructure  
**Owner:** DevOps Lead + Backend Lead

**Tasks:**
- [ ] Deploy Supabase read replica in EU-West
- [ ] Deploy Supabase read replica in APAC-SG
- [ ] Configure replication lag monitoring
- [ ] Create region routing middleware (`apps/api/src/routing.ts`)
- [ ] Add environment variables: `SUPABASE_REGION_MAP`
- [ ] Implement connection pooling per region
- [ ] Create region health check endpoint
- [ ] Migrate 1 test tenant to EU region
- [ ] Migrate 1 test tenant to APAC region
- [ ] Validate latency <300ms variance
- [ ] Test rollback to US primary

**Deliverables:**
- EU-West and APAC-SG read replicas operational
- Region routing middleware
- Connection pooling configuration
- Latency benchmark report

**Exit Criteria:**
- ✅ Read replicas deployed and healthy
- ✅ Latency variance <300ms
- ✅ Replication lag <5 seconds
- ✅ Rollback tested successfully

**PR:** `feat(db): deploy EU/APAC clusters and routing middleware (REQ-2026-002)`

---

### Week 7-8: Edge Routing & Replication Monitoring (REQ-2026-006, REQ-2026-007)
**Phase:** Infrastructure  
**Owner:** DevOps Lead

**Tasks:**
- [ ] Deploy Cloudflare Workers for edge routing
- [ ] Implement region detection logic (based on `tenant.region`)
- [ ] Configure fallback to US on routing failure
- [ ] Add edge response time monitoring
- [ ] Create replication monitoring script
- [ ] Implement diff-report tool for data consistency
- [ ] Set up daily automated replication checks
- [ ] Configure drift alerts (threshold >0.5%)
- [ ] Test edge routing across all regions
- [ ] Validate P95 latency <300ms

**Deliverables:**
- Cloudflare Workers deployment
- Replication monitoring dashboard
- Diff-report tool
- Edge routing performance report

**Exit Criteria:**
- ✅ Edge routing operational
- ✅ Fallback triggers correctly
- ✅ P95 latency <300ms
- ✅ Drift monitoring active

**PR:** `feat(edge): implement regional routing with fallback (REQ-2026-006, REQ-2026-007)`

---

### Week 9: Currency API Live Sync (REQ-2026-003)
**Phase:** Integration  
**Owner:** Backend Lead

**Tasks:**
- [ ] Select currency API provider (ECB vs OpenExchange)
- [ ] Sign up for API account and get credentials
- [ ] Replace mock job with live API integration
- [ ] Implement rate validation and rounding logic
- [ ] Add fallback to cached rates on API failure
- [ ] Configure daily cron job (Railway Cron or external)
- [ ] Add sync latency and health metrics
- [ ] Test multi-currency display accuracy
- [ ] Validate 100% successful syncs over 7 days
- [ ] Test rollback to cached rates

**Deliverables:**
- Live currency API integration
- Daily cron job configuration
- Rate validation logic
- Fallback mechanism

**Exit Criteria:**
- ✅ 100% successful daily syncs
- ✅ Rate accuracy validated
- ✅ Fallback tested
- ✅ Multi-currency display correct

**PR:** `feat(api): connect live currency rate job (REQ-2026-003)`

---

### Week 10: Compliance Registry (REQ-2026-001)
**Phase:** Compliance  
**Owner:** Backend Lead + Legal

**Tasks:**
- [ ] Create migration: `compliance_registry` table
- [ ] Create migration: `data_policy_acceptance_log` table
- [ ] Implement API endpoints for policy acceptance
- [ ] Create admin dashboard for compliance reporting
- [ ] Add per-region policy prompts in UI
- [ ] Implement legal review workflow for policy updates
- [ ] Enable `FF_COMPLIANCE_REGISTRY=true` in staging
- [ ] Validate 100% tenants with policy acceptance
- [ ] Legal review of policy text (GDPR, LGPD, DPDP)
- [ ] Test rollback (disable prompts, retain flags)

**Deliverables:**
- `compliance_registry` and `data_policy_acceptance_log` tables
- Policy acceptance API endpoints
- Admin compliance dashboard
- Per-region policy prompts UI

**Exit Criteria:**
- ✅ 100% tenants with valid policy acceptance
- ✅ Registry aligned with regional laws
- ✅ Legal approval obtained
- ✅ Rollback tested

**PR:** `feat(legal): activate compliance registry UI flow (REQ-2026-001)`

---

### Week 11-12: Regional SLA & Monitoring (REQ-2026-005)
**Phase:** Observability  
**Owner:** DevOps Lead

**Tasks:**
- [ ] Extend Grafana dashboard with per-region panels
- [ ] Add latency metrics by region
- [ ] Add error-rate metrics by region
- [ ] Configure uptime SLA report (target ≥99.5%)
- [ ] Set up error-rate alerts (threshold <1%)
- [ ] Integrate with Slack/PagerDuty notification channels
- [ ] Validate dashboards reflect accurate metrics
- [ ] Test alert thresholds under load
- [ ] Create SLA monitoring runbook
- [ ] Train DevOps team on regional monitoring

**Deliverables:**
- Extended Grafana dashboard
- Per-region latency and error-rate panels
- SLA uptime report
- Alert configurations

**Exit Criteria:**
- ✅ Dashboards operational
- ✅ Alerts configured and tested
- ✅ No alert noise under normal load
- ✅ SLA metrics accurate

**PR:** `feat(obs): expand SLA dashboards per region (REQ-2026-005)`

---

### Week 13: Regional Enablement — US (Baseline)
**Phase:** Regional Rollout  
**Owner:** QA Lead

**Region:** 🇺🇸 United States  
**Flags Enabled:** `FF_GLOBAL_TENANT_META=true`

**Tasks:**
- [ ] Enable `FF_GLOBAL_TENANT_META` in production (US tenants only)
- [ ] Validate audit log continuity
- [ ] Monitor baseline metrics (latency, uptime, error rate)
- [ ] Run full regression test suite
- [ ] Validate no customer-reported issues
- [ ] QA Lead sign-off

**Validation KPIs:**
- Baseline audit continuity: 100%
- Latency: <200ms (US region)
- Uptime: ≥99.5%
- Error rate: <0.5%

**Exit Criteria:**
- ✅ QA Lead approval
- ✅ Zero regressions
- ✅ Metrics stable

---

### Week 14: Regional Enablement — LATAM
**Phase:** Regional Rollout  
**Owner:** Product Lead

**Region:** 🇲🇽 Latin America (Mexico, Brazil)  
**Flags Enabled:** `+FF_I18N_SCAFFOLD`, `+FF_CURRENCY_LIVE_SYNC`

**Tasks:**
- [ ] Enable `FF_I18N_SCAFFOLD=true` for LATAM tenants
- [ ] Enable `FF_CURRENCY_LIVE_SYNC=true` for LATAM tenants
- [ ] Validate es-MX translations (≥95% coverage)
- [ ] Validate currency rate sync (MXN, BRL)
- [ ] Test language switching in production
- [ ] Monitor multi-currency display accuracy
- [ ] Partner feedback collection (LATAM)
- [ ] Product Lead sign-off

**Validation KPIs:**
- Translation coverage: ≥95%
- Currency sync success: 100%
- Latency: <300ms (LATAM region)
- Partner satisfaction: Positive

**Exit Criteria:**
- ✅ Product Lead approval
- ✅ Translations validated
- ✅ Currency sync operational

---

### Week 15: Regional Enablement — EU
**Phase:** Regional Rollout  
**Owner:** Legal + DevOps

**Region:** 🇪🇺 European Union  
**Flags Enabled:** `+FF_COMPLIANCE_REGISTRY`, `+FF_MULTI_REGION_ROUTING`

**Tasks:**
- [ ] Enable `FF_COMPLIANCE_REGISTRY=true` for EU tenants
- [ ] Enable `FF_MULTI_REGION_ROUTING=true` for EU tenants
- [ ] Validate GDPR compliance (data policy acceptance)
- [ ] Test EU-West read replica routing
- [ ] Validate fr-FR translations
- [ ] Monitor replication lag and data consistency
- [ ] Legal review of GDPR compliance
- [ ] Legal sign-off

**Validation KPIs:**
- GDPR compliance: 100%
- Latency: <250ms (EU region)
- Replication lag: <5 seconds
- Data drift: <0.5%

**Exit Criteria:**
- ✅ Legal approval
- ✅ GDPR validated
- ✅ Multi-region routing operational

---

### Week 16: Regional Enablement — APAC
**Phase:** Regional Rollout  
**Owner:** DevOps Lead

**Region:** 🌏 Asia-Pacific (Singapore, India)  
**Flags Enabled:** `+FF_EDGE_ROUTING`

**Tasks:**
- [ ] Enable `FF_EDGE_ROUTING=true` for APAC tenants
- [ ] Validate APAC-SG read replica routing
- [ ] Test edge routing performance
- [ ] Validate DPDP compliance (India)
- [ ] Monitor latency and uptime
- [ ] Test fallback to US on routing failure
- [ ] DevOps sign-off

**Validation KPIs:**
- DPDP readiness: Validated
- Latency: <300ms (APAC region)
- Edge routing P95: <300ms
- Uptime: ≥99.5%

**Exit Criteria:**
- ✅ DevOps approval
- ✅ Edge routing operational
- ✅ DPDP validated

---

## 🎯 Final Validation (Post-Week 16)

### Success Criteria Checklist
- [ ] <300ms latency variance across all regions
- [ ] ≥95% translation coverage (es-MX, fr-FR)
- [ ] 100% tenants with compliance policy acceptance
- [ ] ≥99.5% uptime across all regions
- [ ] Zero data drift or loss after 7-day monitoring
- [ ] 100% successful currency rate syncs
- [ ] Positive partner feedback from LATAM/EU pilots
- [ ] Zero customer-reported regressions
- [ ] Cost within forecasted budget

### Final Sign-offs
- [ ] Engineering Lead
- [ ] Product Lead
- [ ] Legal
- [ ] Finance
- [ ] DevOps Lead
- [ ] QA Lead

---

## 📊 Milestone Tracking

| Milestone | Week | Status | Owner | Exit Criteria |
|-----------|------|--------|-------|---------------|
| Governance Sign-off | 2 | 🟡 Pending | Engineering Lead | Budget + Legal approval |
| Localization Complete | 4 | 🟡 Pending | Frontend Lead | ≥95% translation coverage |
| Multi-Region Infra | 6 | 🟡 Pending | DevOps Lead | <300ms latency variance |
| Edge Routing Live | 8 | 🟡 Pending | DevOps Lead | P95 <300ms |
| Currency Sync Live | 9 | 🟡 Pending | Backend Lead | 100% successful syncs |
| Compliance Registry | 10 | 🟡 Pending | Legal | 100% policy acceptance |
| SLA Monitoring | 12 | 🟡 Pending | DevOps Lead | Dashboards operational |
| US Enablement | 13 | 🟡 Pending | QA Lead | Zero regressions |
| LATAM Enablement | 14 | 🟡 Pending | Product Lead | Positive feedback |
| EU Enablement | 15 | 🟡 Pending | Legal | GDPR validated |
| APAC Enablement | 16 | 🟡 Pending | DevOps Lead | Edge routing live |
| **Final Release** | **16** | **🟡 Pending** | **All** | **All criteria met** |

---

## 🚨 Risk Mitigation Timeline

| Week | Risk | Mitigation Action | Owner |
|------|------|-------------------|-------|
| 1-2 | Budget not approved | Present ROI analysis to Finance | Engineering Lead |
| 3-4 | Translation delays | Engage professional translation service | Product Lead |
| 5-6 | Supabase replication issues | Test rollback to US primary | DevOps Lead |
| 7-8 | Edge routing errors | Implement health checks + fallback | DevOps Lead |
| 9 | Currency API downtime | 24h cached fallback mechanism | Backend Lead |
| 10 | Legal compliance gaps | Quarterly legal review process | Legal |
| 11-12 | Alert noise | Tune thresholds under load testing | DevOps Lead |
| 13-16 | Regional performance regressions | Load tests per region before enablement | QA Lead |

---

## 📝 Communication Plan

### Weekly Updates
**Audience:** Engineering team  
**Format:** Slack #global-activation channel  
**Content:** Progress, blockers, next week's goals

### Bi-weekly Checkpoints
**Audience:** Stakeholders (Product, Legal, Finance, DevOps)  
**Format:** 30-min video call  
**Content:** KPIs, risks, budget tracking

### Monthly Executive Review
**Audience:** Executive team  
**Format:** Written report + optional presentation  
**Content:** Timeline, budget, major milestones

### Launch Announcements
- **Week 4:** Localization activated (internal)
- **Week 8:** Multi-region infrastructure live (internal)
- **Week 12:** SLA monitoring operational (internal)
- **Week 16:** Global activation complete (public blog post)

---

## 🏷️ Version Control & Git Hygiene

### Branch Strategy
- **Feature branch:** `feature/global-activation-2026`
- **PR per module:** Localization, Multi-Region, Currency, Compliance, Monitoring
- **Merge to:** `spec-sync` → `main`

### Commit Convention
```
feat(i18n): add es-MX locale pack (REQ-2026-004)
feat(db): deploy EU/APAC read replicas (REQ-2026-002)
feat(api): integrate live currency sync (REQ-2026-003)
feat(legal): activate compliance registry (REQ-2026-001)
feat(obs): expand regional SLA dashboards (REQ-2026-005)
feat(edge): implement regional routing (REQ-2026-006)
chore(docs): update runbook with regional procedures
```

### PR Review Requirements
- **2 approvals:** PM + Module Owner
- **CI gates:** Conventional commit lint, unit tests, integration tests
- **Auto-deploy:** Staging upon PR merge

---

**Status:** 🟡 Planning Phase  
**Next Milestone:** Governance Sign-off (Week 2)  
**Last Updated:** January 21, 2026
