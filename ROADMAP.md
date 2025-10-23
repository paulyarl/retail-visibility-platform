# Retail Visibility Platform - Product Roadmap

**Last Updated:** 2025-10-23  
**Current Version:** v3.5  
**Status:** 🚀 Production Ready

---

## 📍 Current State (v3.5) - COMPLETE ✅

### Database Layer
- ✅ SWIS-ready schema (17 fields, 5 enums)
- ✅ Item lifecycle management (active/inactive/archived)
- ✅ Billing policy system with temporal versioning
- ✅ Full-text search with international support
- ✅ Audit logging with request tracking
- ✅ Real-time SKU counters with NOTIFY/LISTEN
- ✅ 15+ optimized indexes
- ✅ 8 monitoring views

### API Layer
- ✅ 12 v3.5 endpoints (audit, policy, billing)
- ✅ Auth middleware with role-based access
- ✅ Automatic audit logging on all writes
- ✅ CSV/JSON export capabilities
- ✅ Google OAuth integration
- ✅ GMC/GBP data fetching

### Features
- ✅ Inventory management with SWIS fields
- ✅ Photo upload (Supabase + local fallback)
- ✅ Google Connect Suite (OAuth, GMC, GBP)
- ✅ Tenant management (basic)
- ✅ Audit trails
- ✅ Policy versioning

---

## 🎯 v3.6 - Tenant Management & IAP (3-5 weeks)

**Status:** 📋 Planned  
**Priority:** High  
**Spec:** `TENANT_MANAGEMENT_IAP_V3.6_SPEC.md`

### Goals
Enable self-serve subscription management and monetization

### Features

#### Database (Week 1)
- [ ] Plan catalog table
- [ ] Booster catalog table
- [ ] Subscription management table
- [ ] Booster purchase tracking
- [ ] Status history table
- [ ] Entitlements cache table

#### Stripe Integration (Week 2)
- [ ] Product catalog sync
- [ ] Hosted checkout sessions
- [ ] Payment Element integration
- [ ] Webhook handlers (5 events)
- [ ] Idempotency store
- [ ] Signature verification

#### Entitlements Engine (Week 3)
- [ ] Compute function (plan + boosters + policy)
- [ ] Cache management
- [ ] Refresh triggers
- [ ] Snapshot view
- [ ] Nightly reconciliation job

#### Business Logic (Week 4)
- [ ] Proration calculations
- [ ] Upgrade flow (immediate)
- [ ] Downgrade flow (scheduled)
- [ ] Over-cap prevention
- [ ] Usage validation

#### Dunning & Suspension (Week 5)
- [ ] Payment failure handling
- [ ] Dunning email flow
- [ ] Suspension logic
- [ ] Reactivation flow
- [ ] Grace period management

#### API Endpoints
- [ ] `GET /tenant/entitlements`
- [ ] `GET /tenant/billing/snapshot`
- [ ] `POST /tenant/plan/preview`
- [ ] `POST /tenant/plan/upgrade`
- [ ] `POST /tenant/plan/downgrade`
- [ ] `POST /tenant/booster/purchase`
- [ ] `POST /tenant/status`
- [ ] `POST /iap/checkout/session`
- [ ] `POST /iap/payment-intent`
- [ ] `POST /iap/webhooks/stripe`

#### UI Components
- [ ] Plan selector modal
- [ ] Booster drawer
- [ ] Enhanced counters card with CTAs
- [ ] Status banner (suspended/inactive)
- [ ] Receipts & invoice history

### Success Metrics
- Conversion rate: >15% free → paid
- Payment success: >95%
- Dunning recovery: >60%
- Support tickets: <5% of transactions

---

## 🔮 v3.7 - Advanced Features (6-8 weeks)

**Status:** 💭 Conceptual  
**Priority:** Medium

### Multi-Tenant Features
- [ ] Organization-level accounts
- [ ] Cross-tenant SKU pooling
- [ ] Shared team members
- [ ] Consolidated billing

### Advanced Analytics
- [ ] Sales velocity tracking
- [ ] Inventory turnover metrics
- [ ] Category performance
- [ ] Seasonal trends
- [ ] Predictive restocking

### Marketplace
- [ ] Revenue share model
- [ ] Vendor onboarding
- [ ] Commission tracking
- [ ] Payout automation

### Enhanced SWIS
- [ ] Bulk operations API
- [ ] CSV import/export
- [ ] Template management
- [ ] Scheduled publishing
- [ ] A/B testing for feeds

---

## 🚀 v3.8 - Scale & Performance (4-6 weeks)

**Status:** 💭 Conceptual  
**Priority:** Medium

### Performance
- [ ] Redis caching layer
- [ ] CDN for images
- [ ] Database read replicas
- [ ] Query optimization
- [ ] Lazy loading strategies

### Scale
- [ ] Multi-region deployment
- [ ] Load balancing
- [ ] Auto-scaling
- [ ] Rate limiting
- [ ] Queue-based processing

### Reliability
- [ ] Circuit breakers
- [ ] Retry policies
- [ ] Fallback strategies
- [ ] Health checks
- [ ] Automated failover

---

## 🎨 v3.9 - UX & Mobile (6-8 weeks)

**Status:** 💭 Conceptual  
**Priority:** Low

### Mobile Apps
- [ ] React Native app
- [ ] Photo capture optimization
- [ ] Offline mode
- [ ] Push notifications
- [ ] Barcode scanning

### UX Enhancements
- [ ] Drag-and-drop inventory
- [ ] Bulk editing
- [ ] Keyboard shortcuts
- [ ] Dark mode
- [ ] Customizable dashboards

### Localization
- [ ] Multi-language support
- [ ] Currency conversion
- [ ] Regional date/time formats
- [ ] RTL layout support

---

## 🔧 Ongoing Initiatives

### Infrastructure
- **CI/CD** (v3.5+)
  - [ ] Schema guard GitHub Action
  - [ ] Drift detection workflow
  - [ ] Automated testing
  - [ ] Deployment automation

- **Observability** (v3.5+)
  - [ ] Datadog/Grafana dashboards
  - [ ] RUM (Real User Monitoring)
  - [ ] Error tracking
  - [ ] Performance monitoring

### Security
- **Authentication** (v3.6+)
  - [ ] JWT implementation
  - [ ] Session management
  - [ ] 2FA support
  - [ ] SSO integration

- **Compliance** (v3.6+)
  - [ ] SOC 2 certification
  - [ ] GDPR compliance tools
  - [ ] Data retention policies
  - [ ] Privacy controls

### Documentation
- [ ] API reference (OpenAPI/Swagger)
- [ ] Admin guide
- [ ] User manual
- [ ] Video tutorials
- [ ] Developer docs

---

## 📊 Feature Prioritization Matrix

| Feature | Impact | Effort | Priority | Version |
|---|---|---|---|---|
| IAP & Subscriptions | High | High | **P0** | v3.6 |
| Multi-tenant | High | Medium | **P1** | v3.7 |
| Advanced Analytics | Medium | Medium | **P1** | v3.7 |
| Performance Optimization | High | Medium | **P1** | v3.8 |
| Mobile Apps | Medium | High | **P2** | v3.9 |
| Marketplace | Medium | High | **P2** | v3.7 |
| Localization | Low | Medium | **P3** | v3.9 |

---

## 🎯 Success Criteria by Version

### v3.6 Success
- [ ] 100+ paying customers
- [ ] <2% payment failure rate
- [ ] >90% customer satisfaction
- [ ] <5 critical bugs in production

### v3.7 Success
- [ ] 500+ paying customers
- [ ] 50+ marketplace vendors
- [ ] $100K+ MRR
- [ ] <1% churn rate

### v3.8 Success
- [ ] 1000+ paying customers
- [ ] 99.9% uptime
- [ ] <200ms p95 response time
- [ ] Multi-region deployment

---

## 🔄 Release Cadence

- **Major versions** (v3.x): Every 6-8 weeks
- **Minor updates** (v3.x.y): Every 2 weeks
- **Hotfixes** (v3.x.y.z): As needed
- **Security patches**: Within 24 hours

---

## 📝 Decision Log

| Date | Decision | Rationale | Impact |
|---|---|---|---|
| 2025-10-23 | Ship v3.5 before IAP | Validate core features first | Delayed monetization by 4 weeks |
| 2025-10-23 | Use Stripe for payments | Industry standard, best UX | Locked into Stripe ecosystem |
| 2025-10-23 | PostgreSQL for all data | Consistency, ACID guarantees | No polyglot persistence |

---

## 🤝 Stakeholder Input

### Customer Requests (Top 5)
1. **Subscription plans** - v3.6 ✅
2. **Bulk import** - v3.7
3. **Mobile app** - v3.9
4. **Better analytics** - v3.7
5. **Multi-location** - v3.7

### Team Priorities
- **Engineering**: Performance & scale (v3.8)
- **Product**: IAP & monetization (v3.6)
- **Design**: Mobile & UX (v3.9)
- **Sales**: Marketplace (v3.7)

---

## 📞 Contact & Feedback

- **Product Manager**: [TBD]
- **Engineering Lead**: [TBD]
- **Feedback**: Create GitHub issue or email feedback@rvp.com

---

## 🔗 Related Documents

- `TENANT_MANAGEMENT_IAP_V3.6_SPEC.md` - v3.6 detailed spec
- `NEXT_STEPS_V3.5.md` - Current implementation status
- `IMPLEMENTATION_SUMMARY.md` - Technical overview
- `DEPLOYMENT_CHECKLIST.md` - Deployment guide
- `PLATFORM_OVERVIEW.md` - Architecture overview
