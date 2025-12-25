# Integration Fix Guide
## Step-by-Step Solutions for All Known Issues

**Last Updated**: December 24, 2025  
**Status**: Ready for Implementation

---

## 🎯 Quick Start

Run the test script first to identify issues:
```powershell
.\test-integration-issues.ps1
```

Then follow the fixes below in order.

---

## ✅ Fix 1: Install Missing Dependencies

### Issue
`date-fns` is not installed, causing import errors.

### Solution
```bash
cd apps/web
pnpm add date-fns
```

### Verification
```bash
pnpm list date-fns
```

**Expected**: Should show date-fns version installed.

---

## ✅ Fix 2: Add Missing UI Components

### Issue
Missing UI components: Switch, Checkbox, Dialog, Select, RadioGroup, Progress, Textarea

### Solution A: Install from shadcn/ui (Recommended)
```bash
cd apps/web
npx shadcn-ui@latest add switch
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add select
npx shadcn-ui@latest add radio-group
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add textarea
```

### Solution B: Create Manually
If shadcn/ui is not configured, create basic versions:

**Switch.tsx**:
```typescript
// apps/web/src/components/ui/Switch.tsx
import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
```

**Checkbox.tsx**:
```typescript
// apps/web/src/components/ui/Checkbox.tsx
import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
```

### Required Dependencies
```bash
pnpm add @radix-ui/react-switch @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-radio-group @radix-ui/react-progress
```

---

## ✅ Fix 3: Update Hook APIs

### Issue
Hooks have different method names than components expect.

### Fix 3.1: Update useMFA.ts

**Location**: `apps/web/src/hooks/useMFA.ts`

**Changes needed**:
```typescript
// Current (lines 20-30)
export function useMFA() {
  // ... existing code ...
  
  return {
    status,
    setupData,
    loading,
    error,
    initializeSetup,
    verifySetup,
    disable,
    regenerateCodes,
    refresh,
  };
}

// Change to:
export function useMFA() {
  // ... existing code ...
  
  // Add these wrapper methods
  const setupMFA = async () => {
    const data = await initializeSetup();
    return {
      qrCode: data.qrCodeUrl,
      secret: data.secret,
    };
  };

  const verifyLogin = async (code: string) => {
    // Implement MFA verification for login
    return await mfaService.verifyLogin(code);
  };

  const disableMFA = async () => {
    return await disable();
  };

  const regenerateBackupCodes = async () => {
    const codes = await regenerateCodes(''); // May need verification code
    return codes;
  };

  return {
    status,
    setupData,
    loading,
    error,
    // Original methods
    initializeSetup,
    verifySetup,
    disable,
    regenerateCodes,
    refresh,
    // New aliases for components
    setupMFA,
    verifyLogin,
    mfaStatus: status, // Alias
    disableMFA,
    regenerateBackupCodes,
  };
}
```

### Fix 3.2: Update useSecurityMonitoring.ts

**Location**: `apps/web/src/hooks/useSecurityMonitoring.ts`

**Changes needed**:
```typescript
// Around line 17, change:
export function useSecurityMonitoring() {
  // ... existing code ...
  
  return {
    metrics,
    threats,
    blockedIPs,
    health, // Current name
    // ... rest
  };
}

// To:
export function useSecurityMonitoring() {
  // ... existing code ...
  
  return {
    metrics,
    threats,
    blockedIPs,
    health,
    healthStatus: health, // Add alias
    // ... rest
  };
}
```

---

## ✅ Fix 4: Update Type Definitions

### Issue
Some types are missing fields that components expect.

### Fix 4.1: Update SecurityThreat Type

**Location**: `apps/web/src/types/security.ts`

**Find** (around line 60):
```typescript
export interface SecurityThreat {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}
```

**Replace with**:
```typescript
export interface SecurityThreat {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  description: string;
  source: string;
  detectedAt: string;
  resolvedAt?: string;
  affectedResources: string[];
  timestamp: string; // Keep for backwards compatibility
}
```

### Fix 4.2: Update BlockedIP Type

**Location**: `apps/web/src/types/security.ts`

**Find** (around line 90):
```typescript
export interface BlockedIP {
  ipAddress: string;
  reason: string;
  blockedAt: string;
  expiresAt?: string;
}
```

**Replace with**:
```typescript
export interface BlockedIP {
  ipAddress: string;
  reason: string;
  blockedAt: string;
  expiresAt?: string;
  permanent: boolean;
  attempts?: number;
}
```

---

## ✅ Fix 5: Fix Import Casing Issues

### Issue
Inconsistent casing in UI component imports causes errors on case-sensitive systems.

### Solution
Use a find-and-replace across all security components:

**Find**: `@/components/ui/card`  
**Replace**: `@/components/ui/Card`

**Find**: `@/components/ui/button`  
**Replace**: `@/components/ui/Button`

**Find**: `@/components/ui/badge`  
**Replace**: `@/components/ui/Badge`

### Files to Update
- `apps/web/src/components/security/SecuritySettings.tsx`
- `apps/web/src/components/security/shared/LoginActivityTable.tsx`
- `apps/web/src/components/security/shared/SecurityAlerts.tsx`

### VS Code Regex Replace
1. Open Find in Files (Ctrl+Shift+F)
2. Enable regex (Alt+R)
3. Find: `from ['"]@/components/ui/(card|button|badge)['"]`
4. Replace: `from '@/components/ui/$1' // Note: capitalize first letter manually`

---

## ✅ Fix 6: Fix Button/Badge Variants

### Issue
Components use variants that don't exist in your Button/Badge components.

### Solution A: Update Component Variants

**Check your Button component** (`apps/web/src/components/ui/Button.tsx`):

If it doesn't have `outline` variant, either:
1. Add the variant to Button.tsx
2. Or replace `variant="outline"` with `variant="secondary"` in components

**Check your Badge component** (`apps/web/src/components/ui/Badge.tsx`):

If it doesn't have `success`, `error`, `info` variants, either:
1. Add these variants
2. Or map them to existing variants:
   - `success` → `default` (with green styling)
   - `error` → `destructive`
   - `info` → `secondary`

### Solution B: Update Components to Use Existing Variants

**Find and replace in security components**:

For Button:
- `variant="outline"` → `variant="secondary"`
- `variant="default"` → `variant="primary"`

For Badge:
- `variant="success"` → `variant="default"` (add custom className for green)
- `variant="error"` → `variant="destructive"`
- `variant="info"` → `variant="secondary"`

---

## ✅ Fix 7: Update MFA Component Logic

### Issue
MFA components expect different return types from hooks.

### Fix: Update MFASetupWizard.tsx

**Location**: `apps/web/src/components/security/mfa/MFASetupWizard.tsx`

**Find** (around line 20):
```typescript
const { setupMFA, verifySetup, loading } = useMFA();
```

**Replace with**:
```typescript
const { setupMFA, verifySetup, loading, status } = useMFA();
```

**Find** (around line 48):
```typescript
const result = await verifySetup(verificationCode);
setBackupCodes(result.backupCodes);
```

**Replace with**:
```typescript
const result = await verifySetup({ code: verificationCode });
if (result && typeof result !== 'boolean') {
  setBackupCodes(result.backupCodes || []);
} else {
  // Handle boolean return - fetch backup codes separately
  const codes = await regenerateBackupCodes();
  setBackupCodes(codes);
}
```

---

## ✅ Fix 8: Add Missing Service Methods

### Issue
Services may be missing methods that hooks expect.

### Fix: Update mfa.ts Service

**Location**: `apps/web/src/services/mfa.ts`

**Add this method** (if missing):
```typescript
export async function verifyLogin(code: string): Promise<boolean> {
  const response = await apiClient.post('/api/mfa/verify-login', { code });
  return response.data.verified;
}
```

---

## 🧪 Testing After Fixes

### 1. Run TypeScript Check
```bash
cd apps/web
npx tsc --noEmit
```

**Expected**: 0 errors (or significantly reduced)

### 2. Run Build
```bash
pnpm build
```

**Expected**: Successful build

### 3. Run Dev Server
```bash
pnpm dev
```

**Expected**: No console errors on startup

### 4. Test Components
Navigate to:
- `/settings/security` - Test Phase 1 components
- `/settings/consent` - Test Phase 2 consent
- `/settings/preferences` - Test Phase 2 preferences
- `/settings/mfa` - Test Phase 3 MFA
- `/admin/security` - Test Phase 3 monitoring

---

## 📋 Checklist

Use this checklist to track your progress:

- [ ] Install date-fns
- [ ] Add Switch component
- [ ] Add Checkbox component
- [ ] Add Dialog component
- [ ] Add Select component
- [ ] Add RadioGroup component
- [ ] Add Progress component
- [ ] Add Textarea component
- [ ] Update useMFA.ts hook
- [ ] Update useSecurityMonitoring.ts hook
- [ ] Update SecurityThreat type
- [ ] Update BlockedIP type
- [ ] Fix import casing (Card, Button, Badge)
- [ ] Fix Button variants
- [ ] Fix Badge variants
- [ ] Update MFASetupWizard logic
- [ ] Add verifyLogin service method
- [ ] Run TypeScript check
- [ ] Run build
- [ ] Test in browser

---

## 🚨 Common Errors and Solutions

### Error: "Cannot find module 'date-fns'"
**Solution**: Run `pnpm add date-fns`

### Error: "Cannot find module '@/components/ui/Switch'"
**Solution**: Install or create Switch component (see Fix 2)

### Error: "Property 'setupMFA' does not exist"
**Solution**: Update useMFA.ts hook (see Fix 3.1)

### Error: "Type 'outline' is not assignable"
**Solution**: Update Button variants (see Fix 6)

### Error: "Property 'status' does not exist on type 'SecurityThreat'"
**Solution**: Update SecurityThreat type (see Fix 4.1)

---

## 📞 Need Help?

If you encounter issues not covered here:

1. Check the TypeScript error message carefully
2. Look for the file and line number
3. Compare with the expected type/interface
4. Update accordingly

Most issues fall into these categories:
- Missing dependencies
- Missing UI components
- Hook API mismatches
- Type definition gaps
- Import casing

Follow the fixes in order, and most issues will resolve! 🎯
