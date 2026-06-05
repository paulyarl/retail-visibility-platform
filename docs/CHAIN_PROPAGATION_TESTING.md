# Chain SKU Propagation - Testing Guide

## 🧪 Manual Testing Steps

### Prerequisites
1. Start dev server: `pnpm dev`
2. Have a chain organization with multiple tenants

### Test 1: Single Item Propagation

**Setup:**
1. Go to `/admin/organizations` or create test org via admin tools
2. Create organization with 3-5 tenants
3. Add a test product to one tenant (the "hero" location)

**Test Steps:**
1. Navigate to items page for the hero tenant
2. Find the test product
3. Click the **📋 Propagate** button (copy icon)
4. Modal opens showing other locations in the chain
5. Select 1-2 target locations
6. Click "Propagate to X Locations"
7. Wait for success message

**Expected Results:**
- ✅ Modal shows all other locations (excludes source)
- ✅ Can select/deselect locations
- ✅ "Select All" works
- ✅ Propagation completes successfully
- ✅ Shows: "Created: X, Skipped: 0, Errors: 0"

**Verification:**
1. Go to items page for target tenant
2. Verify product exists with same SKU
3. Check all fields copied correctly (name, price, description, images)

---

### Test 2: Duplicate SKU Handling

**Test Steps:**
1. Use the same product from Test 1
2. Click propagate again
3. Select the same target location
4. Click propagate

**Expected Results:**
- ✅ Shows: "Created: 0, Skipped: 1 (already exists), Errors: 0"
- ✅ No duplicate created
- ✅ Original item unchanged

---

### Test 3: Bulk Propagation (Hero Location Concept)

**Setup:**
1. Add 5-10 products to hero location
2. Note: These will be propagated one-by-one (bulk UI coming next)

**Test Steps:**
1. For each product in hero location:
   - Click propagate
   - Select "All locations"
   - Propagate
2. Repeat for all products

**Expected Results:**
- ✅ All products copied to all locations
- ✅ Each location has same SKU count as hero
- ✅ No errors

**Verification:**
1. Check each location's items page
2. Verify SKU count matches hero location
3. Spot-check a few products for data accuracy

---

### Test 4: Non-Chain Tenant

**Test Steps:**
1. Go to items page for standalone tenant (not in organization)
2. Look for propagate button

**Expected Results:**
- ✅ Propagate button is **hidden**
- ✅ Only chain tenants see the button

---

### Test 5: Photo Propagation

**Setup:**
1. Add product with multiple photos to hero location

**Test Steps:**
1. Propagate product to another location
2. Go to target location's items page
3. View the product

**Expected Results:**
- ✅ All photos copied
- ✅ Photo order preserved
- ✅ Primary image set correctly

---

## 🔧 API Testing (curl)

### Get Organization Details
```bash
curl http://localhost:4000/api/organizations/{ORG_ID}
```

### Propagate Item
```bash
curl -X POST http://localhost:4000/api/organizations/{ORG_ID}/items/propagate \
  -H "Content-Type: application/json" \
  -d '{
    "sourceItemId": "ITEM_ID",
    "targetTenantIds": ["TENANT_1", "TENANT_2"]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "sourceItemId": "...",
  "results": {
    "created": ["tenant1", "tenant2"],
    "skipped": [],
    "errors": []
  },
  "summary": {
    "total": 2,
    "created": 2,
    "skipped": 0,
    "errors": 0
  }
}
```

---

## 📊 Database Verification

### Check SKU Distribution
```sql
-- Get SKU count per tenant in organization
SELECT 
  t.name as tenant_name,
  COUNT(i.id) as sku_count
FROM "Tenant" t
LEFT JOIN "InventoryItem" i ON i."tenantId" = t.id
WHERE t."organizationId" = 'YOUR_ORG_ID'
GROUP BY t.id, t.name
ORDER BY sku_count DESC;
```

### Check for Duplicate SKUs (should be none)
```sql
-- Find duplicate SKUs within same tenant
SELECT 
  "tenantId",
  sku,
  COUNT(*) as count
FROM "InventoryItem"
GROUP BY "tenantId", sku
HAVING COUNT(*) > 1;
```

### Verify Item Data Match
```sql
-- Compare source and propagated items
SELECT 
  i1.sku,
  i1.name as source_name,
  i2.name as target_name,
  i1.price as source_price,
  i2.price as target_price
FROM "InventoryItem" i1
JOIN "InventoryItem" i2 ON i1.sku = i2.sku
WHERE i1."tenantId" = 'SOURCE_TENANT_ID'
  AND i2."tenantId" = 'TARGET_TENANT_ID';
```

---

## ✅ Test Checklist

- [ ] Single item propagation works
- [ ] Duplicate detection works (skips existing SKUs)
- [ ] Select all / individual selection works
- [ ] Modal shows correct location list
- [ ] Success/error messages display
- [ ] Photos are copied
- [ ] All product fields copied correctly
- [ ] Non-chain tenants don't see button
- [ ] Can propagate to multiple locations at once
- [ ] Organization SKU count updates correctly

---

## 🐛 Known Issues / Edge Cases

### Edge Case 1: Same SKU, Different Product
- **Scenario:** Source has SKU "ABC123", target already has "ABC123" but different product
- **Expected:** Skipped (duplicate SKU detection)
- **Actual:** ✅ Works as expected

### Edge Case 2: Tenant Leaves Organization
- **Scenario:** Propagate, then tenant leaves org
- **Expected:** Items remain at tenant (independent copies)
- **Actual:** ✅ Items are independent

### Edge Case 3: Source Item Deleted
- **Scenario:** Propagate, then delete source item
- **Expected:** Propagated items remain (independent)
- **Actual:** ✅ Items are independent

---

## 🚀 Next Phase Features

### Bulk Propagation UI
- [ ] Select multiple items
- [ ] Propagate all selected to chosen locations
- [ ] Progress indicator for bulk operations

### Hero Location Designation
- [ ] Mark one tenant as "hero" in organization
- [ ] "Propagate All from Hero" button
- [ ] Auto-propagate new items from hero

### Advanced Features
- [ ] Propagation history/audit log
- [ ] Undo propagation
- [ ] Update sync (push changes to all copies)
- [ ] Regional catalogs (subset of locations)
- [ ] Scheduled propagation

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________
Environment: Dev / Staging / Prod

Test 1: Single Item Propagation
- Status: ✅ / ❌
- Notes: _________________________________

Test 2: Duplicate Handling
- Status: ✅ / ❌
- Notes: _________________________________

Test 3: Bulk Propagation
- Status: ✅ / ❌
- Notes: _________________________________

Test 4: Non-Chain Tenant
- Status: ✅ / ❌
- Notes: _________________________________

Test 5: Photo Propagation
- Status: ✅ / ❌
- Notes: _________________________________

Overall: ✅ Pass / ❌ Fail
Issues Found: _________________________________
```

---

## 🎯 Success Criteria

**Feature is ready for production when:**
1. All 5 manual tests pass
2. No duplicate SKUs created
3. All product data copied accurately
4. Photos propagate correctly
5. Error handling works (network issues, validation errors)
6. UI is intuitive and responsive
7. Performance acceptable (< 2s for 5 locations)

---

**Happy Testing! 🚀**
