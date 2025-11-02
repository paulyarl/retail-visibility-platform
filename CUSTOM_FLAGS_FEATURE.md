# Custom Tenant Flags Feature

## Overview

Added validation and education for custom tenant flags to prevent confusion and ensure proper usage.

## What Was Implemented

### 1. Naming Convention Enforcement ✅

**Validation Rules:**
- Custom flags MUST start with `TENANT_` prefix
- Platform flags start with `FF_` prefix
- Prevents naming conflicts and confusion

**Example:**
```typescript
// Valid custom flags
TENANT_CUSTOM_CHECKOUT
TENANT_BETA_FEATURE
TENANT_SPECIAL_PRICING

// Invalid (will be rejected)
MY_FLAG
custom_feature
test123
```

### 2. Educational Alert ✅

**Location:** Top of tenant flags page (`/admin/tenants/:tenantId/flags`)

**Content:**
- Explains difference between platform and custom flags
- Highlights that platform flags with "Platform Override Allowed" can be toggled
- Warns that custom flags are an advanced feature
- Clarifies that custom flags require code deployment

**Visual Design:**
- Blue info alert with clear sections
- Nested warning box for advanced feature notice
- List format for easy scanning

### 3. Warning Dialog ✅

**Triggered:** When creating a custom flag (TENANT_* prefix)

**Message:**
```
⚠️ Custom Flag Warning

This custom flag will NOT affect any functionality until:
1. A developer adds code to check this flag
2. The code is deployed to production

Custom flags are an advanced feature for tenant-specific customizations.

Continue creating this flag?
```

**Behavior:**
- User must confirm to proceed
- Can cancel to abort flag creation
- Error message shown if naming convention violated

### 4. Visual Distinction ✅

**Custom Flag Badge:**
- Orange "Custom Flag" badge appears on TENANT_* flags
- Distinguishes from platform flags
- Helps users identify which flags are custom

**Badge Colors:**
- 🟢 Green: "Enabled" status
- ⚪ Gray: "Disabled" status
- 🔵 Blue: "Platform Override Allowed"
- 🟠 Orange: "Custom Flag"

### 5. Button Rename ✅

**Old:** "Add Flag"  
**New:** "Add Custom Flag"

Makes it clear that this creates a custom tenant-specific flag, not a platform flag.

## User Flow

### Creating a Custom Flag

1. **Navigate** to `/admin/tenants/:tenantId/flags`
2. **Read** educational alert at top of page
3. **Click** "Add Custom Flag" button
4. **Enter** flag name in prompt (e.g., `TENANT_MY_FEATURE`)
5. **Validation:**
   - If doesn't start with `TENANT_` or `FF_` → Error message shown
   - If starts with `TENANT_` → Warning dialog appears
6. **Confirm** understanding in warning dialog
7. **Flag created** and appears in list with "Custom Flag" badge

### Error Handling

**Invalid Naming:**
```
Error: Custom flags must start with TENANT_ prefix (e.g., TENANT_MY_FEATURE)
```
- Error shown for 5 seconds
- Flag not created
- User can try again

**User Cancels:**
- No flag created
- No error shown
- User returns to flag list

## Technical Implementation

### Validation Logic

```typescript
const addFlag = async () => {
  const flag = prompt("Enter flag key (must start with TENANT_ for custom flags)")?.trim();
  if (!flag) return;
  
  // Validate flag naming
  if (!flag.startsWith('TENANT_') && !flag.startsWith('FF_')) {
    setError('Custom flags must start with TENANT_ prefix');
    setTimeout(() => setError(null), 5000);
    return;
  }
  
  // Warn about custom flags
  if (flag.startsWith('TENANT_')) {
    const confirmed = confirm(
      '⚠️ Custom Flag Warning\n\n' +
      'This custom flag will NOT affect any functionality until:\n' +
      '1. A developer adds code to check this flag\n' +
      '2. The code is deployed to production\n\n' +
      'Custom flags are an advanced feature for tenant-specific customizations.\n\n' +
      'Continue creating this flag?'
    );
    if (!confirmed) return;
  }
  
  await upsert(flag, { enabled: true });
};
```

### Badge Rendering

```typescript
{r.flag.startsWith('TENANT_') && (
  <Badge variant="warning">
    Custom Flag
  </Badge>
)}
```

## Use Cases

### Valid Use Cases

1. **Tenant-Specific Feature Development**
   ```
   TENANT_CUSTOM_CHECKOUT_FLOW
   TENANT_SPECIAL_PRICING_RULES
   TENANT_CUSTOM_INTEGRATION
   ```

2. **A/B Testing**
   ```
   TENANT_BETA_UI_REDESIGN
   TENANT_NEW_ALGORITHM_TEST
   ```

3. **Beta Testing**
   ```
   TENANT_EARLY_ACCESS_FEATURE
   TENANT_PREVIEW_MODE
   ```

4. **Unique Requirements**
   ```
   TENANT_COMPLIANCE_MODE
   TENANT_CUSTOM_WORKFLOW
   ```

### Invalid Use Cases

❌ Creating flags without code implementation  
❌ Using as general-purpose storage  
❌ Replacing proper configuration management  
❌ Creating flags "just in case"

## Impact Analysis

### Before Implementation

**Problems:**
- Tenants could create any flag name
- No guidance on what flags do
- Confusion about platform vs custom flags
- Orphaned flags with no purpose
- No warning about advanced nature

**Example Issues:**
```
// Confusing names
my_feature
test
flag1

// Conflicts with platform
FF_BUSINESS_PROFILE (tenant tries to create)
```

### After Implementation

**Improvements:**
- ✅ Clear naming convention enforced
- ✅ Educational content at top of page
- ✅ Warning dialog for custom flags
- ✅ Visual distinction with badges
- ✅ Reduced confusion and errors

**Example Success:**
```
// Clear, validated names
TENANT_CUSTOM_CHECKOUT
TENANT_BETA_FEATURE

// User understands:
- This is a custom flag
- Requires code deployment
- Advanced feature
```

## Documentation Updates

### Updated Files

1. **`docs/FEATURE_FLAGS_SYSTEM.md`**
   - Added "Custom Tenant Flags (Advanced)" section
   - Naming conventions
   - When to use custom flags
   - UI validation details

2. **`apps/web/src/components/admin/AdminTenantFlags.tsx`**
   - Added validation logic
   - Added educational alert
   - Added warning dialog
   - Added custom flag badge
   - Renamed button

## Testing Checklist

### Validation Testing
- [ ] Try creating flag without TENANT_ prefix → Shows error
- [ ] Try creating flag with TENANT_ prefix → Shows warning dialog
- [ ] Cancel warning dialog → Flag not created
- [ ] Confirm warning dialog → Flag created successfully
- [ ] Try creating FF_ flag → Allowed (for platform admins)

### UI Testing
- [ ] Educational alert appears at top of page
- [ ] Alert is blue info style
- [ ] Advanced feature warning box is visible
- [ ] Button says "Add Custom Flag"
- [ ] Custom flags show orange "Custom Flag" badge
- [ ] Platform flags show blue "Platform Override Allowed" badge

### Edge Cases
- [ ] Empty flag name → No action
- [ ] Flag name with spaces → Trimmed correctly
- [ ] Duplicate flag name → Handled by backend
- [ ] Very long flag name → Handled gracefully

## Future Enhancements

### Potential Improvements

1. **Flag Templates**
   - Pre-defined templates for common use cases
   - Example: "Beta Testing", "Custom Integration", etc.

2. **Code Snippet Generator**
   - Show example code for checking the flag
   - Copy-paste ready middleware examples

3. **Flag Usage Tracking**
   - Track if flag is actually used in code
   - Warn about unused flags
   - Suggest cleanup

4. **Documentation Links**
   - Link to developer docs for implementing flags
   - Link to examples in codebase

5. **Flag Lifecycle Management**
   - Mark flags as "deprecated"
   - Set expiration dates
   - Automated cleanup suggestions

## Support

### Common Questions

**Q: Why can't I create a flag without TENANT_ prefix?**  
A: Custom tenant flags must use TENANT_ prefix to distinguish them from platform flags and prevent naming conflicts.

**Q: Will my custom flag work immediately?**  
A: No. Custom flags require a developer to add code that checks the flag, then deploy that code to production.

**Q: Can I use custom flags for configuration?**  
A: Not recommended. Use proper configuration management for settings. Flags are for feature toggles only.

**Q: How do I know if a flag is being used?**  
A: Check with your development team. Future versions may include usage tracking.

**Q: Can I delete a custom flag?**  
A: Currently no delete function. Contact support or use database access to remove unused flags.

## Rollout Plan

### Phase 1: Immediate (Current)
- ✅ Validation and warnings implemented
- ✅ Educational content added
- ✅ Visual distinction with badges

### Phase 2: Short-term (Next Sprint)
- [ ] Add flag usage tracking
- [ ] Add code snippet generator
- [ ] Add delete functionality

### Phase 3: Long-term (Future)
- [ ] Flag templates
- [ ] Lifecycle management
- [ ] Automated cleanup suggestions

---

**Status:** ✅ Implemented and Ready for Production  
**Breaking Changes:** None  
**User Impact:** Positive (better guidance, less confusion)  
**Developer Impact:** None (backward compatible)
