# Staging Test Checklist - Tiered Propagation

**Deployed to Staging:** November 12, 2025 6:06am  
**Commit:** 1121861

---

## 🧪 Quick Test Scenarios

### **1. Dashboard Welcome Messages**

**Starter Tier:**
- [ ] Login as Starter tier user
- [ ] Check dashboard welcome message
- [ ] Should say: "🏪 You Now Have Your Own Storefront + Multi-Location Power!"
- [ ] Should list: "✨ Multi-Location Propagation" as NEW feature

**Professional Tier:**
- [ ] Login as Professional tier user
- [ ] Check dashboard welcome message
- [ ] Should say: "⚡ Automation + Full Propagation Suite Unlocked!"
- [ ] Should list: "✨ Full Propagation Suite" as NEW feature

---

### **2. Product Propagation (Starter Tier)**

**Test with 3 locations:**
- [ ] Login as Starter tier user with 3 locations
- [ ] Go to Items page
- [ ] Click "Propagate" on a product
- [ ] Should work ✅
- [ ] Product should propagate to other locations

**Test with 1 location:**
- [ ] Login as Starter tier user with 1 location
- [ ] Propagate button should be disabled or show error
- [ ] Error should say: "Need 2+ locations"

---

### **3. Tier Upgrade Messages**

**Starter trying to propagate hours:**
- [ ] Login as Starter tier user
- [ ] Try to propagate business hours (if route exists)
- [ ] Should get error: "Professional tier required"
- [ ] Error should include upgrade URL

**Professional trying to propagate brand assets:**
- [ ] Login as Professional tier user
- [ ] Try to propagate brand assets (if route exists)
- [ ] Should get error: "Organization tier required"
- [ ] Error should include upgrade URL

---

### **4. Role-Based Access**

**VIEWER role:**
- [ ] Login as VIEWER
- [ ] Should NOT see propagate buttons
- [ ] Or should get "Tenant admin required" error

**MEMBER role:**
- [ ] Login as MEMBER
- [ ] Should NOT be able to propagate
- [ ] Should get "Tenant admin required" error

**ADMIN role:**
- [ ] Login as ADMIN
- [ ] Should be able to propagate ✅

---

### **5. Features Page**

- [ ] Go to /features page
- [ ] Find "Multi-Location Management" section
- [ ] Should have "STARTER+" badge (not "ENTERPRISE")
- [ ] Should mention tiered features:
  - Starter: Products & user roles
  - Professional: + Hours, profile, categories, GBP, flags
  - Organization: + Brand assets, advanced features

---

### **6. Offerings Page**

- [ ] Go to /settings/offerings page
- [ ] Find propagation card
- [ ] Should be in Starter section (not Organization)
- [ ] Should have "STARTER+" badge
- [ ] Should say "Available on Starter tier with 2+ locations!"

---

### **7. API Endpoints (Optional)**

**Test with Postman/curl:**

```bash
# Product propagation (Starter tier)
POST /api/organizations/{orgId}/items/propagate
Headers: Authorization: Bearer {token}
Body: { sourceItemId, targetTenantIds }

# Expected: Works for Starter+ with 2+ locations
# Expected: 403 for insufficient locations
# Expected: 403 for tier upgrade required
```

---

## ⚠️ Critical Issues to Watch For

**High Priority:**
- [ ] Starter users can actually propagate products
- [ ] Professional users can propagate hours/categories
- [ ] Organization users can propagate everything
- [ ] Single-location users get clear error messages
- [ ] Tier upgrade errors include upgrade URLs

**Medium Priority:**
- [ ] Dashboard welcome messages are correct
- [ ] Features page shows correct tier
- [ ] Offerings page shows correct tier
- [ ] Tooltips say "Starter+ with 2+ locations"

**Low Priority:**
- [ ] Documentation is accurate
- [ ] No console errors
- [ ] Loading states work

---

## 🚨 Rollback Plan (If Needed)

If critical issues found:

```bash
# Revert to previous commit
git revert 1121861
git push origin staging

# Or reset to previous state
git reset --hard 01bd3bf
git push origin staging --force
```

---

## ✅ Sign-Off Checklist

After testing, confirm:

- [ ] Starter tier propagation works
- [ ] Professional tier propagation works
- [ ] Organization tier propagation works
- [ ] Error messages are clear
- [ ] Dashboard messages are correct
- [ ] No critical bugs found

**If all ✅, proceed to production!**

---

## 📝 Notes

**Staging URL:** https://aps.visibleshelf.store  
**Commit:** 1121861  
**Files Changed:** 26 files, 4311 insertions, 63 deletions

**Test Duration:** ~15-20 minutes for full checklist
