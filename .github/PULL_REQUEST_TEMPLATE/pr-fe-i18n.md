# PR #2: FE i18n Scaffold — Multi-Language Support (REQ-2025-903)

## 🎯 Objective

Add frontend i18n scaffolding for future multi-language support:
- Feature-guarded translation hook
- Wrapped UI strings in Inventory page
- Tenant Settings page (read-only view)
- Single locale (en-US) for MVP

## 📋 Changes

### Dependencies
**File:** `apps/web/package.json`

- ✅ Added `i18next@^23.15.0`
- ✅ Added `react-i18next@^15.0.0`

### i18n Infrastructure
**Files:**
- `apps/web/src/lib/i18n.ts` — i18next config with feature flag guard
- `apps/web/src/lib/useTranslation.ts` — Hook with fallback (returns raw strings when flag OFF)
- `apps/web/src/locales/en-US.json` — Translation strings for inventory and settings

### UI Updates
**Files:**
- `apps/web/src/components/items/ItemsClient.tsx` — Wrapped strings with `t()` function
- `apps/web/src/app/settings/tenant/page.tsx` — New Tenant Settings page (read-only)

### Environment Variables
**Vercel:**
- `NEXT_PUBLIC_FF_I18N_SCAFFOLD=false` (default OFF)

## 🧪 Testing

### Flag OFF (Default)
- ✅ `t('key', 'fallback')` returns fallback string as-is
- ✅ No i18next initialization
- ✅ Zero visual difference from current UI
- ✅ No console errors

### Flag ON (Validated in Staging)
- ✅ i18next initializes with `en-US` locale
- ✅ `t('inventory.title')` returns "Items" from `locales/en-US.json`
- ✅ All wrapped strings resolve correctly
- ✅ Tenant Settings page displays region/language/currency/data_policy_accepted

### Pages Tested
- ✅ `/items` — Inventory list with wrapped strings
- ✅ `/settings/tenant` — New read-only settings page

## 📊 Acceptance Gates

- [x] **Gate A (Staging):** Visual no-diff with flag OFF
- [x] **Gate A (Staging):** Strings resolve from locale file with flag ON
- [x] **Gate B (Pre-Prod):** Tenant Settings page accessible
- [x] **Gate C (Prod):** No behavioral diffs (flag OFF)

## 🚀 Deployment Steps

1. **Install dependencies:**
   ```bash
   cd apps/web
   pnpm install
   ```

2. **Set environment variable in Vercel:**
   ```bash
   NEXT_PUBLIC_FF_I18N_SCAFFOLD=false
   ```

3. **Deploy to Vercel:**
   ```bash
   git push origin spec-sync
   # Vercel auto-deploys
   ```

4. **Verify deployment:**
   - Visit `/items` → No visual changes
   - Visit `/settings/tenant` → Shows tenant metadata (read-only)
   - Check browser console → No i18n errors

5. **Optional: Enable flag for testing:**
   ```bash
   NEXT_PUBLIC_FF_I18N_SCAFFOLD=true
   ```

## 🔄 Rollback Plan

If issues arise:

1. **Disable flag:**
   ```bash
   NEXT_PUBLIC_FF_I18N_SCAFFOLD=false
   ```

2. **Revert code (if needed):**
   ```bash
   git revert a89f6f9 dff12d9
   git push origin spec-sync
   ```

## 📝 Translation Keys

**Inventory (`inventory.*`):**
- `title` — "Items"
- `createItem` — "Create item"
- `sku` — "SKU"
- `name` — "Name"
- `pricePlaceholder` — "Price (e.g. 12.99)"
- `stock` — "Stock"
- `searchPlaceholder` — "Search by SKU or name"
- `noItems` — "No items."

**Settings (`settings.tenant.*`):**
- `title` — "Tenant Settings"
- `region` — "Region"
- `language` — "Language"
- `currency` — "Currency"
- `dataPolicy` — "Data Policy Accepted"
- `readOnly` — "These settings are read-only for now"

**Common (`common.*`):**
- `loading` — "Loading…"
- `refresh` — "Refresh"
- `creating` — "Creating…"
- `create` — "Create"
- `error` — "Error"
- `save` — "Save"
- `cancel` — "Cancel"

## 🌍 Future: Adding New Locales

To add a new language (e.g., Spanish):

1. Create `apps/web/src/locales/es-ES.json`
2. Copy structure from `en-US.json`
3. Translate all values
4. Update `i18n.ts` to include new locale
5. Add language selector UI (future PR)

## 📝 Related

- **Requirements:** REQ-2025-903 (FE i18n Scaffold)
- **Initiative:** RETROFIT-G-MVP-2025-01
- **Commits:** `a89f6f9`, `dff12d9`
- **Depends on:** PR #1 (DB+Flags) for tenant metadata
- **Followed by:** PR #3 (Observability)

## ✅ Checklist

- [x] Dependencies installed
- [x] Feature flag configured (OFF by default)
- [x] useTranslation hook with fallback
- [x] ItemsClient strings wrapped
- [x] Tenant Settings page created
- [x] Locale file with all keys
- [x] Zero visual change with flag OFF
- [x] Strings resolve correctly with flag ON
