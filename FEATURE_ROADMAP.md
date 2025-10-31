# Retail Visibility Platform - Feature Roadmap & Sprint Blueprint

**Last Updated:** October 31, 2025  
**Status:** Post-Storefront Launch

---

## 🎯 Platform Vision

**From:** QR code generator with Google Shopping  
**To:** Complete omnichannel retail visibility platform

**Mission:** Be the Shopify for brick-and-mortar retail - the single source of truth for local retailers' online presence, Google visibility, and in-store marketing.

---

## 📊 Current State (Completed Features)

### ✅ Phase 1: Google Shopping Integration (MVP)
- Google Merchant Center integration
- Automatic product feed generation
- Product sync to Google Shopping
- Basic product pages

### ✅ Phase 2: Complete Storefront (Just Launched!)
- Public product catalog with pagination
- Product search functionality (database-level filtering)
- Interactive Google Maps integration
- Privacy mode for location display
- Mobile-responsive design
- Automatic SEO optimization
- QR code generation (512px, 1024px, 2048px)

### ✅ Phase 3: Google Business Profile Integration
- OAuth connection to Google Business Profile
- Business verification
- Location display on storefront
- Privacy controls (exact location vs neighborhood)

---

## 💰 Current Pricing Structure

### Individual Locations

#### Google-Only - $29/mo
**The "Foot in the Door" Tier**
- 250 SKUs
- Google Shopping feeds
- Google Merchant Center sync
- 512px QR codes
- Basic product pages
- Performance analytics
- ❌ No storefront

#### Starter - $49/mo
**Adds Complete Storefront**
- Everything in Google-Only, PLUS:
- 500 SKUs
- Complete storefront with product catalog
- Product search functionality
- Mobile-responsive design
- Enhanced SEO optimization

#### Professional - $149/mo (POPULAR)
**Adds Google Business Profile & Maps**
- Everything in Starter, PLUS:
- 5,000 SKUs
- Google Business Profile integration
- Interactive store location maps
- Privacy mode for location
- Business logo display
- Custom marketing copy
- Product image galleries (5 photos)
- Higher resolution QR codes (1024px)

#### Enterprise - $499/mo
**Adds White-Label Customization**
- Everything in Professional, PLUS:
- Unlimited SKUs
- White-label storefront (no platform branding)
- Custom domain for storefront
- Advanced map customization
- Custom branding & colors
- Product image galleries (10 photos)
- Ultra-high resolution QR codes (2048px)
- Priority support

### Chain Pricing
- Massive discounts for multiple locations
- Example: Chain Professional = $499/mo for 10 locations ($49.90/location)
- 79% savings vs competitors ($238+/location)

---

## 🚀 Next Major Features (Priority Order)

### 🔥 PRIORITY 1: Barcode Scanner Integration

**Why:** 85% time savings on product entry, major competitive advantage

**Implementation:**

#### Phase 1: USB Scanner Support (Quick Win - 1 week)
- Add barcode input field to product entry form
- Listen for keyboard input from USB scanner
- Basic UPC/EAN validation
- Manual barcode entry fallback

**Technical:**
```typescript
// Simple keyboard input listener
<input
  type="text"
  placeholder="Scan or type barcode"
  onKeyPress={(e) => {
    if (e.key === 'Enter' && value.length > 0) {
      lookupBarcode(value);
    }
  }}
/>
```

#### Phase 2: Product Lookup API (2 weeks)
- Integrate UPCitemdb.com API (100 free requests/day)
- Cache lookups in database (ProductTemplate table)
- Auto-populate: name, brand, category, description, images, MSRP
- User reviews/edits before saving

**API Endpoint:**
```typescript
GET /api/products/lookup-barcode/:barcode
- Check cache first
- Lookup in external API if not cached
- Return product details
- Cache for future lookups
```

#### Phase 3: Camera-Based Scanning (3 weeks)
- Mobile camera barcode scanning
- Use @zxing/library or quagga2
- Mobile-optimized UI
- Works on phones, tablets, laptops with webcam

**Libraries:**
- `@zxing/library` - Browser-based barcode scanning
- `quagga2` - Alternative with better mobile support

#### Phase 4: Bulk Scan Mode (1 week)
- Rapid scanning workflow
- Scan → Review → Next
- Queue multiple products
- Batch save

**User Flow:**
```
Store owner walks aisles with phone:
1. Open "Add Products"
2. Tap "Scan Barcode"
3. Camera opens
4. Point at barcode
5. Beep! Product details appear
6. Adjust price
7. Tap "Add & Scan Next"
8. Repeat

Result: Entire store inventory in 1-2 hours!
```

**Tier Distribution:**
- Google-Only: Manual barcode entry only
- Starter: Camera scanning + 100 lookups/month
- Professional: Unlimited lookups + USB scanner + bulk mode
- Enterprise: Everything + custom product database + API access

**Competitive Advantage:**
- Shopify: Manual entry only (or expensive apps)
- Square: Has scanning but costs $60-299/mo
- You: Built-in scanning at $49/mo

**Time Savings:**
- Old way: 2-3 hours for 50 products
- New way: 15-20 minutes for 50 products
- **85% faster!**

---

### 🔥 PRIORITY 2: Full Google Business Profile Sync

**Why:** Complete the Google integration suite, major value-add for Professional tier

**Current State:** GBP Integration (one-way connection)
- OAuth authentication
- Pull business info
- Display location on maps

**Target State:** Full GBP Sync (two-way synchronization)

#### Features to Add:

**1. Business Hours Sync (2 weeks)**
- Pull hours from GBP
- Display on storefront
- Two-way sync: update platform → updates GBP
- Special hours (holidays, events)

**2. Posts Sync (2 weeks)**
- Pull GBP posts to display on storefront
- Push platform updates as GBP posts
- "What's New" section on storefront
- Photo posts, offer posts, event posts

**3. Reviews Display (1 week)**
- Pull GBP reviews
- Display on storefront with star ratings
- Filter/sort reviews
- Respond to reviews from platform

**4. Q&A Integration (1 week)**
- Display GBP questions on storefront
- Answer from platform → syncs to GBP
- FAQ section auto-generated

**5. Photo Sync (1 week)**
- Two-way photo management
- Upload to platform → syncs to GBP
- Pull GBP photos to storefront gallery

**6. Product Sync (2 weeks)**
- Keep product catalog in sync with GBP products
- Update once, reflect everywhere
- Price sync, availability sync

**7. Attributes & Amenities (1 week)**
- Business attributes (wheelchair accessible, etc.)
- Amenities (parking, wifi, etc.)
- Service options (delivery, pickup, etc.)

**Marketing Update:**
- Change "GBP Integration" → "Full GBP Sync"
- Emphasize "Update once, reflect everywhere"
- Highlight automation and time savings

---

### 🔥 PRIORITY 3: Customer Reviews on Storefront

**Why:** Social proof, SEO benefits, customer engagement

**Features:**
- Customer review submission form
- Star ratings (1-5 stars)
- Photo reviews
- Verified purchase badges
- Review moderation/approval
- Display on product pages
- Aggregate ratings on storefront
- Review schema markup for SEO

**Integration:**
- Sync with GBP reviews
- Display both platform and GBP reviews
- Unified rating system

**Tier Distribution:**
- Starter: Display reviews only
- Professional: Collect reviews + moderation
- Enterprise: Advanced review features + incentives

---

### 🔥 PRIORITY 4: Basic Checkout / Lead Capture

**Why:** Convert storefront visitors to customers

**Not Full E-commerce (Yet):**
Focus on lead capture and in-store conversion:

**Options:**
1. **"Request Quote"** - Customer submits inquiry
2. **"Reserve in Store"** - Hold product for pickup
3. **"Call to Order"** - Direct phone number
4. **"Visit Store"** - Directions to location
5. **"Check Availability"** - Contact form

**Later:** Full checkout with payment processing

**Why This Approach:**
- Simpler to implement
- Drives foot traffic (your target!)
- No payment processing complexity
- No shipping/fulfillment needed
- Perfect for local retail

---

### 🔥 PRIORITY 5: Email Marketing Integration

**Why:** Customer retention, repeat business, promotions

**Features:**
- Email capture on storefront
- Newsletter signup
- Product update notifications
- Promotional campaigns
- Abandoned cart emails (when checkout added)
- New product announcements

**Integration Options:**
- Mailchimp API
- SendGrid
- Or build simple in-house system

**Tier Distribution:**
- Starter: Basic email capture
- Professional: Email campaigns (500 contacts)
- Enterprise: Unlimited contacts + automation

---

## 📈 Medium-Term Features (6-12 months)

### Inventory Management
- Track stock levels
- Low stock alerts
- Multi-location inventory
- Reorder points
- Supplier management

### Appointment Booking
- For service-based retailers
- Calendar integration
- Automated reminders
- Staff scheduling

### Loyalty Programs
- Points system
- Reward tiers
- Punch cards
- Referral bonuses

### SMS Marketing
- Text alerts for promotions
- Order status updates
- Appointment reminders
- Two-way messaging

### Multi-Channel Orders
- Sell on Google Shopping
- Facebook Marketplace integration
- Instagram Shopping
- Centralized order management

### Advanced Analytics
- Customer insights
- Product performance
- Sales forecasting
- ROI tracking
- Cohort analysis

---

## 🔮 Long-Term Features (12-24 months)

### Full POS Integration
- Connect with Square, Clover, Toast
- Real-time inventory sync
- In-store sales tracking
- Unified reporting

### Supplier Management
- Purchase orders
- Reordering automation
- Vendor catalogs
- Cost tracking

### Employee Management
- Staff accounts
- Role-based permissions
- Time tracking
- Commission tracking

### Advanced Reporting
- Business intelligence dashboard
- Custom reports
- Data exports
- API access

### White-Label Reseller Program
- Agencies can resell platform
- Custom branding
- Revenue sharing
- Partner portal

### Mobile App
- Native iOS/Android app
- In-store scanning
- Inventory management
- Order processing
- Push notifications

---

## 🎯 Competitive Positioning

### vs Shopify
**Shopify Strengths:**
- E-commerce transactions
- Massive app ecosystem
- Brand recognition
- Online-first businesses

**Your Strengths:**
- Local business focus (GBP, maps, QR codes)
- Google integration suite (Shopping + GBP + Maps)
- Pricing for small retailers ($29-149 vs $39-2000)
- Simplicity & speed (zero to online in minutes)
- Print-to-digital bridge (QR codes)
- Chain pricing (50-79% cheaper)

**Market Differentiation:**
- Shopify: "Build an online store"
- You: "Get discovered locally, online and in-store"

**Target Market:**
- 3.8 million retail stores in US
- Most don't have good online presence
- Most can't afford Shopify + local marketing tools
- You solve both for $29-149/mo

### vs Square
**Square Strengths:**
- POS hardware
- Payment processing
- Brand recognition

**Your Strengths:**
- Better online presence (storefront, SEO)
- Better Google integration
- Better chain pricing
- No hardware required
- Simpler setup

### vs Yext
**Yext Strengths:**
- Enterprise focus
- Multi-platform listings

**Your Strengths:**
- 75% cheaper ($149 vs $199-499)
- Includes e-commerce storefront
- Includes QR codes
- Simpler for small businesses

---

## 💡 Key Insights from Market Analysis

### Pricing Sweet Spot
- Google-Only ($29): Perfect foot-in-the-door
- Starter ($49): Massive value (storefront + Google)
- Professional ($149): Still 50% cheaper than competitors
- Enterprise ($499): Huge value for white-label

**Verdict:** Current pricing is aggressive but perfect for market penetration. Don't raise prices until 1,000+ customers.

### Upsell Journey
```
$29 Google-Only
  ↓ See Google traffic, want more control
$49 Starter
  ↓ Get storefront, want local customers
$149 Professional
  ↓ Get maps & GBP, want full control
$499 Enterprise
  ↓ White-label everything
```

### Chain Pricing = Game Changer
- $49.90/location vs $238+/location (79% savings)
- For 10-location chain: $1,881/mo savings = $22,572/year
- No competitor can match this
- **This alone could dominate the chain market**

---

## 📋 Implementation Notes

### Technology Stack
- **Frontend:** Next.js (App Router), React, TypeScript, TailwindCSS
- **Backend:** Node.js, Express, Prisma ORM
- **Database:** PostgreSQL
- **APIs:** Google Shopping, Google Business Profile, Google Maps
- **Hosting:** TBD (Vercel for frontend, Railway/Render for backend)

### Key Files
- `/apps/web/src/app/tenant/[id]/page.tsx` - Storefront page
- `/apps/web/src/components/storefront/ProductSearch.tsx` - Search component
- `/apps/web/src/components/tenant/TenantMapSection.tsx` - Map component
- `/apps/web/src/lib/map-utils.ts` - Map utilities
- `/apps/web/src/app/settings/offerings/page.tsx` - Pricing/tiers page
- `/apps/api/src/index.ts` - API endpoints

### Database Schema Additions Needed

#### For Barcode Scanner:
```prisma
model ProductTemplate {
  id          String   @id @default(cuid())
  barcode     String   @unique
  name        String
  brand       String?
  category    String?
  description String?
  images      Json?
  msrp        Decimal?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### For Reviews:
```prisma
model Review {
  id          String   @id @default(cuid())
  tenantId    String
  productId   String?
  rating      Int      // 1-5
  title       String?
  content     String
  authorName  String
  authorEmail String?
  photos      Json?
  verified    Boolean  @default(false)
  approved    Boolean  @default(false)
  createdAt   DateTime @default(now())
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  product     Product? @relation(fields: [productId], references: [id])
}
```

#### For Email Marketing:
```prisma
model EmailSubscriber {
  id          String   @id @default(cuid())
  tenantId    String
  email       String
  name        String?
  subscribed  Boolean  @default(true)
  source      String?  // "storefront", "checkout", etc.
  createdAt   DateTime @default(now())
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  @@unique([tenantId, email])
}

model EmailCampaign {
  id          String   @id @default(cuid())
  tenantId    String
  subject     String
  content     String
  sentAt      DateTime?
  createdAt   DateTime @default(now())
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
}
```

---

## 🎯 Success Metrics

### Phase 1 (Barcode Scanner) - Target Metrics:
- 80% of new products added via scanner (vs manual)
- Average product entry time: <30 seconds (vs 3-5 minutes)
- User satisfaction: 4.5+ stars
- Feature adoption: 60%+ of Professional+ users

### Phase 2 (Full GBP Sync) - Target Metrics:
- 90% of Professional users connect GBP
- Average time savings: 2+ hours/week
- Storefront completeness: 95%+ (all fields populated)
- Customer satisfaction: 4.7+ stars

### Phase 3 (Reviews) - Target Metrics:
- 30% of storefronts have reviews
- Average rating: 4.2+ stars
- Review conversion: 5% of storefront visitors leave review
- SEO impact: 20% increase in organic traffic

### Overall Platform - Target Metrics:
- Customer acquisition cost: <$50
- Lifetime value: $1,500+ (25+ months retention)
- Churn rate: <5% monthly
- Net Promoter Score: 50+
- Revenue per customer: $100/mo average

---

## 📞 Next Steps

1. **Review and prioritize** this roadmap with stakeholders
2. **Create detailed specs** for Priority 1 (Barcode Scanner)
3. **Set up project tracking** (GitHub Projects, Linear, etc.)
4. **Allocate resources** (dev time, API budgets, etc.)
5. **Define success metrics** for each feature
6. **Plan sprint schedule** (2-week sprints recommended)

---

## 📝 Notes

- This roadmap is flexible and should be adjusted based on customer feedback
- Focus on features that drive retention and reduce churn
- Always validate with real users before building
- Keep the platform simple - complexity is the enemy
- Under-promise, over-deliver

**Remember:** You're not competing with Shopify. You're serving a different market that Shopify ignores - local brick-and-mortar retailers who need Google visibility, in-store marketing, and simple online presence.

**Your competitive advantage:** Google integration + local focus + chain pricing + simplicity

---

*Last updated: October 31, 2025*
*Next review: After Priority 1 (Barcode Scanner) completion*
