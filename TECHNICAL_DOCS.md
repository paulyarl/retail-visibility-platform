# Retail Visibility Platform - Technical Documentation

## 🏗️ System Architecture

### Overview

```
┌─────────────────────────────────────────────────────────┐
│                     User Browser                         │
│                  (Next.js Frontend)                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTPS
                 │
┌────────────────▼────────────────────────────────────────┐
│                   Vercel CDN                             │
│              (Static Assets + SSR)                       │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌───────────────┐  ┌──────────────────┐
│   Supabase    │  │  Railway API     │
│   (Auth +     │  │  (Express +      │
│   Database)   │  │   PostgreSQL)    │
└───────────────┘  └──────────────────┘
```

### Technology Stack

**Frontend:**
- **Framework:** Next.js 15.5.6 (App Router)
- **Language:** TypeScript 5.x
- **Styling:** TailwindCSS 3.x
- **State:** React Hooks (useState, useEffect)
- **Animation:** Framer Motion 11.x
- **Theme:** next-themes 0.4.x
- **i18n:** i18next + react-i18next

**Backend:**
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 15
- **ORM:** Prisma (optional)

**Authentication:**
- **Provider:** Supabase Auth
- **Method:** Magic Links (OTP)
- **Session:** JWT tokens

**Deployment:**
- **Frontend:** Vercel
- **Backend:** Railway
- **Database:** Supabase (managed PostgreSQL)

---

## 📂 Project Structure

### Monorepo Layout

```
retail-visibility-platform/
├── apps/
│   ├── web/                    # Next.js frontend application
│   └── api/                    # Express backend API
├── packages/                   # Shared packages (if any)
├── PLATFORM_OVERVIEW.md        # Platform documentation
├── USER_GUIDE.md              # End-user documentation
├── TECHNICAL_DOCS.md          # This file
└── pnpm-workspace.yaml        # Workspace configuration
```

### Frontend Structure

```
apps/web/
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/              # API route handlers
│   │   │   ├── items/        # Items endpoints
│   │   │   ├── tenants/      # Tenants endpoints
│   │   │   └── tenant/       # Tenant profile endpoints
│   │   ├── items/            # Inventory pages
│   │   ├── login/            # Authentication
│   │   ├── onboarding/       # Onboarding wizard
│   │   ├── settings/         # Settings hub
│   │   │   ├── admin/        # Admin pages
│   │   │   │   ├── features/ # Feature flags
│   │   │   │   ├── tenants/  # Admin tenant management
│   │   │   │   └── users/    # User management
│   │   │   ├── appearance/   # Theme settings
│   │   │   ├── language/     # Language settings
│   │   │   └── tenant/       # Tenant settings
│   │   ├── tenants/          # Tenant management
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Home page
│   │   └── globals.css       # Global styles
│   ├── components/           # React components
│   │   ├── items/           # Inventory components
│   │   │   └── ItemsClient.tsx
│   │   ├── onboarding/      # Onboarding components
│   │   │   ├── OnboardingWizard.tsx
│   │   │   ├── ProgressSteps.tsx
│   │   │   └── StoreIdentityStep.tsx
│   │   ├── settings/        # Settings components
│   │   │   ├── BusinessProfileCard.tsx
│   │   │   └── EditBusinessProfileModal.tsx
│   │   ├── tenants/         # Tenant components
│   │   │   └── TenantsClient.tsx
│   │   ├── ui/              # UI component library
│   │   │   ├── Alert.tsx
│   │   │   ├── AnimatedCard.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── index.ts
│   │   ├── AuthPanel.tsx    # Authentication component
│   │   ├── ErrorBoundary.tsx
│   │   ├── Protected.tsx    # Route protection
│   │   └── ThemeProvider.tsx
│   ├── lib/                 # Utilities and helpers
│   │   ├── supabase/       # Supabase clients
│   │   │   ├── client.ts   # Browser client
│   │   │   └── server.ts   # Server client
│   │   ├── validation/     # Validation schemas
│   │   │   └── businessProfile.ts
│   │   ├── featureFlags.ts # Feature flag utilities
│   │   ├── i18n.ts        # i18n configuration
│   │   └── useTranslation.ts
│   └── locales/           # Translation files
│       └── en-US.json
├── public/                # Static assets
├── .env.local            # Environment variables
├── next.config.js        # Next.js configuration
├── tailwind.config.ts    # TailwindCSS configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies
```

---

## 🔧 Configuration Files

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['your-image-domain.com'],
  },
  env: {
    API_BASE_URL: process.env.API_BASE_URL,
  },
};

module.exports = nextConfig;
```

### tailwind.config.ts

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          // ... more shades
          600: '#3b82f6',
          // ... more shades
        },
      },
    },
  },
  plugins: [],
}
```

---

## 🔐 Authentication Flow

### Magic Link Authentication

```
1. User enters email
   ↓
2. Frontend calls Supabase Auth
   ↓
3. Supabase sends magic link email
   ↓
4. User clicks link
   ↓
5. Supabase validates token
   ↓
6. User redirected with session
   ↓
7. Frontend stores session in cookies
   ↓
8. Role-based redirect:
   - Admin → /settings/admin
   - Business Owner → /tenants
```

### Session Management

**Storage:** HTTP-only cookies (managed by Supabase)  
**Duration:** 1 hour (refreshed automatically)  
**Refresh:** Automatic via Supabase client

### Role-Based Access Control

```typescript
// User metadata structure
{
  role: 'admin' | 'business_owner' | 'user' | 'viewer',
  email: string,
  email_verified: boolean,
  phone_verified: boolean
}
```

---

## 🗄️ Database Schema

### Tables

**users** (Supabase Auth)
- id: uuid (PK)
- email: string
- raw_user_meta_data: jsonb
  - role: string
- created_at: timestamp
- last_sign_in_at: timestamp

**tenants**
- id: string (PK)
- name: string
- user_id: uuid (FK → users.id)
- created_at: timestamp
- region: string (optional)
- language: string (optional)
- currency: string (optional)

**items**
- id: string (PK)
- tenant_id: string (FK → tenants.id)
- name: string
- description: text
- price: decimal
- sku: string
- quantity: integer
- image_url: string
- created_at: timestamp
- updated_at: timestamp

**business_profiles**
- id: uuid (PK)
- tenant_id: string (FK → tenants.id)
- business_name: string
- phone_number: string
- email: string
- website: string
- contact_person: string
- country_code: string
- created_at: timestamp
- updated_at: timestamp

---

## 🔌 API Endpoints

### Frontend API Routes (Next.js)

**Tenants:**
```
GET    /api/tenants           # List tenants
POST   /api/tenants           # Create tenant
PUT    /api/tenants/[id]      # Update tenant
DELETE /api/tenants/[id]      # Delete tenant
```

**Items:**
```
GET    /api/items?tenantId=xxx  # List items
POST   /api/items               # Create item
PUT    /api/items/[id]          # Update item
DELETE /api/items/[id]          # Delete item
```

**Photos:**
```
POST   /api/items/[id]/photos   # Upload photo
GET    /api/items/[id]/photos   # Get photos
```

**Tenant Profile:**
```
POST   /api/tenant/profile      # Create/update profile
GET    /api/tenant/profile?tenantId=xxx  # Get profile
```

### Backend API (Railway)

**Base URL:** `https://your-api.railway.app`

**Tenants:**
```
GET    /tenants                 # List tenants
POST   /tenants                 # Create tenant
PUT    /tenants/:id             # Update tenant
DELETE /tenants/:id             # Delete tenant
```

**Items:**
```
GET    /items?tenantId=xxx      # List items
POST   /items                   # Create item
PUT    /items/:id               # Update item
DELETE /items/:id               # Delete item
```

---

## 🎨 Component Architecture

### UI Component Pattern

```typescript
// Example: Button component
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  children,
}: ButtonProps) {
  // Implementation
}
```

### Page Component Pattern

```typescript
// Example: Page with data fetching
'use client';

export default function ExamplePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await fetch('/api/endpoint');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert variant="error">{error}</Alert>;

  return (
    <div>
      {/* Page content */}
    </div>
  );
}
```

---

## 🌙 Dark Mode Implementation

### Theme Provider Setup

```typescript
// app/layout.tsx
import { ThemeProvider } from '@/components/ThemeProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-neutral-900">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Using Dark Mode Classes

```tsx
// Component with dark mode support
<div className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">
  <h1 className="text-neutral-900 dark:text-white">Title</h1>
  <p className="text-neutral-600 dark:text-neutral-400">Description</p>
</div>
```

### Theme Toggle

```typescript
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle Theme
    </button>
  );
}
```

---

## 🌍 Internationalization (i18n)

### Configuration

```typescript
// lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from '../locales/en-US.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { translation: enUS },
    },
    lng: 'en-US',
    fallbackLng: 'en-US',
  });

export { i18n };
```

### Usage

```typescript
import { useTranslation } from '@/lib/useTranslation';

export default function Component() {
  const { t } = useTranslation();
  
  return (
    <h1>{t('common.welcome', 'Welcome')}</h1>
  );
}
```

---

## 🚀 Deployment

### Frontend (Vercel)

**Build Command:** `pnpm build`  
**Output Directory:** `.next`  
**Install Command:** `pnpm install`

**Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `API_BASE_URL`

### Backend (Railway)

**Start Command:** `pnpm start`  
**Build Command:** `pnpm build`

**Environment Variables:**
- `DATABASE_URL`
- `PORT`

---

## 🧪 Testing

### Unit Tests (Coming Soon)

```bash
pnpm test
```

### E2E Tests (Coming Soon)

```bash
pnpm test:e2e
```

---

## 📊 Performance Optimization

### Code Splitting

- Automatic route-based splitting (Next.js)
- Dynamic imports for heavy components
- Lazy loading for images

### Caching Strategy

- Static assets: CDN cached
- API responses: No cache (real-time data)
- Images: Next.js Image optimization

### Bundle Size

- Tree shaking enabled
- Unused code eliminated
- Minification in production

---

## 🔒 Security Best Practices

### Authentication
- Magic links (no password vulnerabilities)
- HTTP-only cookies
- CSRF protection
- XSS protection (React escaping)

### API Security
- HTTPS only
- Rate limiting (coming soon)
- Input validation
- SQL injection protection (Prisma/parameterized queries)

### Data Protection
- Role-based access control
- Tenant isolation
- Encrypted connections
- Environment variable protection

---

## 📈 Monitoring & Logging

### Frontend Monitoring
- Vercel Analytics
- Error boundaries
- Console logging (development)

### Backend Monitoring
- Railway logs
- API response times
- Error tracking (coming soon)

---

## 🛠️ Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Run frontend
cd apps/web
pnpm dev

# Run backend
cd apps/api
pnpm dev
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: your feature"

# Push to remote
git push origin feature/your-feature

# Create pull request
```

### Commit Convention

```
feat: New feature
fix: Bug fix
docs: Documentation
style: Formatting
refactor: Code restructuring
test: Tests
chore: Maintenance
```

---

## 📚 Additional Resources

### Documentation
- Next.js: https://nextjs.org/docs
- React: https://react.dev
- TailwindCSS: https://tailwindcss.com/docs
- Supabase: https://supabase.com/docs

### Tools
- TypeScript: https://www.typescriptlang.org/docs
- Framer Motion: https://www.framer.com/motion
- next-themes: https://github.com/pacocoursey/next-themes

---

**Last Updated:** October 21, 2025  
**Version:** 1.0.0  
**Maintainer:** Development Team
