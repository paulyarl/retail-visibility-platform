# Supabase Pro Plan - Project Design for Retail Visibility Platform

## 🎯 Executive Summary

This document outlines the recommended Supabase project architecture for the Retail Visibility Platform, optimized for a **Supabase Pro Plan** ($25/month per project).

**Current Architecture:**
- Frontend: Next.js on Vercel
- Backend: Express API on Railway
- Database: PostgreSQL via Supabase
- Auth: Supabase Auth (Magic Links)
- Storage: Supabase Storage (photos bucket)

---

## 📊 Recommended Project Structure

### **Option 1: Single Production Project (Recommended)**

```
Supabase Projects:
├── retail-visibility-prod (Pro Plan - $25/mo)
│   ├── Database: PostgreSQL (Production data)
│   ├── Auth: Magic link authentication
│   ├── Storage: Product photos
│   └── Edge Functions: (Future use)
│
└── retail-visibility-dev (Free Tier)
    ├── Database: PostgreSQL (Development/testing)
    ├── Auth: Test users
    └── Storage: Test photos
```

**Cost:** $25/month (1 Pro project + 1 Free project)

**Rationale:**
- Keep production isolated and stable
- Use free tier for development/testing
- Migrate to Pro when dev needs exceed free limits

---

### **Option 2: Multi-Environment Setup (For Scale)**

```
Supabase Projects:
├── retail-visibility-prod (Pro Plan - $25/mo)
│   ├── Database: Production PostgreSQL
│   ├── Auth: Production users
│   ├── Storage: Production photos
│   └── Branches: None (stable production)
│
├── retail-visibility-staging (Free Tier)
│   ├── Database: Staging data
│   ├── Auth: Test users
│   └── Storage: Test photos
│
└── retail-visibility-dev (Free Tier)
    ├── Database: Local development
    ├── Auth: Dev users
    └── Storage: Dev photos
```

**Cost:** $25/month (1 Pro + 2 Free)

**Rationale:**
- Clear separation of environments
- Staging environment for pre-production testing
- Development environment for feature development

---

## 🏗️ Recommended: Option 1 (Single Production Project)

For your current scale and Pro plan, **Option 1** is recommended.

### Project Configuration

#### **1. Production Project: `retail-visibility-prod`**

**Plan:** Pro ($25/month)

**Database Configuration:**
- **Instance Size:** Small (2 CPU, 1GB RAM) - included in Pro
- **Storage:** 8GB included, auto-scaling up to 100GB
- **Connection Pooling:** Enabled (Supavisor)
- **Point-in-Time Recovery:** 7 days (included)
- **Daily Backups:** Enabled (included)

**Auth Configuration:**
- **Provider:** Email (Magic Links)
- **Email Templates:** Customized for brand
- **Rate Limiting:** Enabled
- **Session Duration:** 7 days
- **Refresh Token Rotation:** Enabled
- **JWT Expiry:** 1 hour

**Storage Configuration:**
- **Bucket:** `photos` (public read, authenticated write)
- **Max File Size:** 50MB per file
- **Allowed MIME Types:** `image/jpeg`, `image/png`, `image/webp`
- **Storage Limit:** 100GB included in Pro
- **CDN:** Enabled (global edge caching)

**Security:**
- **Row Level Security (RLS):** Enabled on all tables
- **SSL/TLS:** Enforced
- **API Keys:** Rotate every 90 days
- **Service Role Key:** Server-side only (Railway)

---

#### **2. Development Project: `retail-visibility-dev`**

**Plan:** Free Tier

**Database Configuration:**
- **Instance Size:** Micro (shared CPU)
- **Storage:** 500MB (free tier limit)
- **Auto-pause:** After 7 days inactivity

**Auth Configuration:**
- **Provider:** Email (Magic Links)
- **Test Users:** Unlimited

**Storage Configuration:**
- **Bucket:** `photos` (same structure as prod)
- **Storage Limit:** 1GB (free tier)

**Usage:**
- Feature development
- Testing migrations
- E2E testing
- CI/CD pipeline testing

---

## 🗄️ Database Schema Design

### Schema Organization

Your Prisma schema is well-organized. Here's how to optimize it for Supabase:

```sql
-- Core Schemas
public                    -- Main application tables
auth                      -- Supabase Auth (managed)
storage                   -- Supabase Storage (managed)

-- Custom Schemas (Optional - for organization)
inventory                 -- Inventory-related tables
analytics                 -- Performance/metrics tables
integrations              -- Google OAuth, GBP, Merchant
audit                     -- Audit logs
```

### Key Tables by Domain

**1. Multi-Tenancy Core:**
- `Tenant` (75 tenants currently)
- `Organization` (chain management)
- `UserTenant` (many-to-many)
- `User` (authentication)

**2. Inventory Management:**
- `InventoryItem` (products/SKUs)
- `PhotoAsset` (product photos)
- `TenantCategory` (vendor categories)
- `GoogleTaxonomy` (Google product taxonomy)

**3. Business Profile:**
- `TenantBusinessProfile` (NAP data)
- `BusinessHours` (operating hours)
- `BusinessHoursSpecial` (holiday hours)
- `GBPCategory` (Google Business categories)

**4. Integrations:**
- `GoogleOAuthAccount`
- `GoogleOAuthToken` (encrypted)
- `GoogleMerchantLink`
- `GbpLocation`
- `GbpInsightDaily`

**5. Operations:**
- `SyncJob` (async operations)
- `FeedPushJob` (Google Merchant sync)
- `ScanSession` (barcode scanning)
- `ScanResult` (scan data)
- `BarcodeLookupLog` (enrichment tracking)

**6. Admin & Governance:**
- `PlatformFeatureFlag`
- `TenantFeatureFlag`
- `PermissionMatrix`
- `AuditLog`
- `PermissionAuditLog`

---

## 🔐 Row Level Security (RLS) Policies

### Critical RLS Policies to Implement

#### **1. Tenant Isolation (Most Important)**

```sql
-- Tenant table: Users can only see their own tenants
CREATE POLICY "Users can view their own tenants"
ON public."Tenant"
FOR SELECT
USING (
  id IN (
    SELECT tenant_id 
    FROM public."user_tenants" 
    WHERE user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public."users" 
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- InventoryItem: Tenant-scoped access
CREATE POLICY "Users can view items in their tenants"
ON public."InventoryItem"
FOR SELECT
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM public."user_tenants" 
    WHERE user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public."users" 
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- PhotoAsset: Tenant-scoped access
CREATE POLICY "Users can view photos in their tenants"
ON public."PhotoAsset"
FOR SELECT
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM public."user_tenants" 
    WHERE user_id = auth.uid()
  )
);
```

#### **2. Admin-Only Tables**

```sql
-- PlatformFeatureFlag: Admin only
CREATE POLICY "Only admins can manage platform flags"
ON public."platform_feature_flags"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public."users" 
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- PermissionMatrix: Admin only
CREATE POLICY "Only admins can manage permissions"
ON public."permission_matrix"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public."users" 
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);
```

#### **3. User Management**

```sql
-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public."users"
FOR SELECT
USING (id = auth.uid());

-- Admins can view all users
CREATE POLICY "Admins can view all users"
ON public."users"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public."users" 
    WHERE id = auth.uid() AND role = 'ADMIN'
  )
);
```

#### **4. Storage Policies**

```sql
-- Photos bucket: Public read, authenticated write
CREATE POLICY "Public can view photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their tenant's photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text 
    FROM public."Tenant"
    WHERE id IN (
      SELECT tenant_id 
      FROM public."user_tenants" 
      WHERE user_id = auth.uid()
    )
  )
);
```

---

## 🔑 API Keys & Security

### Key Management Strategy

**1. Anon Key (Public - Frontend)**
- Used in: Next.js frontend (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- Permissions: Limited by RLS policies
- Rotation: Every 90 days
- Exposure: Safe to expose in browser

**2. Service Role Key (Private - Backend)**
- Used in: Railway API (`SUPABASE_SERVICE_ROLE_KEY`)
- Permissions: Bypasses RLS (full access)
- Rotation: Every 90 days
- Exposure: **NEVER expose to frontend**

**3. JWT Secret**
- Used for: Token verification
- Rotation: Coordinate with key rotation
- Storage: Environment variables only

### Environment Variables

**Production (Railway API):**
```env
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
NODE_ENV=production
```

**Production (Vercel Frontend):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
API_BASE_URL=https://rvpapi-production.up.railway.app
```

**Development:**
```env
DATABASE_URL=postgresql://postgres:[password]@[dev-host]:5432/postgres
SUPABASE_URL=https://[dev-project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[dev-service-role-key]
NEXT_PUBLIC_SUPABASE_URL=https://[dev-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[dev-anon-key]
```

---

## 📦 Storage Design

### Bucket Structure

**Bucket Name:** `photos`

**Folder Structure:**
```
photos/
├── [tenant-id]/
│   ├── [sku]/
│   │   ├── [timestamp]-[uuid].jpg
│   │   ├── [timestamp]-[uuid].webp
│   │   └── [timestamp]-[uuid].png
│   └── profile/
│       └── logo.png
└── system/
    ├── platform-logo.png
    └── default-product.png
```

**Storage Policies:**
- **Public Read:** All photos are publicly accessible
- **Authenticated Write:** Only logged-in users can upload
- **Tenant-Scoped Delete:** Users can only delete photos in their tenants

**File Naming Convention:**
```
[tenant-id]/[sku]/[timestamp]-[uuid].[ext]

Example:
clx1234567890/SKU-12345/1730000000000-a1b2c3d4.jpg
```

**Image Optimization:**
- Use Supabase Image Transformations
- Generate thumbnails on-the-fly
- WebP format for modern browsers
- CDN caching enabled

**Example URL:**
```
https://[project-ref].supabase.co/storage/v1/object/public/photos/[tenant-id]/[sku]/[filename]

With transformation:
https://[project-ref].supabase.co/storage/v1/render/image/public/photos/[tenant-id]/[sku]/[filename]?width=400&height=400&quality=80
```

---

## 🔄 Migration Strategy

### From Current Setup to Optimized Supabase

**Current State:**
- ✅ Database: PostgreSQL on Supabase
- ✅ Auth: Supabase Auth (Magic Links)
- ✅ Storage: Supabase Storage (photos bucket)
- ✅ Backend: Express API on Railway

**Migration Steps:**

#### **Phase 1: Enable RLS (Critical)**
1. **Backup database** (Supabase Dashboard → Database → Backups)
2. **Enable RLS on all tables:**
   ```sql
   ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "InventoryItem" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "PhotoAsset" ENABLE ROW LEVEL SECURITY;
   -- Repeat for all tables
   ```
3. **Create RLS policies** (see RLS section above)
4. **Test with service role key** (should still work)
5. **Test with anon key** (should be restricted)

#### **Phase 2: Optimize Storage**
1. **Review storage policies** (already configured)
2. **Enable CDN caching** (Supabase Dashboard → Storage → Settings)
3. **Set up image transformations** (use render endpoint)
4. **Implement lazy loading** (frontend optimization)

#### **Phase 3: Connection Pooling**
1. **Enable Supavisor** (Supabase Dashboard → Database → Connection Pooling)
2. **Update Railway DATABASE_URL** to use pooler:
   ```
   postgresql://postgres:[password]@[host]:6543/postgres?pgbouncer=true
   ```
3. **Test API connections**
4. **Monitor connection usage**

#### **Phase 4: Monitoring & Alerts**
1. **Set up database alerts:**
   - CPU > 80%
   - Memory > 80%
   - Storage > 80%
   - Connection pool exhaustion
2. **Set up auth alerts:**
   - Failed login attempts > 100/hour
   - Unusual signup patterns
3. **Set up storage alerts:**
   - Storage > 80GB (Pro limit: 100GB)

---

## 📊 Monitoring & Observability

### Key Metrics to Track

**Database:**
- Active connections (limit: 100 on Pro)
- Query performance (slow queries > 1s)
- Storage usage (100GB limit)
- Backup status (daily)

**Auth:**
- Active users (MAU)
- Login success rate
- Magic link delivery rate
- Session duration

**Storage:**
- Total storage used
- Upload success rate
- CDN cache hit rate
- Bandwidth usage

**API (Railway):**
- Request rate
- Error rate
- Response time (p50, p95, p99)
- Database connection pool usage

### Monitoring Tools

**Supabase Dashboard:**
- Database → Reports (query performance)
- Auth → Users (active users, signups)
- Storage → Usage (storage metrics)
- Logs → Database, Auth, Storage

**Railway Dashboard:**
- Metrics (CPU, memory, network)
- Logs (application logs)
- Deployments (deployment history)

**External (Optional):**
- Sentry (error tracking)
- LogRocket (session replay)
- Datadog (APM)

---

## 💰 Cost Optimization

### Supabase Pro Plan Limits

**Included in $25/month:**
- 8GB database storage (auto-scales to 100GB)
- 100GB file storage
- 250GB bandwidth
- 50GB database egress
- 2 CPU cores, 1GB RAM
- 7-day point-in-time recovery
- Daily backups
- Email support

**Overage Costs:**
- Database storage: $0.125/GB/month (after 8GB)
- File storage: $0.021/GB/month (after 100GB)
- Bandwidth: $0.09/GB (after 250GB)
- Database egress: $0.09/GB (after 50GB)

### Cost Optimization Strategies

**1. Database Storage:**
- Archive old data (move to cold storage)
- Compress JSON fields
- Delete unused audit logs (> 90 days)
- Optimize indexes (remove unused)

**2. File Storage:**
- Compress images before upload (WebP format)
- Delete orphaned photos (no associated item)
- Implement image retention policy (e.g., 1 year)
- Use CDN caching (reduce bandwidth)

**3. Bandwidth:**
- Enable CDN (included in Pro)
- Implement pagination (reduce data transfer)
- Use GraphQL (fetch only needed fields)
- Cache API responses (frontend)

**4. Database Egress:**
- Use connection pooling (reduce connections)
- Batch operations (reduce round trips)
- Cache frequently accessed data (Redis/Vercel KV)
- Use Supabase Realtime sparingly

### Estimated Monthly Costs

**Current Usage (Estimated):**
- Tenants: 75
- Items: ~5,000 (estimated)
- Photos: ~10,000 (estimated at 500KB avg = 5GB)
- Users: ~100 active users

**Projected Costs:**
- Supabase Pro: $25/month (base)
- Database storage: ~2GB (included)
- File storage: ~5GB (included)
- Bandwidth: ~50GB/month (included)
- **Total: $25/month**

**At Scale (1,000 tenants, 100K items):**
- Database storage: ~20GB ($1.50 overage)
- File storage: ~50GB (included)
- Bandwidth: ~500GB/month ($22.50 overage)
- **Total: ~$49/month**

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] **Backup current database** (Supabase Dashboard)
- [ ] **Test RLS policies** (dev environment)
- [ ] **Review storage policies** (ensure correct permissions)
- [ ] **Rotate API keys** (if > 90 days old)
- [ ] **Update environment variables** (Railway + Vercel)
- [ ] **Enable connection pooling** (Supavisor)
- [ ] **Set up monitoring alerts** (Supabase Dashboard)

### Deployment

- [ ] **Deploy RLS policies** (SQL Editor)
- [ ] **Update Railway DATABASE_URL** (use pooler)
- [ ] **Deploy frontend** (Vercel)
- [ ] **Deploy backend** (Railway)
- [ ] **Test authentication flow** (magic link)
- [ ] **Test photo upload** (storage)
- [ ] **Test tenant isolation** (RLS)

### Post-Deployment

- [ ] **Monitor error rates** (first 24 hours)
- [ ] **Check database connections** (connection pool)
- [ ] **Verify storage uploads** (photos bucket)
- [ ] **Test user flows** (login, create tenant, add item)
- [ ] **Review logs** (Supabase + Railway)
- [ ] **Document any issues** (create tickets)

---

## 🔮 Future Enhancements

### Supabase Features to Leverage

**1. Realtime Subscriptions:**
- Live inventory updates
- Real-time collaboration (multiple users editing)
- Live dashboard metrics

**2. Edge Functions:**
- Image processing (resize, compress)
- Webhook handlers (Stripe, Google)
- Scheduled jobs (daily reports)

**3. Supabase Vault:**
- Encrypt sensitive data (OAuth tokens)
- Secure API key storage
- PCI compliance (if accepting payments)

**4. Database Webhooks:**
- Trigger external APIs on data changes
- Send notifications (email, SMS)
- Sync with external systems

**5. GraphQL API:**
- Replace REST API (reduce overfetching)
- Better frontend performance
- Type-safe queries

---

## 📚 Additional Resources

### Supabase Documentation
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage](https://supabase.com/docs/guides/storage)
- [Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Performance Tuning](https://supabase.com/docs/guides/database/performance)

### Best Practices
- [Multi-tenancy Guide](https://supabase.com/docs/guides/auth/multi-tenancy)
- [Security Best Practices](https://supabase.com/docs/guides/auth/security)
- [Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)

---

## 🎯 Recommended Next Steps

### Immediate (This Week)
1. **Enable RLS on all tables** (critical security)
2. **Set up connection pooling** (performance)
3. **Configure monitoring alerts** (observability)
4. **Rotate API keys** (if needed)

### Short-term (This Month)
1. **Optimize storage policies** (cost savings)
2. **Implement image transformations** (performance)
3. **Set up database backups** (disaster recovery)
4. **Document RLS policies** (team knowledge)

### Long-term (Next Quarter)
1. **Evaluate Realtime subscriptions** (live updates)
2. **Consider Edge Functions** (serverless)
3. **Implement Supabase Vault** (security)
4. **Migrate to GraphQL** (performance)

---

## 📞 Support & Escalation

**Supabase Support:**
- Pro Plan: Email support (24-48 hour response)
- Dashboard: Support → New Ticket
- Community: Discord, GitHub Discussions

**Critical Issues:**
- Database down: Check Supabase Status Page
- Auth issues: Review Auth logs
- Storage issues: Check Storage policies

---

**Document Version:** 1.0  
**Last Updated:** November 7, 2025  
**Author:** AI Assistant  
**Review Date:** December 7, 2025
