# 🧭 Retail Visibility Platform — Vendor Onboarding Plan (MVP, Retrofit v1.2)

**Version:** v1.2 (Retrofit Update)  
**Date:** October 2025  
**Owner:** Retail Spec & Outreach GPT  
**Scope:** Revised vendor onboarding plan for MVP pilot rollout, addressing operational, data quality, and dependency gaps identified during critique review.

---

## 🎯 Objectives
- Onboard 10–15 pilot retailers within 30 days.
- Ensure each store uploads 20–50 SKUs with >95% data validity.
- Connect ≥3 stores to Google Merchant Center (OAuth2 flow verified).
- Capture feedback, satisfaction (NPS ≥7), and support response time (<24h).
- Validate end-to-end data quality and sync reliability before expansion.

---

## 🧩 Onboarding Stages with Resource Mapping

| Stage | Duration | Description | Roles / Capacity | Output |
|--------|-----------|--------------|------------------|---------|
| **1. Pre-Qualification** | Days 1–3 | Identify pilot-ready stores via chamber partners or field outreach. | Outreach Lead (1), Field Rep (1) | 10–15 qualified stores |
| **2. Account Setup** | Days 3–6 | Create tenant accounts, issue onboarding invites, configure Supabase Auth. | Tech Admin (1), Support (1) | Active tenant dashboard access |
| **3. Data Collection** | Days 6–10 | Assist vendors with inventory upload (20–50 SKUs) using CSV template. | Vendor + Support (2) | Store inventory live in platform |
| **4. Google Connect** | Days 10–15 | Guide OAuth2 consent flow; verify Merchant Center link. | Vendor + Tech (1) | Tokens stored, feed ready |
| **5. Feed Validation** | Days 15–18 | Run first sync; validate feed approval status. | Admin (1) | Feed verified per store |
| **6. Analytics Activation** | Days 18–24 | Fetch metrics (impressions/clicks); enable charts. | DevOps (1) | Metrics visible per tenant |
| **7. Feedback & QA Review** | Days 24–30 | Conduct usability survey + NPS check; confirm deliverable quality gate. | Outreach (1), QA (1) | Pilot insights & validation report |

---

## ✅ Enhanced Onboarding Checklist (Per Store)
| Task | Responsible | Status | Validation Rule |
|------|--------------|---------|------------------|
| Store qualified & contact confirmed | Outreach Lead | ☐ | Signed consent + verified contact info |
| Tenant account created | Tech Admin | ☐ | Tenant ID exists, auth verified |
| Inventory CSV uploaded | Vendor / Support | ☐ | ≥20 SKUs, schema passes validation |
| Photos reviewed & optimized | Media Support | ☐ | All files <1MB, format = WebP/JPEG |
| Google OAuth connected | Vendor / Tech | ☐ | Valid refresh token stored in Vault |
| Feed verified in Merchant Center | Admin | ☐ | Approval rate ≥90% |
| Analytics data visible | Platform | ☐ | ≥1 impression/click logged |
| Feedback form submitted | Vendor | ☐ | NPS recorded |

---

## 📦 CSV Template (Revised with Validation Rules)
```csv
sku,name,price,stock,category,brand,image_url,description
SKU-001,Organic Apples,2.99,50,Produce,GreenValley,photos/apple.webp,Fresh local apples
SKU-002,Whole Milk 1L,3.49,40,Dairy,FarmFresh,photos/milk.jpeg,1L whole milk bottle
```
**Validation Rules:**
- SKU unique per tenant.
- Price > 0 and ≤ 999.99.
- Stock ≥ 0.
- Image format = WebP or JPEG.
- Required fields: `name`, `price`, `stock`, `image_url`.

---

## 📸 Photo Guidelines (Expanded)
| Requirement | Details |
|--------------|----------|
| **Lighting** | Natural or bright light, avoid glare |
| **Background** | Clean background preferred |
| **Resolution** | 800x800px min, <1MB |
| **File Types** | WebP (preferred), JPEG fallback |
| **Labeling** | Match filenames to SKUs |
| **Upload Method** | Via dashboard or mobile capture |

---

## 🧮 Pilot Tracking Dashboard Layout (Role-Based)
**Views by Role:**
- **Admin:** Full access — can edit feed status, approve data, review analytics.
- **Support:** View-only analytics + upload status; cannot edit feed.
- **Vendor:** Own store only — dashboard metrics and sync summary.

**Components:**
- **Store Table:** Store Name | SKUs | Feed Status | Google Connected? | Analytics Active? | Feedback Received
- **Metrics Summary:** KPI cards (Stores Live, Feed Success %, Avg CTR, NPS)
- **Alerts:** Token expiry, feed errors >5%, unverified uploads
- **Validation Gate:** All pilot deliverables marked complete before closure

---

## ⚠️ Risk & Contingency Plan
| Risk | Impact | Mitigation |
|------|---------|-------------|
| Google API change or quota issue | Feed sync disruption | Use mock adapters + daily API monitoring; prepare SWIS fallback feed |
| Low digital literacy | Slower onboarding | Assisted setup + visual guides |
| Incomplete or invalid data | Feed rejection | Real-time validation + CSV checker tool |
| Token expiry | Lost sync | Automated refresh + alerts |
| Schedule slippage | Pilot delay | Staggered parallel onboarding batches |

---

## 📘 Deliverables by Day 30 (Revised)
- ≥10 pilot stores active on MVP.
- ≥3 connected to Google Merchant Center.
- ≥1,000 SKUs total, 95% approval rate.
- Average feed latency <2 min.
- Pilot report with NPS, data quality, and feed accuracy metrics.

**Quality Gate Criteria:**
- All stores pass data validation + feed verification.
- Feedback completion ≥80%.
- API health uptime ≥99%.

---

**Next Step:**
Distribute updated checklist and templates to outreach leads. Conduct QA review of Merchant Center linkage and initiate feedback form deployment for live pilot stores.

