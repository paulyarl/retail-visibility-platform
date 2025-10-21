# Master Spec — UX Design System v2.0

**Initiative:** Retail Visibility Platform UX Overhaul  
**Phase:** Design System Foundation & Implementation  
**Status:** 🟡 Planning  
**Start Date:** Q4 2025  
**Target Completion:** Q1 2026

---

## 🎯 Executive Summary

**Objective:** Elevate the platform's user experience from MVP functional state to a polished, globally scalable, and accessible product experience.

**Approach:** Design system-first methodology with progressive rollout behind feature flag (`FF_UX_V2`), ensuring zero disruption to existing users.

**Scope:**
- Design token system (color, typography, spacing, shadows)
- Component library (20+ base components)
- 7 core page redesigns
- WCAG 2.1 AA accessibility compliance
- Performance optimization (Lighthouse ≥95)
- Global scalability (RTL support, locale-aware UI)

**Dependencies:**
- RETROFIT-G-MVP-2025-01 (i18n scaffolding) ✅ Complete
- Figma workspace and brand assets
- Design Lead and UX Designer resources
- Accessibility Specialist consultation

---

## 📋 Requirements

### REQ-UX-001: Design System Foundation
**Status:** 🟡 Pending  
**Priority:** Critical  
**Dependencies:** None (foundation requirement)

**Description:**
Create comprehensive design token system and component library as the foundation for all UI work.

**Acceptance Criteria:**
- [ ] Design tokens defined: color, typography, spacing, radius, shadow
- [ ] Base components built in Figma (20+ components)
- [ ] Grid system defined (8pt baseline)
- [ ] Interaction guidelines documented (hover, focus, active, disabled)
- [ ] Tokens exported to Tailwind configuration
- [ ] Version control established for Figma files
- [ ] Component library published and documented

**Technical Scope:**
- Figma workspace setup
- Design token JSON export
- Tailwind config integration
- Component documentation site

**Rollback Plan:**
- Revert to existing Tailwind config
- Disable `FF_UX_V2` flag

**Feature Flag:** `FF_UX_V2=false` (default OFF)

**Components to Build:**
1. Button (primary, secondary, ghost, danger)
2. Card (default, elevated, outlined)
3. Input (text, number, email, password)
4. Select (single, multi, searchable)
5. Checkbox & Radio
6. Toggle Switch
7. Modal (small, medium, large, fullscreen)
8. Tooltip
9. Badge
10. Alert (info, success, warning, error)
11. Toast Notification
12. Skeleton Loader
13. Spinner
14. Progress Bar
15. Tabs
16. Accordion
17. Dropdown Menu
18. Breadcrumb
19. Pagination
20. Avatar

---

### REQ-UX-002: Dashboard Redesign
**Status:** 🟡 Pending  
**Priority:** High  
**Dependencies:** REQ-UX-001 (Design System Foundation)

**Description:**
Redesign dashboard for clarity and immediate insight with hero metrics, feed status, and trend visualization.

**Acceptance Criteria:**
- [ ] Hero metric cards (4-6 key metrics)
- [ ] Feed status widget with health indicators
- [ ] Alert/notification center
- [ ] Trend graph (last 30 days)
- [ ] Quick actions panel
- [ ] Responsive layout (mobile, tablet, desktop)
- [ ] Skeleton loaders for async data
- [ ] Empty states designed

**Key Metrics to Display:**
- Total inventory count
- Active listings (Google Merchant Center)
- Feed sync status
- Photo upload success rate
- Recent activity timeline

**Rollback Plan:**
- Disable `FF_UX_V2` flag
- Revert to existing dashboard

**Feature Flag:** `FF_UX_V2=false` (default OFF)

---

### REQ-UX-003: Inventory Management Redesign
**Status:** 🟡 Pending  
**Priority:** High  
**Dependencies:** REQ-UX-001 (Design System Foundation)

**Description:**
Efficient CRUD interface with tabbed layout, list/grid toggle, inline editing, and advanced filtering.

**Acceptance Criteria:**
- [ ] Tabbed layout (All, Active, Draft, Archived)
- [ ] List/grid view toggle
- [ ] Inline editing for quick updates
- [ ] Advanced filters (category, price range, stock status)
- [ ] Bulk actions (edit, delete, export)
- [ ] Skeleton loaders during data fetch
- [ ] Empty states with call-to-action
- [ ] Pagination with page size selector

**Rollback Plan:**
- Disable `FF_UX_V2` flag
- Revert to existing inventory page

**Feature Flag:** `FF_UX_V2=false` (default OFF)

---

### REQ-UX-004: Product Capture Mobile-First Flow
**Status:** 🟡 Pending  
**Priority:** High  
**Dependencies:** REQ-UX-001 (Design System Foundation)

**Description:**
Mobile-first 3-step wizard for product capture with offline support and image compression preview.

**Acceptance Criteria:**
- [ ] 3-step wizard (Photo → Details → Review)
- [ ] Mobile-optimized camera interface
- [ ] Offline mode indicators
- [ ] Image compression preview with quality slider
- [ ] Progress indicator
- [ ] Save draft functionality
- [ ] Validation feedback (inline errors)
- [ ] Success confirmation with next action

**Steps:**
1. **Photo Capture:** Camera interface, gallery upload, compression preview
2. **Product Details:** SKU, name, price, stock, category
3. **Review & Submit:** Summary, edit links, submit button

**Rollback Plan:**
- Disable `FF_UX_V2` flag
- Revert to existing product capture flow

**Feature Flag:** `FF_UX_V2=false` (default OFF)

---

### REQ-UX-005: Google Integration Transparency
**Status:** 🟡 Pending  
**Priority:** Medium  
**Dependencies:** REQ-UX-001 (Design System Foundation)

**Description:**
Clear OAuth flow, feed health widget, and logs tab for Google Merchant Center integration.

**Acceptance Criteria:**
- [ ] OAuth connection card with status indicator
- [ ] Feed health widget (sync status, errors, warnings)
- [ ] Logs tab with filterable activity
- [ ] Reconnect flow for expired tokens
- [ ] Feed preview (sample products)
- [ ] Error explanations with resolution steps
- [ ] Sync history timeline

**Rollback Plan:**
- Disable `FF_UX_V2` flag
- Revert to existing Google integration page

**Feature Flag:** `FF_UX_V2=false` (default OFF)

---

### REQ-UX-006: Analytics & Insights Visual Storytelling
**Status:** 🟡 Pending  
**Priority:** Medium  
**Dependencies:** REQ-UX-001 (Design System Foundation)

**Description:**
Visual analytics suite with Recharts, date filters, and dynamic motion for data storytelling.

**Acceptance Criteria:**
- [ ] Recharts integration (line, bar, pie, area charts)
- [ ] Date range picker (last 7/30/90 days, custom)
- [ ] Metric comparison (vs. previous period)
- [ ] Export to CSV/PDF
- [ ] Interactive tooltips
- [ ] Responsive chart layouts
- [ ] Loading states with skeleton charts
- [ ] Empty states for no data

**Key Metrics:**
- Inventory growth over time
- Feed sync success rate
- Photo upload trends
- Top-performing products
- Category distribution

**Rollback Plan:**
- Disable `FF_UX_V2` flag
- Revert to existing analytics (if any)

**Feature Flag:** `FF_UX_V2=false` (default OFF)

---

### REQ-UX-007: Tenant Settings Simplicity & Compliance
**Status:** 🟡 Pending  
**Priority:** Medium  
**Dependencies:** REQ-UX-001 (Design System Foundation), REQ-2026-001 (Compliance Registry)

**Description:**
Simplified tenant settings with region/language cards, policy acceptance, and audit trail.

**Acceptance Criteria:**
- [ ] Region/language/currency cards (read-only for now)
- [ ] Data policy acceptance UI
- [ ] Audit trail viewer (recent activity)
- [ ] Account details section
- [ ] Notification preferences
- [ ] Danger zone (delete account)
- [ ] Help/support links

**Rollback Plan:**
- Disable `FF_UX_V2` flag
- Revert to existing tenant settings page

**Feature Flag:** `FF_UX_V2=false` (default OFF)

---

### REQ-UX-008: Outreach Tracker Internal CRM
**Status:** 🟡 Pending  
**Priority:** Low  
**Dependencies:** REQ-UX-001 (Design System Foundation)

**Description:**
Internal CRM interface for outreach team with store table, progress tracking, and export tools.

**Acceptance Criteria:**
- [ ] Store table with sortable columns
- [ ] Progress bar per store (onboarding stages)
- [ ] Filter by status (lead, contacted, onboarding, active)
- [ ] Export to CSV
- [ ] Notes/comments per store
- [ ] Activity timeline
- [ ] Bulk actions (email, status update)

**Rollback Plan:**
- Disable `FF_UX_V2` flag
- Revert to existing outreach tracker (if any)

**Feature Flag:** `FF_UX_V2=false` (default OFF)

---

### REQ-UX-009: Accessibility Compliance (WCAG 2.1 AA)
**Status:** 🟡 Pending  
**Priority:** Critical  
**Dependencies:** All page redesigns (REQ-UX-002 through REQ-UX-008)

**Description:**
Ensure WCAG 2.1 AA compliance across all pages with color contrast, keyboard navigation, and ARIA labels.

**Acceptance Criteria:**
- [ ] Color contrast ratio ≥4.5:1 (normal text), ≥3:1 (large text)
- [ ] Full keyboard navigation (tab order, focus indicators)
- [ ] ARIA labels for all interactive elements
- [ ] Screen reader testing (VoiceOver, NVDA)
- [ ] axe-core audit score 100%
- [ ] Lighthouse accessibility score ≥95
- [ ] Focus trap in modals
- [ ] Skip to main content link

**Testing:**
- Automated: axe-core, Lighthouse
- Manual: Screen reader testing, keyboard-only navigation
- Devices: Desktop (Chrome, Safari, Edge), Mobile (iOS, Android)

**Rollback Plan:**
- N/A (accessibility is always-on requirement)

**Feature Flag:** N/A (applies to all UX v2.0 pages)

---

### REQ-UX-010: Performance Optimization
**Status:** 🟡 Pending  
**Priority:** High  
**Dependencies:** All page redesigns (REQ-UX-002 through REQ-UX-008)

**Description:**
Optimize performance with lazy loading, image compression, and code splitting for Lighthouse score ≥95.

**Acceptance Criteria:**
- [ ] Lighthouse Performance score ≥95
- [ ] First Contentful Paint (FCP) <1.5s
- [ ] Largest Contentful Paint (LCP) <2.5s
- [ ] Cumulative Layout Shift (CLS) <0.1
- [ ] Time to Interactive (TTI) <3.5s
- [ ] Image optimization (WebP, lazy loading)
- [ ] Code splitting per route
- [ ] Bundle size <200KB (gzipped)

**Optimizations:**
- Lazy load images and components
- Use Next.js Image component
- Code split by route
- Preload critical assets
- Minimize third-party scripts

**Rollback Plan:**
- N/A (performance is always-on requirement)

**Feature Flag:** N/A (applies to all UX v2.0 pages)

---

## 📊 Design Token System

### Color Palette
```json
{
  "colors": {
    "primary": {
      "50": "#eff6ff",
      "100": "#dbeafe",
      "200": "#bfdbfe",
      "300": "#93c5fd",
      "400": "#60a5fa",
      "500": "#3b82f6",
      "600": "#2563eb",
      "700": "#1d4ed8",
      "800": "#1e40af",
      "900": "#1e3a8a"
    },
    "neutral": {
      "50": "#fafafa",
      "100": "#f5f5f5",
      "200": "#e5e5e5",
      "300": "#d4d4d4",
      "400": "#a3a3a3",
      "500": "#737373",
      "600": "#525252",
      "700": "#404040",
      "800": "#262626",
      "900": "#171717"
    },
    "success": "#10b981",
    "warning": "#f59e0b",
    "error": "#ef4444",
    "info": "#3b82f6"
  }
}
```

### Typography
```json
{
  "typography": {
    "fontFamily": {
      "sans": ["Inter", "system-ui", "sans-serif"],
      "mono": ["JetBrains Mono", "monospace"]
    },
    "fontSize": {
      "xs": "0.75rem",
      "sm": "0.875rem",
      "base": "1rem",
      "lg": "1.125rem",
      "xl": "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem"
    },
    "fontWeight": {
      "normal": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "lineHeight": {
      "tight": 1.25,
      "normal": 1.5,
      "relaxed": 1.75
    }
  }
}
```

### Spacing (8pt Grid)
```json
{
  "spacing": {
    "0": "0",
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "6": "1.5rem",
    "8": "2rem",
    "12": "3rem",
    "16": "4rem",
    "24": "6rem"
  }
}
```

### Border Radius
```json
{
  "borderRadius": {
    "none": "0",
    "sm": "0.25rem",
    "base": "0.5rem",
    "lg": "0.75rem",
    "xl": "1rem",
    "full": "9999px"
  }
}
```

### Shadows
```json
{
  "boxShadow": {
    "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    "base": "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
    "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
  }
}
```

---

## 🎨 Component Library Specification

### Button Component
**Variants:** primary, secondary, ghost, danger  
**Sizes:** sm, md, lg  
**States:** default, hover, active, disabled, loading

**Props:**
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}
```

### Card Component
**Variants:** default, elevated, outlined  
**Props:**
```typescript
interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}
```

### Input Component
**Types:** text, number, email, password, search  
**States:** default, focus, error, disabled

**Props:**
```typescript
interface InputProps {
  type?: 'text' | 'number' | 'email' | 'password' | 'search';
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}
```

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Design token system
- [ ] Figma component library
- [ ] Tailwind config integration
- [ ] Base component implementation (Button, Card, Input)

### Phase 2: Core Pages (Weeks 3-6)
- [ ] Dashboard redesign
- [ ] Inventory management redesign
- [ ] Product capture flow
- [ ] Tenant settings

### Phase 3: Integration & Analytics (Weeks 7-8)
- [ ] Google integration page
- [ ] Analytics & insights
- [ ] Outreach tracker (internal)

### Phase 4: Accessibility & Performance (Weeks 9-10)
- [ ] WCAG 2.1 AA compliance
- [ ] Performance optimization
- [ ] Screen reader testing
- [ ] Lighthouse audits

### Phase 5: Testing & Rollout (Weeks 11-12)
- [ ] Usability testing (3 pilot retailers)
- [ ] Visual regression testing
- [ ] Soft rollout (staging)
- [ ] Production rollout

---

## 🎯 Success Metrics

| KPI | Target | Tool | Frequency |
|-----|--------|------|-----------|
| Task Completion Rate | ≥90% | Usability testing | Sprint review |
| Time-on-Task | ↓25% | Session recordings | Bi-weekly |
| Accessibility Compliance | 100% WCAG AA | axe-core + manual | Monthly |
| Lighthouse Score | ≥95 | Chrome audit | Each release |
| NPS (Pilot Retailers) | ≥8.5/10 | Feedback survey | Quarterly |
| Design Consistency | ≤2% token drift | Automated audit | Each PR |

---

## 💰 Cost Forecast

| Item | Cost | Notes |
|------|------|-------|
| Figma Professional | $15/user/month | Design Lead + UX Designer |
| Accessibility Specialist | $5,000 | Consultation + audit |
| Usability Testing | $2,000 | 5 participants × $400 |
| Design Assets (icons, illustrations) | $500 | One-time |
| **Total** | **$7,680** | One-time + 3 months |

---

## 🔄 Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Design regression | Medium | High | Automated visual regression tests |
| Accessibility gaps | Low | High | Screen reader tests + expert review |
| Performance degradation | Low | Medium | Lighthouse CI + lazy loading |
| Localization overflow | Medium | Low | Pre-launch RTL/locale QA |
| Rollout failure | Low | High | Feature flag + rollback plan |
| Cost overrun | Low | Medium | Weekly budget tracking |

---

**Status:** 🟡 Planning Phase  
**Next Milestone:** Design System Foundation (Week 1-2)  
**Owner:** Design Lead  
**Last Updated:** January 21, 2026
