# Internationalization (i18n)

## Supported Languages

✅ **English (en-US)** - Primary language, 100% complete
✅ **Spanish (es-ES)** - Pilot-ready, core translations complete
✅ **French (fr-FR)** - Pilot-ready, core translations complete

## Enabling i18n

Set the feature flag in your environment:

```bash
NEXT_PUBLIC_FF_I18N_SCAFFOLD=true
```

## Usage

```tsx
import { useTranslation } from '@/lib/useTranslation';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('inventory.title', 'Items')}</h1>
      <p>{t('common.loading', 'Loading...')}</p>
    </div>
  );
}
```

## Adding Translations

1. Add keys to all language files:
   - `en-US.json`
   - `es-ES.json`
   - `fr-FR.json`

2. Use the translation in components:
   ```tsx
   {t('your.key.path', 'Fallback text')}
   ```

## Translation Coverage

### Current Coverage (~30%)
- ✅ Inventory management
- ✅ Settings pages
- ✅ Common UI elements

### TODO for Full Coverage
- ⏳ Dashboard
- ⏳ Google integration pages
- ⏳ Performance dashboard
- ⏳ Admin panels
- ⏳ Error messages
- ⏳ Validation messages

## Adding a New Language

1. Create new locale file: `src/locales/[locale].json`
2. Copy structure from `en-US.json`
3. Translate all strings
4. Import in `src/lib/i18n.ts`:
   ```ts
   import newLocale from '../locales/[locale].json';
   ```
5. Add to resources and supportedLngs
6. Add option to language selector in settings

## Notes

- Fallback language is always `en-US`
- Feature flag allows gradual rollout
- When flag is OFF, fallback text is used
- Database stores tenant language preference
