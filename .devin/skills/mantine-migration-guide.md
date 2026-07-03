---
description: Mantine UI is the preferred component library for VisibleShelf. Use this guide when building new pages, migrating shadcn components, or auditing legacy imports.
---

# Mantine UI Migration & Best Practice Guide

Mantine is the **preferred UI component library** for the VisibleShelf web frontend (`apps/web`). All new pages and components should use Mantine. Existing pages using shadcn (`@/components/ui`) or plain HTML elements should be migrated when touched.

## 1. Architecture

```
UI Layer:        Mantine components (@mantine/core, @mantine/notifications, @mantine/hooks)
Theming:         MantineProvider with custom theme (dark mode via useMantineColorScheme)
Layout:          Mantine Stack, Group, SimpleGrid, Container
Icons:           @tabler/icons-react (NOT lucide-react for new code)
Notifications:   @mantine/notifications (NOT alert() or toast())
```

**Key principle**: No new `@/components/ui` imports. Mantine components are imported directly from `@mantine/core`. The shadcn wrappers in `@/components/ui` are legacy and should not be extended.

## 2. Component Mapping: shadcn → Mantine

| shadcn (`@/components/ui`) | Mantine (`@mantine/core`) | Notes |
|---|---|---|
| `Card` / `LegacyCard` | `Card` | Use `withBorder p="lg" radius="md"` |
| `CardContent` | (not needed) | Mantine Card content is direct children |
| `Button` | `Button` | See variant mapping below |
| `Badge` | `Badge` | See variant mapping below |
| `Alert` | `Alert` | See variant mapping below |
| `Spinner` | `Loader` | Use `size="lg"` or `size="sm"` |
| `Modal` | `Modal` | See modal pattern below |
| `ModalFooter` | `Group justify="flex-end" mt="md"` | Wrap footer buttons in Group |
| `Input` | `TextInput` | Use `label` and `description` props |
| `Textarea` | `Textarea` | Import as `Textarea` (alias if needed) |
| `Select` | `Select` | Use `data` prop with `{ value, label }` objects |
| `Switch` | `Switch` | Direct replacement |
| `Label` | (built into Mantine inputs) | Use `label` prop on input components |
| `Tabs` / `TabsList` / `TabsTrigger` | `Tabs` with `Tabs.List` / `Tabs.Tab` | |
| `Progress` | `Progress` | Direct replacement |
| `Avatar` | `Avatar` | Direct replacement |
| `Tooltip` | `Tooltip` | Direct replacement |
| `Accordion` | `Accordion` | Use `Accordion.Item` / `Accordion.Control` / `Accordion.Panel` |

### 2.1 Variant Mapping

shadcn and Mantine use different variant systems. Always translate:

| shadcn variant | Mantine equivalent |
|---|---|
| `variant="default"` (Button) | `variant="default"` |
| `variant="secondary"` (Button) | `variant="default"` |
| `variant="destructive"` (Button) | `color="red" variant="filled"` |
| `variant="outline"` (Button) | `variant="outline"` |
| `variant="ghost"` (Button) | `variant="subtle"` |
| `variant="success"` (Badge/Alert) | `color="green" variant="light"` |
| `variant="warning"` (Badge/Alert) | `color="yellow" variant="light"` |
| `variant="error"` (Badge/Alert) | `color="red" variant="light"` |
| `variant="default"` (Badge) | `variant="light"` + appropriate `color` |
| `className="bg-blue-100 text-blue-800"` (Badge) | `color="blue" variant="light"` |
| `className="bg-green-100 text-green-800"` (Badge) | `color="green" variant="light"` |
| `className="bg-purple-100 text-purple-800"` (Badge) | `color="grape" variant="light"` |
| `className="bg-amber-100 text-amber-800"` (Badge) | `color="orange" variant="light"` |
| `className="bg-red-100 text-red-800"` (Badge) | `color="red" variant="light"` |
| `className="bg-indigo-100 text-indigo-800"` (Badge) | `color="indigo" variant="light"` |

### 2.2 Plain HTML → Mantine

| HTML | Mantine | Props to use |
|---|---|---|
| `<h1>` | `Title order={1}` | |
| `<h2>` | `Title order={2}` | `mb="xs"` or `mb="md"` |
| `<h3>` | `Title order={3}` | |
| `<p>` (description) | `Text size="sm" c="dimmed"` | |
| `<p>` (body) | `Text` | |
| `<p className="text-lg">` | `Text size="lg"` | |
| `<div className="space-y-4">` | `Stack gap="md"` | |
| `<div className="flex ... gap-4">` | `Group gap="md"` | Add `justify` / `align` as needed |
| `<div className="grid grid-cols-3 gap-4">` | `SimpleGrid cols={3}` | |

## 3. Best Practice Patterns

### 3.1 Card Section Pattern

```tsx
<Card withBorder p="lg" radius="md">
  <Stack gap="md">
    <Group gap="sm" mb="md">
      <div className="h-3 w-3 rounded-full bg-blue-500" />
      <div>
        <Title order={3}>Section Title</Title>
        <Text size="sm" c="dimmed">Section description</Text>
      </div>
    </Group>
    {/* Card content */}
  </Stack>
</Card>
```

### 3.2 Modal Pattern

```tsx
<Modal
  opened={showModal}
  onClose={() => setShowModal(false)}
  title="Modal Title"
>
  <Stack gap="md">
    {/* Modal content */}
    <Group justify="flex-end" mt="md">
      <Button variant="default" onClick={() => setShowModal(false)}>
        Cancel
      </Button>
      <Button onClick={handleSave}>
        Save
      </Button>
    </Group>
  </Stack>
</Modal>
```

### 3.3 Loading State Pattern

```tsx
// Loading
<Stack align="center" justify="center" h={400}>
  <Loader size="lg" />
</Stack>

// Error
<Alert color="red" title="Error" icon={<IconAlertCircle />}>
  {error || 'An error occurred'}
</Alert>
```

### 3.4 Notification Pattern

```tsx
import { notifications } from '@mantine/notifications';

// Success
notifications.show({
  title: 'Success',
  message: 'Settings saved',
  color: 'green',
});

// Error
notifications.show({
  title: 'Error',
  message: 'Failed to save',
  color: 'red',
});
```

**Never use `alert()` or `window.confirm()` in new code.**

### 3.5 Dark Mode

Mantine handles dark mode via `useMantineColorScheme()`. When using Mantine components with `c="dimmed"`, `withBorder`, and standard props, dark mode works automatically. Avoid hardcoding Tailwind color classes like `text-neutral-900` or `bg-white` — use Mantine props instead:

- `text-neutral-900` → no extra prop (Mantine handles text color)
- `text-neutral-600` → `c="dimmed"`
- `bg-white` → omit (Card with `withBorder` handles background)
- `border-neutral-200` → `withBorder` on Card

### 3.6 Import Style

```tsx
// Good — single import line from @mantine/core
import { Card, Button, Badge, Title, Text, Stack, Group, Alert, Modal, Loader } from '@mantine/core';

// Bad — multiple separate imports
import { Card } from '@mantine/core';
import { Button } from '@mantine/core';
```

## 4. Migration Procedure

When migrating a page from shadcn/HTML to Mantine:

### Step 1: Audit
```bash
# Find legacy imports
grep -r "@/components/ui" --include="*.tsx" <page-dir>/
grep -r 'variant="default"\|variant="success"\|variant="warning"' --include="*.tsx" <page-dir>/
```

### Step 2: Replace Imports
- Remove all `@/components/ui` imports
- Add a single `import { ... } from '@mantine/core'` line with all needed components
- Add `import { notifications } from '@mantine/notifications'` if using notifications

### Step 3: Replace Components
Work top-to-bottom through the file:
1. Replace `LegacyCard` / shadcn `Card` → Mantine `Card` (fix both opening AND closing tags)
2. Replace `Spinner` → `Loader`
3. Replace `Badge` instances — translate variants and remove Tailwind className color overrides
4. Replace `Alert` instances — translate variants to `color` props
5. Replace `Modal` / `ModalFooter` → Mantine `Modal` + `Group` for footer
6. Replace plain `<h1>`/`<h2>`/`<h3>` → `Title order={N}`
7. Replace plain `<p>` → `Text` (use `c="dimmed"` for descriptions)

### Step 4: Verify Closing Tags
**This is the #1 source of migration errors.** After each component swap:
- Verify the opening tag name matches the closing tag
- If you wrapped content in `<Stack>` or `<Group>`, ensure the closing `</Stack>` or `</Group>` exists
- If you replaced `<div className="space-y-4">` with `<Stack>`, you must also replace the corresponding `</div>` with `</Stack>`

### Step 5: Verify
```bash
pnpm checkweb
```
Run after each file migration (not after every edit). Fix all TS errors before moving to the next file.

### Step 6: Final Audit
```bash
# Confirm no legacy imports remain in the migrated file
grep -r "@/components/ui" --include="*.tsx" <migrated-file>/
grep -r 'variant="default"\|variant="success"\|variant="warning"\|variant="error"' --include="*.tsx" <migrated-file>/
```

## 5. Common Pitfalls

1. **Mismatched closing tags**: Replacing `<LegacyCard>` with `<Card>` but leaving `</LegacyCard>` — or replacing `<div className="space-y-4">` with `<Stack>` but leaving `</div>`. Always fix both tags.

2. **`<Text>` opened with `</p>` closed**: When replacing `<p>` with `<Text>`, the closing tag must also change to `</Text>`.

3. **Badge `variant="default"` on Mantine**: Mantine Badge doesn't have a `variant="default"`. Use `variant="light"` with a `color` prop instead.

4. **Button `variant="secondary"` on Mantine**: Mantine doesn't have `variant="secondary"`. Use `variant="default"` (Mantine's default is the filled primary, `variant="default"` is the subtle/secondary look).

5. **Multiple import lines**: Don't write `import { Card } from '@mantine/core'` and `import { Button } from '@mantine/core'` separately. Consolidate into one line.

6. **Tailwind color classes on Mantine components**: Don't use `className="bg-blue-100 text-blue-800"` on Mantine `Badge`. Use `color="blue" variant="light"` instead.

7. **Forgetting `notifications` import**: If you replace `alert()` with `notifications.show()`, you must add `import { notifications } from '@mantine/notifications'`.

## 6. Files Already Migrated

These settings pages have been fully migrated to Mantine:
- `settings/contact/page.tsx`
- `settings/profile/page.tsx`
- `settings/organization/commerce/page.tsx`
- `settings/tenant/page.tsx`
- `settings/offerings/page.tsx`
- `settings/mfa/page.tsx`
- `settings/security/page.tsx`
- `settings/privacy/page.tsx`

## 7. Files Pending Migration

42 files under `settings/admin/` still import from `@/components/ui`. These are lower priority and should be migrated when touched for other work. Use the audit command to find them:

```bash
grep -r "@/components/ui" --include="*.tsx" apps/web/src/app/\(platform\)/settings/ | cut -d: -f1 | sort -u
```
