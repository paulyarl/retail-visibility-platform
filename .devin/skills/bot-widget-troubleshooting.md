---
description: How to diagnose and fix common bot widget issues (toast dismissal, positioning, avatar fallback, dashboard preview)
---

# Bot Widget Troubleshooting

Use this skill when the chatbot widget is not behaving as expected: toasts won't close, the widget is not visible on the dashboard, or the avatar is not falling back to the platform logo.

## 1. Toast notifications do not close when clicking X

The app has **two separate toast systems**.

- **Global system** (used by bot config): `apps/web/src/hooks/use-toast.ts` + `apps/web/src/components/ui/Toaster.tsx`
- **Legacy system**: `apps/web/src/components/ui/use-toast.ts` + `apps/web/src/components/ui/Toast.tsx`

The `use-toast.ts` hook sets a very long `TOAST_REMOVE_DELAY` (1,000,000 ms), so automatic removal is effectively disabled. The X button correctly calls `dismiss(t.id)`, which sets `toast.open = false` and schedules removal after the delay. However, `Toaster.tsx` originally rendered all toasts regardless of `open` state.

### Fix

Filter out dismissed toasts in the `Toaster` render:

```tsx
{toasts.filter((t) => t.open !== false).map((t) => (
  // ... toast JSX
))}
```

**File:** `apps/web/src/components/ui/Toaster.tsx`

## 2. Bot widget is not visible on the dashboard

The merchant dashboard has **two different chat UIs**:

- **Platform Assistant** (`BotDashboardChat`) — fixed bottom-right, capability-aware, not configurable by the tenant.
- **Tenant's Public Bot Widget** (`PublicBotWidget`) — configurable position, color, greeting, avatar.

The dashboard does **not** render the public bot widget by default. If the merchant configures the widget position to bottom-left and expects to see it on the dashboard, add the component to the dashboard layout.

### Fix

Import and render the public widget at the bottom of the dashboard page:

```tsx
import PublicBotWidget from '@/components/bot/PublicBotWidget';

// Inside the dashboard return:
<PublicBotWidget tenantId={tenantId} pageContext="dashboard" />
```

**File:** `apps/web/src/components/dashboard/TenantDashboardV2.tsx`

**Note:** `PublicBotWidget` only renders when `chatbotCaps.enabled && chatbotCaps.widgetEnabled` are true and the bot `status === 'active'`.

## 3. Bot widget position is wrong

`PublicBotWidget` uses `config.widgetPosition` to choose Tailwind position classes:

```ts
const POSITION_CLASSES = {
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
};
```

Position is read from the public bot config returned by `BotConfigurationService.getPublicConfig()`. Verify the config is saved correctly via the merchant API (`/api/tenants/:tenantId/bot-config`) and returned by the public API (`/api/public/bot/config?tenantId=`).

The embeddable `bot-widget.js` also applies position dynamically; ensure it uses the same `config.widgetPosition` value.

## 4. Platform logo is not used as default avatar

The avatar fallback chain is:

1. `config.widgetAvatarUrl` — custom bot avatar
2. `config.platformLogoUrl` — platform logo bundled in the public bot config
3. `platformSettingsService.getPlatformSettings().logoUrl` — frontend-only fallback
4. Robot emoji / placeholder

### Frontend fix (`PublicBotWidget`)

```ts
const avatarUrl = config.widgetAvatarUrl || config.platformLogoUrl || platformLogoUrl;
```

**File:** `apps/web/src/components/bot/PublicBotWidget.tsx`

### Backend fix (public config)

Include the platform logo in the public bot config response so the embeddable widget and the React widget both receive it without an extra request:

```ts
const platformSettings = await prisma.platform_settings_list.findUnique({
  where: { id: 1 },
});

return {
  // ... other config fields
  platformLogoUrl: platformSettings?.logo_url || null,
};
```

**File:** `apps/api/src/services/BotConfigurationService.ts`

### Frontend type update

Add `platformLogoUrl` to the `PublicBotConfig` interface:

```ts
export interface PublicBotConfig {
  // ...
  widgetAvatarUrl: string | null;
  platformLogoUrl: string | null;
}
```

**File:** `apps/web/src/services/PublicBotService.ts`

### Embeddable widget fix (`bot-widget.js`)

```js
var avatarUrl = config.widgetAvatarUrl || config.platformLogoUrl;
var avatarStyle = avatarUrl ? 'background-image:url(' + avatarUrl + ')' : '';
header.innerHTML = '...<div class="bw-avatar" style="' + avatarStyle + '">' + (avatarUrl ? '' : '🤖') + '</div>...';
```

**File:** `apps/web/public/bot-widget/bot-widget.js`

### Config page preview fix

The bot config page preview should show the platform logo when no custom avatar is uploaded. Fetch platform settings and display it:

```tsx
const [platformLogoUrl, setPlatformLogoUrl] = useState<string | null>(null);

useEffect(() => {
  platformSettingsService.getPlatformSettings().then(s => s?.logoUrl && setPlatformLogoUrl(s.logoUrl));
}, []);

// In the preview area:
{(form.widgetAvatarUrl || config?.widgetAvatarUrl || platformLogoUrl) && (
  <Image src={form.widgetAvatarUrl || config?.widgetAvatarUrl || platformLogoUrl || ''} alt="Bot avatar" />
)}
```

**File:** `apps/web/src/components/bot/BotConfigPage.tsx`

## 5. Key capability gate

The widget only appears if the tenant has the chatbot capability enabled. Check `resolveEffectiveCapabilities()` / `useChatbotOptionsCapability` before debugging positioning or avatar issues.

```ts
const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId);
if (!chatbotCaps?.enabled || !chatbotCaps?.widgetEnabled) return null;
```

## 6. Verification commands

```bash
# Frontend type check
pnpm checkweb

# Backend type check
pnpm checkapi

# Check public bot config returns expected fields
curl -s "http://localhost:3000/api/public/bot/config?tenantId=<tenantId>"

# Check platform logo is available
curl -s "http://localhost:3000/api/platform-settings"
```

## 7. Files involved in a typical bot widget avatar/position fix

- `apps/web/src/components/bot/PublicBotWidget.tsx`
- `apps/web/src/components/bot/BotConfigPage.tsx`
- `apps/web/src/components/bot/BotTenantWidget.tsx`
- `apps/web/src/components/bot/BotDashboardChat.tsx`
- `apps/web/src/components/dashboard/TenantDashboardV2.tsx`
- `apps/web/src/services/PublicBotService.ts`
- `apps/web/src/services/PlatformSettingsSingletonService.ts`
- `apps/web/src/components/ui/Toaster.tsx`
- `apps/web/src/hooks/use-toast.ts`
- `apps/web/public/bot-widget/bot-widget.js`
- `apps/api/src/services/BotConfigurationService.ts`
- `apps/api/src/routes/bot-public.ts`
