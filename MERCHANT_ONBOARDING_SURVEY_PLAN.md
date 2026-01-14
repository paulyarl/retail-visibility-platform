# Merchant Onboarding Survey Implementation Plan

## Overview
Implement a pre-qualification survey that identifies which platforms merchants currently use, enabling personalized onboarding and data-driven integration priorities.

## Strategic Goals
1. **Immediate Value**: Show merchants we integrate with their existing tools
2. **Personalized Onboarding**: Route to relevant integrations immediately
3. **Product Intelligence**: Identify which integrations to prioritize
4. **Reduced Friction**: Skip irrelevant features, faster time-to-value

---

## Phase 1: Survey Design & Data Model (Week 1)

### Database Schema
Create `merchant_survey_responses` table:
```sql
CREATE TABLE merchant_survey_responses (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  tenant_id TEXT REFERENCES Tenant(id),
  
  -- Survey responses
  current_platforms JSONB, -- Array of platform names
  primary_pain_point TEXT,
  location_count TEXT,
  business_type TEXT,
  
  -- Metadata
  completed_at TIMESTAMP,
  survey_version TEXT,
  source TEXT, -- 'pre_signup', 'post_signup', 'settings'
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_survey_platforms ON merchant_survey_responses USING GIN (current_platforms);
CREATE INDEX idx_survey_tenant ON merchant_survey_responses(tenant_id);
```

### Survey Questions Schema
```typescript
interface SurveyResponse {
  currentPlatforms: Platform[];
  primaryPainPoint: PainPoint;
  locationCount: LocationCount;
  businessType?: string;
}

enum Platform {
  CLOVER_POS = 'clover_pos',
  SQUARE_POS = 'square_pos',
  SQUARE_PAYMENTS = 'square_payments',
  PAYPAL = 'paypal',
  SHOPIFY = 'shopify',
  WOOCOMMERCE = 'woocommerce',
  MANUAL_SPREADSHEET = 'manual_spreadsheet',
  OTHER = 'other'
}

enum PainPoint {
  INVENTORY_SYNC = 'inventory_sync',
  LOCAL_DISCOVERY = 'local_discovery',
  MULTI_LOCATION = 'multi_location',
  ANALYTICS = 'analytics',
  TIME_CONSUMING = 'time_consuming',
  OTHER = 'other'
}

enum LocationCount {
  SINGLE = 'single',
  TWO_TO_FIVE = '2-5',
  SIX_PLUS = '6+'
}
```

### Deliverables
- [ ] Prisma schema migration for survey table
- [ ] TypeScript types and enums
- [ ] Survey response validation schemas (Zod)

---

## Phase 2: Survey UI Components (Week 1-2)

### Components to Build

**1. SurveyModal Component** (`components/onboarding/SurveyModal.tsx`)
- Multi-step wizard interface
- Progress indicator
- Platform selection with icons
- Pain point selection
- Location count selector
- Skip option (with tracking)

**2. PlatformCheckbox Component** (`components/onboarding/PlatformCheckbox.tsx`)
- Platform logo/icon
- Platform name
- Description text
- Checkable state
- Visual feedback

**3. SurveyResults Component** (`components/onboarding/SurveyResults.tsx`)
- Admin view of survey data
- Platform popularity charts
- Pain point distribution
- Integration priority recommendations

### Survey Flow
```
Step 1: Welcome
  "Help us personalize your experience"
  
Step 2: Current Platforms (multi-select)
  ☐ Clover POS - "Sync your inventory automatically"
  ☐ Square POS - "Connect your Square account"
  ☐ Square Payments - "Accept online payments"
  ☐ PayPal - "Payment gateway integration"
  ☐ Shopify - "E-commerce platform"
  ☐ WooCommerce - "WordPress store"
  ☐ Manual/Spreadsheets - "We'll help you automate"
  ☐ Other: [text input]
  
Step 3: Primary Pain Point (single-select)
  ○ Keeping inventory updated across platforms
  ○ Getting found online by local customers
  ○ Managing multiple locations
  ○ Understanding what's selling
  ○ Too much manual work
  ○ Other: [text input]
  
Step 4: Business Size
  ○ Single location
  ○ 2-5 locations
  ○ 6+ locations
  
Step 5: Confirmation
  "Great! We'll set up your dashboard based on your needs"
  [Get Started] button
```

### Deliverables
- [ ] SurveyModal component with multi-step wizard
- [ ] PlatformCheckbox component with icons
- [ ] Survey validation and submission logic
- [ ] Loading and error states
- [ ] Mobile-responsive design

---

## Phase 3: Backend API & Logic (Week 2)

### API Endpoints

**POST /api/survey/submit**
```typescript
// Submit survey response
{
  currentPlatforms: string[],
  primaryPainPoint: string,
  locationCount: string,
  businessType?: string
}

Response: {
  success: true,
  recommendations: {
    suggestedIntegrations: string[],
    nextSteps: string[],
    dashboardConfig: object
  }
}
```

**GET /api/survey/analytics** (Admin only)
```typescript
// Get aggregated survey data
Response: {
  totalResponses: number,
  platformDistribution: { platform: string, count: number }[],
  painPointDistribution: { painPoint: string, count: number }[],
  locationDistribution: { range: string, count: number }[]
}
```

**GET /api/survey/response/:tenantId**
```typescript
// Get survey response for tenant
Response: {
  response: SurveyResponse | null,
  completedAt: Date | null
}
```

### Smart Routing Logic

**Integration Priority Service** (`services/IntegrationPriorityService.ts`)
```typescript
class IntegrationPriorityService {
  // Determine which integrations to show first
  getRecommendedIntegrations(platforms: Platform[]): Integration[] {
    const recommendations = [];
    
    if (platforms.includes('clover_pos')) {
      recommendations.push({
        type: 'clover',
        priority: 1,
        reason: 'Sync your Clover inventory automatically',
        ctaText: 'Connect Clover',
        ctaUrl: '/settings/integrations/clover'
      });
    }
    
    if (platforms.includes('square_pos') || platforms.includes('square_payments')) {
      recommendations.push({
        type: 'square',
        priority: 1,
        reason: 'Connect your Square account',
        ctaText: 'Connect Square',
        ctaUrl: '/settings/payment-gateways'
      });
    }
    
    // ... more logic
    
    return recommendations.sort((a, b) => a.priority - b.priority);
  }
  
  // Customize dashboard based on survey
  getDashboardConfig(response: SurveyResponse): DashboardConfig {
    const config = {
      showIntegrationBanner: true,
      highlightedFeatures: [],
      quickActions: []
    };
    
    // If using manual spreadsheets, highlight scanner
    if (response.currentPlatforms.includes('manual_spreadsheet')) {
      config.highlightedFeatures.push('barcode_scanner');
      config.quickActions.push('scan_products');
    }
    
    // If multi-location, highlight chain features
    if (response.locationCount !== 'single') {
      config.highlightedFeatures.push('chain_management');
    }
    
    return config;
  }
}
```

### Deliverables
- [ ] Survey submission API endpoint
- [ ] Survey analytics API endpoint (admin)
- [ ] Integration priority service
- [ ] Dashboard configuration service
- [ ] Survey response retrieval endpoint

---

## Phase 4: Integration Points (Week 3)

### 1. Post-Signup Onboarding
**Location**: After account creation, before first dashboard view

**Flow**:
```
Sign Up → Email Verification → Survey Modal → Personalized Dashboard
```

**Implementation**:
- Add survey completion flag to user/tenant
- Show modal on first login if not completed
- Store response and redirect to customized dashboard

### 2. Settings Page Prompt
**Location**: Settings → Integrations page

**Implementation**:
- Show "Help us recommend integrations" banner if survey not completed
- Inline survey form (collapsed by default)
- Update recommendations immediately after submission

### 3. Dashboard Personalization
**Location**: Main tenant dashboard

**Based on Survey**:
- **Clover users**: Show Clover connection card prominently
- **Square users**: Show Square OAuth connection
- **Manual users**: Highlight barcode scanner and Quick Start
- **Multi-location**: Show chain management features
- **Analytics pain point**: Highlight analytics dashboard

**Implementation**:
```typescript
// In TenantDashboard.tsx
const { surveyResponse } = useSurveyResponse(tenantId);
const recommendations = getRecommendedIntegrations(surveyResponse?.currentPlatforms || []);

return (
  <div>
    {recommendations.length > 0 && (
      <IntegrationRecommendations recommendations={recommendations} />
    )}
    {/* Rest of dashboard */}
  </div>
);
```

### 4. Admin Analytics Dashboard
**Location**: Admin → Platform Analytics

**Show**:
- Survey completion rate
- Platform distribution (pie chart)
- Pain point distribution (bar chart)
- Integration priority heatmap
- "Most requested integrations" list

### Deliverables
- [ ] Post-signup survey modal integration
- [ ] Settings page survey prompt
- [ ] Dashboard personalization based on survey
- [ ] Admin analytics dashboard
- [ ] Survey completion tracking

---

## Phase 5: Analytics & Optimization (Week 4)

### Metrics to Track

**Survey Metrics**:
- Completion rate (% who finish survey)
- Skip rate (% who skip survey)
- Time to complete
- Drop-off points (which step)

**Business Metrics**:
- Integration adoption rate by survey response
- Time-to-first-integration (surveyed vs non-surveyed)
- Retention rate (surveyed vs non-surveyed)
- Feature usage correlation with pain points

### Analytics Implementation

**Survey Analytics Service** (`services/SurveyAnalyticsService.ts`)
```typescript
class SurveyAnalyticsService {
  async getCompletionRate(): Promise<number> {
    // % of users who completed survey
  }
  
  async getPlatformDistribution(): Promise<PlatformStats[]> {
    // Count of each platform selected
  }
  
  async getIntegrationPriorities(): Promise<IntegrationPriority[]> {
    // Which integrations to build next based on demand
  }
  
  async getCorrelations(): Promise<Correlation[]> {
    // Pain point → Feature usage correlations
  }
}
```

### A/B Testing Considerations
- Test survey timing (immediate vs delayed)
- Test survey length (3 questions vs 5 questions)
- Test incentives ("Get 10% off" vs "Personalized setup")

### Deliverables
- [ ] Survey analytics service
- [ ] Admin analytics dashboard
- [ ] Completion rate tracking
- [ ] Integration priority recommendations
- [ ] A/B test framework (optional)

---

## Phase 6: Polish & Launch (Week 4-5)

### Pre-Launch Checklist
- [ ] Survey UI tested on mobile and desktop
- [ ] All API endpoints tested and documented
- [ ] Admin analytics dashboard functional
- [ ] Dashboard personalization working
- [ ] Survey can be skipped without breaking flow
- [ ] Survey responses stored securely
- [ ] Privacy policy updated (survey data usage)
- [ ] Analytics tracking implemented

### Launch Strategy
1. **Soft Launch**: Enable for new signups only
2. **Monitor**: Track completion rate and feedback
3. **Iterate**: Adjust questions based on data
4. **Expand**: Prompt existing users in settings
5. **Optimize**: A/B test timing and incentives

### Success Metrics (30 days post-launch)
- [ ] 60%+ survey completion rate
- [ ] 30%+ increase in integration adoption
- [ ] 20%+ faster time-to-first-integration
- [ ] Clear integration priority roadmap from data

---

## Technical Architecture

### Frontend Stack
- React components with TypeScript
- Form validation with Zod
- State management with React hooks
- UI components from existing design system

### Backend Stack
- Express.js API routes
- Prisma ORM for database
- PostgreSQL for storage
- JSON columns for flexible survey data

### Data Flow
```
User → Survey UI → API → Database → Analytics Service → Admin Dashboard
                    ↓
              Recommendations Service → Personalized Dashboard
```

---

## Integration Priority Intelligence

### How It Works
1. **Collect**: Survey responses show which platforms merchants use
2. **Aggregate**: Count platform mentions across all responses
3. **Prioritize**: Rank integrations by demand
4. **Build**: Focus development on high-demand integrations

### Example Output
```
Integration Priority Report (Based on 500 survey responses):
1. Shopify - 245 merchants (49%) - HIGH PRIORITY
2. Square POS - 180 merchants (36%) - HIGH PRIORITY
3. Clover POS - 120 merchants (24%) - MEDIUM PRIORITY
4. WooCommerce - 95 merchants (19%) - MEDIUM PRIORITY
5. PayPal - 450 merchants (90%) - ALREADY BUILT ✅
```

---

## Future Enhancements

### Phase 7+ (Post-Launch)
- [ ] Survey versioning (track changes over time)
- [ ] Multi-language support
- [ ] Industry-specific questions (retail vs restaurant vs service)
- [ ] Integration health scores (based on survey + usage)
- [ ] Predictive recommendations (ML-based)
- [ ] Survey reminders for incomplete responses
- [ ] Export survey data for external analysis

---

## Files to Create/Modify

### New Files
```
apps/api/src/routes/survey.ts
apps/api/src/services/SurveyService.ts
apps/api/src/services/IntegrationPriorityService.ts
apps/api/src/services/SurveyAnalyticsService.ts

apps/web/src/components/onboarding/SurveyModal.tsx
apps/web/src/components/onboarding/PlatformCheckbox.tsx
apps/web/src/components/onboarding/SurveyResults.tsx
apps/web/src/components/onboarding/IntegrationRecommendations.tsx
apps/web/src/hooks/useSurveyResponse.ts

packages/shared/src/types/survey.ts
```

### Modified Files
```
apps/api/prisma/schema.prisma (add survey table)
apps/web/src/components/dashboard/TenantDashboard.tsx (add personalization)
apps/web/src/app/(platform)/settings/integrations/page.tsx (add survey prompt)
apps/api/src/routes/index.ts (mount survey routes)
```

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Data Model | Week 1 | Database schema, TypeScript types |
| Phase 2: Survey UI | Week 1-2 | Survey modal, platform selection |
| Phase 3: Backend API | Week 2 | API endpoints, routing logic |
| Phase 4: Integration | Week 3 | Dashboard personalization, admin analytics |
| Phase 5: Analytics | Week 4 | Metrics tracking, optimization |
| Phase 6: Launch | Week 4-5 | Testing, deployment, monitoring |

**Total Estimated Time**: 4-5 weeks

---

## Success Criteria

✅ **User Experience**
- Survey completes in < 2 minutes
- 60%+ completion rate
- Clear value proposition shown

✅ **Business Impact**
- 30%+ increase in integration adoption
- 20%+ faster onboarding
- Clear integration roadmap from data

✅ **Technical Quality**
- Mobile responsive
- < 500ms API response time
- Secure data storage
- Admin analytics functional

---

## Next Steps After OAuth Testing

1. Review and approve this plan
2. Create Phase 1 database migration
3. Build survey UI components
4. Implement backend API
5. Integrate with onboarding flow
6. Launch and monitor

**This survey system will transform merchant onboarding from generic to personalized, while providing invaluable data for product roadmap decisions.**
