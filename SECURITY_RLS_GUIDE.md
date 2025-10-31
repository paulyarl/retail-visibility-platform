# Row Level Security (RLS) Implementation Guide
## Multi-Tenant Data Isolation for VisibleShelf

**Status**: ⚠️ **CRITICAL - RLS NOT YET ENABLED**  
**Priority**: HIGH  
**Last Updated**: October 31, 2025

---

## 🚨 Current Security Status

### **Risk Level: HIGH** ⚠️

**RLS is currently DISABLED on all tables.**

**What this means:**
- Any authenticated user can access ANY tenant's data
- No database-level isolation between tenants
- Relying solely on application-level checks
- One code bug = potential data breach

**Mitigation in place:**
- ✅ Application-level tenant isolation in API routes
- ✅ JWT authentication via Supabase Auth
- ✅ Service role key used in Railway API (bypasses RLS)

**What's needed:**
- ❌ Enable RLS on all tables
- ❌ Create RLS policies for tenant isolation
- ❌ Audit all API routes for proper tenant checks

---

## 🎯 Why RLS is Critical

### **Multi-Tenant Architecture**

This platform serves multiple independent businesses (tenants):
- Each tenant has their own inventory
- Each tenant has their own users
- Each tenant has their own business data

**Without RLS:**
- User from Tenant A could query Tenant B's data
- Malicious user could export all platform data
- Competitor could see customer inventory
- GDPR/compliance violations

**With RLS:**
- Database enforces tenant isolation
- Defense in depth (code + database)
- Automatic audit trail
- Compliance-ready

---

## 🏗️ Current Architecture

### **How Tenant Isolation Works Today**

**Application-Level Isolation:**
```typescript
// Example: API route checks tenantId
app.get('/items', async (req, res) => {
  const { tenantId } = req.query;
  
  // Application enforces tenant check
  const items = await prisma.inventoryItem.findMany({
    where: { tenantId }  // ← Only this prevents cross-tenant access
  });
  
  res.json(items);
});
```

**Problems with this approach:**
1. **One missed check = data leak**
2. **No defense if code has bugs**
3. **Harder to audit**
4. **Requires perfect code reviews**

### **How RLS Would Work**

**Database-Level Isolation:**
```sql
-- RLS Policy: Users can only see their tenant's items
CREATE POLICY "tenant_isolation" ON "InventoryItem"
FOR SELECT USING (
  "tenantId" IN (
    SELECT tenant_id FROM "UserTenant" WHERE user_id = auth.uid()
  )
);
```

**Benefits:**
1. **Database enforces isolation automatically**
2. **Works even if code has bugs**
3. **Easier to audit (SQL policies)**
4. **Compliance-ready**

---

## 📋 Implementation Plan

### **Phase 1: Enable RLS (Do This First)**

**Step 1: Enable RLS on All Tables**

Run in Supabase SQL Editor:

```sql
-- Core tables
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserTenant" ENABLE ROW LEVEL SECURITY;

-- Business data
ALTER TABLE "InventoryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PhotoAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductPerformance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantBusinessProfile" ENABLE ROW LEVEL SECURITY;

-- Organization/chain features
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationRequest" ENABLE ROW LEVEL SECURITY;

-- Integrations
ALTER TABLE "GoogleOAuthAccount" ENABLE ROW LEVEL SECURITY;

-- Platform settings (admin only)
ALTER TABLE "PlatformSettings" ENABLE ROW LEVEL SECURITY;
```

**⚠️ WARNING**: Enabling RLS without policies will **block all access**!

### **Phase 2: Create RLS Policies**

#### **Tenant Table Policies**

```sql
-- Users can view tenants they belong to
CREATE POLICY "users_view_own_tenants"
ON "Tenant"
FOR SELECT
USING (
  id IN (
    SELECT tenant_id 
    FROM "UserTenant" 
    WHERE user_id = auth.uid()
  )
);

-- Users can update their own tenants
CREATE POLICY "users_update_own_tenants"
ON "Tenant"
FOR UPDATE
USING (
  id IN (
    SELECT tenant_id 
    FROM "UserTenant" 
    WHERE user_id = auth.uid()
  )
);

-- Users can create tenants (new signup)
CREATE POLICY "users_create_tenants"
ON "Tenant"
FOR INSERT
WITH CHECK (true);  -- Allow creation, UserTenant link created separately
```

#### **InventoryItem Table Policies**

```sql
-- Users can view items from their tenants
CREATE POLICY "users_view_tenant_items"
ON "InventoryItem"
FOR SELECT
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM "UserTenant" 
    WHERE user_id = auth.uid()
  )
);

-- Users can insert items to their tenants
CREATE POLICY "users_insert_tenant_items"
ON "InventoryItem"
FOR INSERT
WITH CHECK (
  "tenantId" IN (
    SELECT tenant_id 
    FROM "UserTenant" 
    WHERE user_id = auth.uid()
  )
);

-- Users can update items from their tenants
CREATE POLICY "users_update_tenant_items"
ON "InventoryItem"
FOR UPDATE
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM "UserTenant" 
    WHERE user_id = auth.uid()
  )
);

-- Users can delete items from their tenants
CREATE POLICY "users_delete_tenant_items"
ON "InventoryItem"
FOR DELETE
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM "UserTenant" 
    WHERE user_id = auth.uid()
  )
);
```

#### **PhotoAsset Table Policies**

```sql
-- Users can view photos from their tenants
CREATE POLICY "users_view_tenant_photos"
ON "PhotoAsset"
FOR SELECT
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM "UserTenant" 
    WHERE user_id = auth.uid()
  )
);

-- Users can insert photos to their tenants
CREATE POLICY "users_insert_tenant_photos"
ON "PhotoAsset"
FOR INSERT
WITH CHECK (
  "tenantId" IN (
    SELECT tenant_id 
    FROM "UserTenant" 
    WHERE user_id = auth.uid()
  )
);

-- Users can delete photos from their tenants
CREATE POLICY "users_delete_tenant_photos"
ON "PhotoAsset"
FOR DELETE
USING (
  "tenantId" IN (
    SELECT tenant_id 
    FROM "UserTenant" 
    WHERE user_id = auth.uid()
  )
);
```

#### **Organization Table Policies**

```sql
-- Users can view organizations they belong to
CREATE POLICY "users_view_own_organizations"
ON "Organization"
FOR SELECT
USING (
  id IN (
    SELECT "organizationId" 
    FROM "Tenant" 
    WHERE id IN (
      SELECT tenant_id 
      FROM "UserTenant" 
      WHERE user_id = auth.uid()
    )
  )
);

-- Only organization owners can update
CREATE POLICY "owners_update_organizations"
ON "Organization"
FOR UPDATE
USING ("ownerId" = auth.uid());
```

#### **Admin-Only Policies**

```sql
-- Only admins can access platform settings
CREATE POLICY "admins_access_platform_settings"
ON "PlatformSettings"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "User" 
    WHERE id = auth.uid() 
    AND role = 'ADMIN'
  )
);
```

### **Phase 3: Service Role Considerations**

**Current Setup:**
- Railway API uses `SUPABASE_SERVICE_ROLE_KEY`
- Service role **bypasses RLS**
- This is intentional for server-side operations

**Why this is okay:**
- API enforces tenant isolation in code
- RLS acts as safety net for direct database access
- Supabase dashboard respects RLS

**When to use anon key:**
- Client-side queries (if you add them)
- User-facing Supabase client
- When you want RLS to enforce isolation

---

## 🧪 Testing RLS Policies

### **Test 1: Verify Tenant Isolation**

```sql
-- Set user context (simulate user login)
SET request.jwt.claim.sub = 'user-id-here';

-- Try to access another tenant's data
SELECT * FROM "InventoryItem" WHERE "tenantId" = 'other-tenant-id';
-- Should return 0 rows
```

### **Test 2: Verify User Can Access Own Data**

```sql
-- Set user context
SET request.jwt.claim.sub = 'user-id-here';

-- Access own tenant's data
SELECT * FROM "InventoryItem" WHERE "tenantId" = 'my-tenant-id';
-- Should return items
```

### **Test 3: Verify Service Role Bypass**

```sql
-- Using service role key
SELECT * FROM "InventoryItem";
-- Should return ALL items (bypasses RLS)
```

---

## 🔒 Security Best Practices

### **1. Defense in Depth**

**Layer 1: Application Code**
- ✅ Validate tenantId in every API route
- ✅ Check user permissions
- ✅ Sanitize inputs

**Layer 2: Database RLS**
- ✅ Enable RLS on all tables
- ✅ Create restrictive policies
- ✅ Test policies thoroughly

**Layer 3: Network Security**
- ✅ Use HTTPS everywhere
- ✅ Secure API keys
- ✅ Rate limiting

### **2. Audit Checklist**

**Before Enabling RLS:**
- [ ] Review all API routes for tenant checks
- [ ] Test policies in development
- [ ] Create rollback plan
- [ ] Document all policies

**After Enabling RLS:**
- [ ] Test all user flows
- [ ] Verify service role still works
- [ ] Monitor for access errors
- [ ] Update documentation

### **3. Common Pitfalls**

❌ **Don't:**
- Enable RLS without policies (blocks everything)
- Use `auth.uid()` without checking it exists
- Forget to handle NULL cases
- Mix service role and anon key carelessly

✅ **Do:**
- Test policies before production
- Use service role only in trusted backend
- Log policy violations
- Regular security audits

---

## 📊 Monitoring & Compliance

### **Audit Logging**

Enable Supabase audit logs:
1. Supabase Dashboard → Database → Logs
2. Monitor RLS policy violations
3. Track unauthorized access attempts

### **GDPR Compliance**

RLS helps with:
- ✅ Data isolation (Article 32)
- ✅ Access control (Article 25)
- ✅ Audit trail (Article 30)
- ✅ Right to deletion (Article 17)

### **Regular Reviews**

**Monthly:**
- Review RLS policies
- Check for policy violations
- Update policies as schema changes

**Quarterly:**
- Full security audit
- Penetration testing
- Policy effectiveness review

---

## 🚀 Rollout Plan

### **Step 1: Development Environment** (Week 1)
1. Enable RLS on dev database
2. Create all policies
3. Test thoroughly
4. Fix any issues

### **Step 2: Staging Environment** (Week 2)
1. Apply same policies to staging
2. Run integration tests
3. Test with real data
4. Performance testing

### **Step 3: Production** (Week 3)
1. Schedule maintenance window
2. Enable RLS during low-traffic period
3. Monitor closely for 24 hours
4. Rollback plan ready

---

## 🆘 Troubleshooting

### **Problem: "No rows returned" after enabling RLS**

**Cause**: Policy too restrictive or auth context missing

**Solution:**
```sql
-- Check if auth.uid() is set
SELECT auth.uid();

-- Verify user has tenant access
SELECT * FROM "UserTenant" WHERE user_id = auth.uid();
```

### **Problem: Service role queries fail**

**Cause**: Using anon key instead of service role

**Solution:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` in Railway
- Check Prisma connection string
- Service role should bypass RLS

### **Problem: Performance degradation**

**Cause**: Complex RLS policies slow down queries

**Solution:**
- Add indexes on columns used in policies
- Simplify policy logic
- Consider materialized views

---

## 📚 Resources

**Supabase RLS Docs:**
- https://supabase.com/docs/guides/auth/row-level-security
- https://supabase.com/docs/guides/database/postgres/row-level-security

**PostgreSQL RLS Docs:**
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html

**Security Best Practices:**
- https://cheatsheetseries.owasp.org/cheatsheets/Multi-tenancy_Cheat_Sheet.html

---

## ✅ Action Items

**Immediate (This Week):**
- [ ] Enable RLS on all tables
- [ ] Create basic tenant isolation policies
- [ ] Test in development
- [ ] Document any issues

**Short Term (This Month):**
- [ ] Apply to staging
- [ ] Integration testing
- [ ] Performance testing
- [ ] Deploy to production

**Long Term (Ongoing):**
- [ ] Regular security audits
- [ ] Policy reviews
- [ ] Compliance checks
- [ ] User access audits

---

**Last Updated**: October 31, 2025  
**Status**: Documentation Complete - Implementation Pending  
**Owner**: Platform Team  
**Review Date**: Monthly
