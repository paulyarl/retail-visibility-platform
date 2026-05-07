# Final Integration Steps
## Complete the Last 35 Errors

**Current Status**: 98 → 35 errors (64% reduction complete!)

---

## Step 1: Install Radix UI Dependencies (Required)

```bash
cd apps/web
pnpm add @radix-ui/react-switch @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-radio-group @radix-ui/react-progress
```

**This will fix 10 errors** (all the "Cannot find module '@radix-ui/..." errors)

---

## Step 2: Fix Remaining Code Issues (25 errors)

### A. Fix MFASetupWizard.tsx (2 errors)

**File**: `apps/web/src/components/security/mfa/MFASetupWizard.tsx`

**Line 48-49**, change:
```typescript
const result = await verifySetup(verificationCode);
setBackupCodes(result.backupCodes);
```

To:
```typescript
const result = await verifySetup({ verificationCode });
if (result && typeof result !== 'boolean') {
  setBackupCodes(result.backupCodes || []);
}
```

---

### B. Fix Service Call Parameters (2 errors)

**File 1**: `apps/web/src/components/security/monitoring/BlockedIPsTable.tsx`

**Line 27**, change:
```typescript
await securityMonitoringService.unblockIP(ipAddress);
```

To:
```typescript
await securityMonitoringService.unblockIP(ipAddress, 'Unblocked via UI');
```

**File 2**: `apps/web/src/components/security/monitoring/ThreatMonitor.tsx`

**Line 27**, change:
```typescript
await securityMonitoringService.resolveThreat(threatId);
```

To:
```typescript
await securityMonitoringService.resolveThreat(threatId, 'Resolved via UI');
```

---

### C. Fix SecurityDashboard Badge Variant (1 error)

**File**: `apps/web/src/components/security/monitoring/SecurityDashboard.tsx`

**Line 30-40**, change:
```typescript
const variants = {
  healthy: 'success',
  warning: 'warning',
  critical: 'error',
} as const;
```

To:
```typescript
const variants: Record<string, 'success' | 'warning' | 'error'> = {
  healthy: 'success',
  warning: 'warning',
  critical: 'error',
  error: 'error',
};
```

---

### D. Fix SecuritySettings.tsx (5 errors)

**File**: `apps/web/src/components/security/SecuritySettings.tsx`

**Line 12**, change:
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
```

To:
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
```

**Check your Tabs component** - it may need to accept `children` prop. If errors persist, update the Tabs component interface.

---

### E. Fix Button Variants (4 errors)

**File 1**: `apps/web/src/components/security/shared/LoginActivityTable.tsx`

**Line 94**, change:
```typescript
variant="outline"
```

To:
```typescript
variant="secondary"
```

**File 2**: `apps/web/src/components/security/shared/SecurityAlerts.tsx`

**Line 91**, change:
```typescript
size="icon"
```

To:
```typescript
size="sm"
```

**Line 105**, change:
```typescript
variant={action.action === 'take_action' ? 'default' : 'outline'}
```

To:
```typescript
variant={action.action === 'take_action' ? 'primary' : 'secondary'}
```

---

### F. Fix Badge Variants (2 errors)

**File 1**: `apps/web/src/components/security/shared/LoginActivityTable.tsx`

**Line 125**, change:
```typescript
<Badge variant="secondary" className="mt-1">
```

To:
```typescript
<Badge variant="default" className="mt-1">
```

**File 2**: `apps/web/src/components/security/shared/SecurityAlerts.tsx`

**Line 79**, change:
```typescript
<Badge variant="secondary" className="text-xs">
```

To:
```typescript
<Badge variant="default" className="text-xs">
```

---

### G. Fix Type Annotations (3 errors)

**File**: `apps/web/src/components/security/gdpr/DataExportWidget.tsx`

**Line 57**, change:
```typescript
onValueChange={(v) => setFormat(v as 'json' | 'csv')}
```

To:
```typescript
onValueChange={(v: string) => setFormat(v as 'json' | 'csv')}
```

**Line 79**, change:
```typescript
onCheckedChange={(checked) => setIncludeMetadata(checked as boolean)}
```

To:
```typescript
onCheckedChange={(checked: boolean) => setIncludeMetadata(checked)}
```

**File**: `apps/web/src/components/security/mfa/BackupCodesDisplay.tsx`

**Line 102**, change:
```typescript
onCheckedChange={(checked) => setConfirmed(checked as boolean)}
```

To:
```typescript
onCheckedChange={(checked: boolean) => setConfirmed(checked)}
```

---

### H. Fix Select Component Issues (6 errors)

**File**: `apps/web/src/components/security/gdpr/PreferenceEditor.tsx`

Your Select component may not export all required sub-components. Check if your Select.tsx exports:
- SelectContent
- SelectItem
- SelectTrigger
- SelectValue

If missing, add them to your Select component or update the import to match your actual Select API.

**Temporary fix** - Line 59, change:
```typescript
onValueChange={(newValue) => {
```

To:
```typescript
onChange={(newValue: string) => {
```

(Adjust based on your actual Select component API)

---

## Step 3: Verify Everything Works

```bash
# From project root
cd apps/web

# Check TypeScript
npx tsc --noEmit

# Expected: 0 errors (or very few)

# Build
pnpm build

# Run dev
pnpm dev
```

---

## Quick Fix Script

Run these commands in order:

```bash
# 1. Install dependencies
cd apps/web
pnpm add @radix-ui/react-switch @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-radio-group @radix-ui/react-progress

# 2. Return to root
cd ../..

# 3. Test
cd apps/web
npx tsc --noEmit
```

---

## Summary

**Total fixes needed**: 35 errors

- **10 errors**: Install Radix UI dependencies (1 command)
- **25 errors**: Code fixes (mostly find-and-replace)

**Estimated time**: 10-15 minutes

**After completion**: All 23 security components will be fully integrated and ready to use! 🎉
