# Retail Visibility Platform — Full Specification (v1.0–v2.4)

**Author:** Paul Yarl  
**Date:** October 18, 2025  
**Tagline:** "Helping small retailers stay visible in the digital age."  

---

## Overview
This document merges all specifications from **v1.0 through v2.4**, combining functional, technical, business, and strategic requirements into one production-ready blueprint. It represents the complete architecture and rollout plan for the Retail Visibility Platform — a SaaS + service ecosystem enabling local retailers to digitize inventory visibility and integrate with discovery tools like Google Maps and Search.

---

# v1.0 — Core Functional Requirements

### Objective
Enable small local retailers to capture, manage, and publish their in-store inventory through a simple, multi-platform interface.

### Functional Scope
| Module | Function | Description |
|---------|-----------|--------------|
| **Inventory Management** | CRUD items | Add/edit/remove SKUs, product photos, and details. |
| **Photo Capture** | Camera or upload | Capture inventory photos from desktop or mobile. |
| **Offline Mode** | Local persistence | Operate without internet, sync when online. |
| **Customer View** | Web browser UI | Public storefront showing live availability. |
| **Admin Dashboard** | Store control center | Manage inventory, pricing, and analytics. |

### Platforms
- **Retailer Admin:** Browser + desktop app (Electron / .NET MAUI).
- **Customer Portal:** Web app (mobile-first responsive).  
- **Database:** SQLite local cache + PostgreSQL cloud master.

---

# v1.1 — System Architecture

### Architecture Overview
**Type:** Multi-tier, event-driven microservice architecture.

**Layers:**
1. **Frontend UI:** React + Next.js.  
2. **Backend API:** Node.js + Express (REST + GraphQL endpoints).  
3. **Data Layer:** PostgreSQL + Supabase for managed hosting.  
4. **Offline Layer:** SQLite with delta-sync jobs.  
5. **Storage Layer:** Cloud CDN for media (Supabase Storage / AWS S3).

### Integration Points
- Google Business Profile & Merchant Center APIs.
- Stripe Billing for subscriptions.
- Supabase Auth for multi-user identity.
- Redis (optional) for caching and rate limiting.

---

# v1.2 — Data Model & Database Schema

### Core Entities
| Entity | Description |
|---------|-------------|
| **Tenant** | Represents a retailer; isolated namespace. |
| **User** | Belongs to a tenant; has roles and permissions. |
| **InventoryItem** | SKU, name, category, price, image, quantity. |
| **PhotoAsset** | Linked to InventoryItem; stored in CDN. |
| **SyncJob** | Tracks offline → cloud synchronization events. |

### Example Schema
```sql
CREATE TABLE Tenant (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE InventoryItem (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES Tenant(id),
  name TEXT,
  price DECIMAL(10,2),
  stock INT,
  image_url TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

# v1.3 — Media & Storage Strategy

### Storage Design
- CDN: Supabase or Cloudflare R2.  
- Compression: WebP conversion under 1MB.  
- Folder structure per tenant: `/tenants/{tenant_id}/inventory/{sku}.jpg`  
- Backup: Daily differential backups, 30-day retention.

### Synchronization Rules
- Local → Cloud delta sync every 10 min.
- Conflict resolution = most recent timestamp wins.
- Encrypted transit via HTTPS/TLS 1.3.

---

# v1.4 — System Dependencies & Third-Party Services

### Framework Stack
| Layer | Technology |
|--------|-------------|
| Frontend | React + Next.js |
| Backend | Node.js + Express |
| Database | PostgreSQL / SQLite (hybrid) |
| Auth | Supabase Auth + JWT |
| Hosting | Supabase, Vercel, or Render |

### External Services
| Service | Role |
|----------|------|
| Stripe | Billing & subscriptions |
| Cloudflare | CDN & SSL termination |
| Sentry | Monitoring & alerts |
| Google APIs | Inventory visibility integrations |

---

# v1.5 — Multi-Tenant Architecture

### Tenant Isolation Model
- Each retailer = 1 tenant.  
- Tenant ID stored in all records.  
- RLS (Row-Level Security) ensures isolation.

### Access Patterns
| Role | Permissions |
|-------|--------------|
| **Admin** | Manage users, edit store data, authorize APIs. |
| **Staff** | Add/edit products, upload photos. |
| **Viewer** | Read-only dashboard access. |

---

# v1.6 — Security Architecture & RBAC

### Components
- AES-256 token encryption for credentials.
- OAuth2 + JWT authentication with refresh tokens.
- 2FA for admins.  
- GDPR/CCPA consent logging.

### Security Layers
| Area | Method |
|-------|--------|
| **API Security** | HTTPS only, JWT verification middleware. |
| **Data Security** | Row-Level Security in PostgreSQL. |
| **Audit Logs** | Every write operation stored in audit table. |
| **Compliance** | Data retention + user deletion compliance. |

---

# v1.7 — Resilience, Observability & SLA

### Resilience
- Load-balanced read replicas.
- Graceful queue retries (max 3 attempts).
- Circuit breaker on API rate limits.

### Observability Stack
| Tool | Function |
|-------|-----------|
| Grafana | Dashboards |
| Loki | Logs |
| Prometheus | Metrics |
| Sentry | Alerts |

### SLA Targets
- Uptime: 99.5% (Starter), 99.9% (Premium+).  
- RTO: 2 hours.  
- RPO: 1 hour.

---

# v1.8 — Monetization Strategy

### Pricing Model
| Tier | Monthly | Description |
|------|----------|-------------|
| Free | $0 | Basic listing, manual sync only. |
| Starter | $25 | Inventory + feed preview. |
| Pro | $79 | Google sync + analytics. |
| Premium | $149 | Multi-store + SLA 99.9%. |
| Enterprise | Custom | White-label + dedicated infra. |

### Add-ons
- SEO Booster: +$15/month.  
- Google Connect: +$10/store.  
- Analytics Dashboard: +$10/month.

---

# v1.9 — Local Discovery & SEO Integration

### SEO Features
- Schema.org markup for each product and store.
- JSON-LD feeds for Google indexing.
- Automatic sync with Merchant Center APIs.

### Feed Example
```json
{
  "store_code": "greenmart001",
  "product_id": "SKU-12345",
  "availability": "in_stock",
  "price": { "value": 8.99, "currency": "USD" }
}
```

---

# v2.0 — Google Integration & Analytics Architecture

### OAuth2 Flow
1. Tenant initiates authorization.  
2. Google returns authorization code.  
3. System exchanges for access + refresh tokens.  
4. Tokens encrypted and stored per tenant.  
5. Sync jobs push inventory updates to Google.

### Analytics Schema
```sql
CREATE TABLE local_search_metrics (
 id UUID PRIMARY KEY,
 tenant_id UUID,
 product_id UUID,
 impressions INT,
 clicks INT,
 ctr FLOAT GENERATED ALWAYS AS (clicks / NULLIF(impressions,0)) STORED,
 timestamp TIMESTAMP DEFAULT now()
);
```

---

# v2.1 — Monetization Revision (Google Integration)

### Tier Revisions
- Pro tier includes Google sync.  
- Premium adds analytics dashboard.  
- Enterprise adds white-label Merchant integration.

### Early-Adopter Incentives
- First 10 stores free for 3 months.  
- Next 50 at $5/month Google add-on.

---

# v2.2 — Business Viability & Market Strategy

### Feasibility Highlights
- Market: 1.2M SMB retailers in the US.  
- Target adoption: 10–15% digitally ready.  
- ARPU: $50–$100/month.

### Differentiation
- Multi-tenant SaaS for independent retailers.  
- Real-time visibility without e-commerce complexity.

---

# v2.3 — Go-To-Market (GTM) Rollout Plan

### Pilot Framework
| Phase | Duration | Goal |
|--------|-----------|------|
| Preparation | 2 weeks | Outreach materials, partner setup. |
| Onboarding | 4–6 weeks | 10–15 stores live. |
| Evaluation | 4 weeks | Metrics + feedback. |
| Expansion | Ongoing | Replicate to nearby regions. |

### Outreach Templates
**Email:** Free pilot invite for Google visibility sync.  
**In-person pitch:** "We’ll make your shelves visible online."  
**Partnership letter:** Chamber collaboration proposal.

---

# v2.4 — Production Release Appendices

## Appendix A — Storage Optimization & Scaling
| Tenant Count | Infra Model |
|---------------|--------------|
| <100 | Shared env |
| 100–1,000 | Multi-region replicas |
| >1,000 | Dedicated clusters |

## Appendix B — Partner Revenue Share
| Partner | Share | Schedule |
|----------|--------|-----------|
| Chamber | 10% | Quarterly |
| POS Vendor | 15% | Monthly |
| IT Provider | 20% | Monthly |

## Appendix C — SEO Maintenance Add-On
| Service | Frequency | Price |
|----------|------------|--------|
| Listing Audit | Monthly | Included |
| Re-Optimization | Quarterly | $49/month |

## Appendix D — Founder’s Vision
> "Every local store deserves to be found. Visibility should be automatic, affordable, and fair."

— Paul Yarl  
Founder & Product Architect

---

**End of Document — Retail Visibility Platform (v1.0–v2.4 Full Specification)**

