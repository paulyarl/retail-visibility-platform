# Governance & Compliance Framework — RETROFIT-GLOBAL-ACTIVATION-2026-01

**Initiative:** Global Expansion Activation  
**Purpose:** Define governance structure, compliance requirements, and approval workflows  
**Status:** 🟡 Draft

---

## 🎯 Governance Structure

### Steering Committee
**Purpose:** Strategic oversight and final approval authority

**Members:**
- **Engineering Lead** (Chair) — Technical feasibility and architecture
- **Product Lead** — Feature scope and user experience
- **Legal Counsel** — Compliance and regulatory requirements
- **Finance Director** — Budget approval and cost oversight
- **DevOps Lead** — Infrastructure readiness and operations
- **QA Lead** — Testing strategy and quality assurance

**Meeting Cadence:**
- **Kickoff:** Week 1 (Governance sign-off)
- **Checkpoints:** Bi-weekly (Weeks 2, 4, 6, 8, 10, 12, 14, 16)
- **Final Review:** Week 16 (Launch approval)

**Decision Authority:**
- **Budget >$5K:** Requires Finance + Engineering approval
- **Legal/Compliance:** Requires Legal approval
- **Regional Enablement:** Requires module owner + QA approval
- **Production Deployment:** Requires 2/3 steering committee approval

---

## 📋 Compliance Requirements by Region

### 🇺🇸 United States
**Framework:** CCPA (California Consumer Privacy Act)

**Requirements:**
- [ ] Right to know what personal data is collected
- [ ] Right to delete personal data
- [ ] Right to opt-out of data sale (not applicable — we don't sell data)
- [ ] Privacy policy disclosure

**Implementation:**
- Data policy acceptance tracked in `Tenant.data_policy_accepted`
- Audit log for data access/deletion requests
- Privacy policy link in Tenant Settings

**Validation:**
- [ ] Privacy policy reviewed by Legal
- [ ] Data deletion workflow tested
- [ ] Audit log captures all data access

---

### 🇲🇽 🇧🇷 Latin America
**Framework:** LGPD (Brazil - Lei Geral de Proteção de Dados)

**Requirements:**
- [ ] Explicit consent for data processing
- [ ] Right to access, correct, and delete personal data
- [ ] Data processing purpose disclosure
- [ ] Data breach notification (72 hours)
- [ ] Data Protection Officer (DPO) designation

**Implementation:**
- Explicit consent prompt on first login (feature-flagged)
- Data policy acceptance log with timestamp
- DPO contact information in privacy policy
- Breach notification workflow (manual process)

**Validation:**
- [ ] Consent prompt tested in staging
- [ ] DPO designated and contact info published
- [ ] Breach notification workflow documented

---

### 🇪🇺 European Union
**Framework:** GDPR (General Data Protection Regulation)

**Requirements:**
- [ ] Lawful basis for data processing (consent or legitimate interest)
- [ ] Right to access, rectify, erase, restrict, and port data
- [ ] Data processing purpose limitation
- [ ] Data minimization (collect only necessary data)
- [ ] Data breach notification (72 hours to DPA)
- [ ] Data Protection Impact Assessment (DPIA) for high-risk processing
- [ ] Data Processing Agreement (DPA) with processors

**Implementation:**
- Explicit consent prompt for EU tenants
- Data subject access request (DSAR) workflow
- Data retention policy (auto-delete after 7 years)
- DPIA for audit log and compliance registry
- DPA with Supabase (already in place)

**Validation:**
- [ ] GDPR consent prompt tested
- [ ] DSAR workflow functional
- [ ] DPIA completed and approved by Legal
- [ ] DPA with Supabase verified

---

### 🇮🇳 India
**Framework:** DPDP (Digital Personal Data Protection Act, 2023)

**Requirements:**
- [ ] Consent for data processing
- [ ] Right to access, correct, erase, and nominate data
- [ ] Data localization (certain categories must stay in India)
- [ ] Data breach notification
- [ ] Data Fiduciary obligations

**Implementation:**
- Consent prompt for Indian tenants
- Data localization via APAC-SG read replica (Singapore as proxy)
- Data breach notification workflow
- Data Fiduciary designation (company entity)

**Validation:**
- [ ] Consent prompt tested
- [ ] Data localization verified (APAC-SG)
- [ ] Data Fiduciary designation documented

---

### 🇸🇬 Singapore
**Framework:** PDPA (Personal Data Protection Act)

**Requirements:**
- [ ] Consent for data collection
- [ ] Purpose limitation
- [ ] Data accuracy
- [ ] Data retention limitation
- [ ] Data breach notification

**Implementation:**
- Consent prompt for Singapore tenants
- Data retention policy (7 years)
- Data breach notification workflow

**Validation:**
- [ ] Consent prompt tested
- [ ] Data retention policy enforced

---

## 🔐 Data Classification & Handling

### Personal Identifiable Information (PII)
**Definition:** Data that can identify an individual

**Examples:**
- Tenant name
- User email
- User phone number
- IP address (in logs)

**Handling:**
- **Storage:** Encrypted at rest (Supabase default)
- **Transit:** TLS 1.3 encryption
- **Audit Log:** PII excluded (no name/email in audit entries)
- **Retention:** 7 years, then auto-delete
- **Access:** Role-based access control (RBAC)

---

### Sensitive Data
**Definition:** Data requiring extra protection

**Examples:**
- Payment information (not stored — Stripe handles)
- Health data (not applicable)
- Biometric data (not applicable)

**Handling:**
- Payment: Stripe PCI-DSS compliant (we don't store card numbers)
- No sensitive data categories currently in scope

---

### Non-Personal Data
**Definition:** Aggregated or anonymized data

**Examples:**
- Inventory counts
- Aggregate analytics
- Performance metrics

**Handling:**
- No special restrictions
- Can be used for analytics and reporting

---

## 📊 Compliance Registry Schema

### Table: `compliance_registry`
```sql
CREATE TABLE compliance_registry (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES "Tenant"(id),
  framework TEXT NOT NULL, -- 'GDPR', 'LGPD', 'DPDP', 'CCPA', 'PDPA'
  applicable BOOLEAN NOT NULL DEFAULT true,
  dpo_contact TEXT, -- Data Protection Officer contact
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  CONSTRAINT compliance_registry_tenant_framework_key UNIQUE (tenant_id, framework)
);

CREATE INDEX compliance_registry_tenant_id_idx ON compliance_registry (tenant_id);
```

### Table: `data_policy_acceptance_log`
```sql
CREATE TABLE data_policy_acceptance_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES "Tenant"(id),
  user_email TEXT NOT NULL,
  policy_version TEXT NOT NULL, -- e.g., 'v1.0-2026-01-21'
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX data_policy_acceptance_log_tenant_id_idx ON data_policy_acceptance_log (tenant_id, accepted_at DESC);
```

---

## 🔄 Approval Workflows

### 1. Budget Approval (>$5K)
**Trigger:** Cost forecast exceeds $5,000 annual

**Workflow:**
1. Engineering Lead prepares cost forecast
2. Finance Director reviews and approves/rejects
3. If approved, proceed to technical implementation
4. If rejected, revise scope or defer initiative

**Approval Criteria:**
- ROI justification
- Budget availability
- Cost-benefit analysis

---

### 2. Legal/Compliance Approval
**Trigger:** New compliance requirement or policy change

**Workflow:**
1. Engineering Lead identifies compliance requirement
2. Legal Counsel reviews applicable framework (GDPR, LGPD, etc.)
3. Legal drafts policy text or consent prompt
4. Engineering implements technical controls
5. Legal validates implementation
6. Legal approves for production

**Approval Criteria:**
- Compliance with regional laws
- Policy text accuracy
- Technical controls adequate

---

### 3. Regional Enablement Approval
**Trigger:** Ready to enable feature flags for a region

**Workflow:**
1. Module Owner completes implementation
2. QA Lead runs full regression test suite
3. Module Owner validates KPIs (latency, uptime, etc.)
4. Stakeholder (Product/Legal/DevOps) reviews
5. Stakeholder approves for production
6. DevOps enables feature flags

**Approval Criteria:**
- Zero regressions
- KPIs within thresholds
- Rollback plan tested

---

### 4. Production Deployment Approval
**Trigger:** Ready to deploy to production

**Workflow:**
1. Engineering Lead prepares deployment plan
2. QA Lead validates testing complete
3. DevOps Lead confirms infrastructure ready
4. 2/3 steering committee members approve
5. DevOps executes deployment
6. Engineering monitors for 24 hours

**Approval Criteria:**
- All tests passed
- Rollback plan documented
- Monitoring in place

---

## 📝 Policy Version Control

### Policy Versioning Scheme
**Format:** `v{major}.{minor}-{date}`

**Examples:**
- `v1.0-2026-01-21` — Initial global activation policy
- `v1.1-2026-03-15` — Updated GDPR consent text
- `v2.0-2026-06-01` — Major policy overhaul

### Policy Update Workflow
1. Legal drafts new policy text
2. Engineering reviews technical implications
3. Legal approves final text
4. Engineering updates policy version in database
5. Existing tenants prompted to re-accept (if material change)
6. New tenants see latest version

### Policy Storage
- **Location:** `docs/policies/` directory
- **Format:** Markdown files
- **Naming:** `privacy-policy-{version}.md`
- **Git:** Version controlled in repository

---

## 🔔 Breach Notification Workflow

### Trigger
Data breach or security incident affecting personal data

### Workflow
1. **Detection:** Incident detected (automated alert or manual report)
2. **Assessment:** Engineering Lead assesses severity and scope
3. **Notification (Internal):** Notify steering committee within 1 hour
4. **Investigation:** Engineering + DevOps investigate root cause
5. **Containment:** Stop breach and secure systems
6. **Notification (Regulatory):** Legal notifies DPA within 72 hours (GDPR/LGPD)
7. **Notification (Users):** Notify affected tenants within 72 hours
8. **Remediation:** Implement fixes and preventive measures
9. **Post-Mortem:** Document incident and lessons learned

### Notification Templates
- **Regulatory:** `docs/templates/breach-notification-dpa.md`
- **User:** `docs/templates/breach-notification-user.md`

---

## 📊 Compliance Monitoring

### Quarterly Compliance Review
**Owner:** Legal Counsel  
**Frequency:** Every 3 months

**Checklist:**
- [ ] Review policy text for accuracy
- [ ] Validate 100% tenants have policy acceptance
- [ ] Audit data retention compliance (7-year limit)
- [ ] Review breach notification workflow
- [ ] Update compliance registry for new tenants
- [ ] Validate DPO contact information current

### Annual Compliance Audit
**Owner:** Legal Counsel + External Auditor  
**Frequency:** Annually

**Scope:**
- Full GDPR/LGPD/DPDP compliance review
- Data processing inventory
- DPIA review and update
- DPA review with processors
- Security controls assessment
- Incident response testing

---

## ✅ Compliance Checklist (Pre-Launch)

### General
- [ ] Privacy policy drafted and approved by Legal
- [ ] Data retention policy defined (7 years)
- [ ] Data breach notification workflow documented
- [ ] DPO designated and contact info published
- [ ] Compliance registry tables created
- [ ] Data policy acceptance log functional

### GDPR (EU)
- [ ] GDPR consent prompt implemented
- [ ] DSAR workflow functional
- [ ] DPIA completed and approved
- [ ] DPA with Supabase verified
- [ ] Data minimization validated

### LGPD (Brazil)
- [ ] LGPD consent prompt implemented
- [ ] DPO contact info published
- [ ] Breach notification workflow tested

### DPDP (India)
- [ ] DPDP consent prompt implemented
- [ ] Data localization verified (APAC-SG)
- [ ] Data Fiduciary designation documented

### CCPA (US)
- [ ] Privacy policy disclosure added
- [ ] Data deletion workflow tested

### PDPA (Singapore)
- [ ] PDPA consent prompt implemented
- [ ] Data retention policy enforced

---

## 🏷️ Sign-off Record

| Stakeholder | Role | Date | Signature | Status |
|-------------|------|------|-----------|--------|
| Engineering Lead | Technical | | | ☐ Pending |
| Product Lead | UX/Features | | | ☐ Pending |
| Legal Counsel | Compliance | | | ☐ Pending |
| Finance Director | Budget | | | ☐ Pending |
| DevOps Lead | Infrastructure | | | ☐ Pending |
| QA Lead | Testing | | | ☐ Pending |

---

**Status:** 🟡 Draft  
**Next Review:** Week 2 (Governance Sign-off)  
**Owner:** Legal Counsel  
**Last Updated:** January 21, 2026
