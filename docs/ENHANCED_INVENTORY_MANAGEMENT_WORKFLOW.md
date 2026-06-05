# Enhanced Inventory Management Workflow
## Complete Product Lifecycle Management with Advanced Variant Support

---

## 🎯 Executive Summary

This document outlines a comprehensive inventory management workflow that transforms the current overloaded EditItemModal into a distributed, wizard-based system inspired by the shop management dashboard at `/t/[tenantId]/dashboard/shops/manage`. The workflow emphasizes **advanced variant management with individual photo support**, enabling users to clone parent products and customize variant-specific attributes including photos.

---

## � Full Spectrum Gap Analysis & Shop Management UX Retrofit

### 📊 Critical Gaps Identified

#### **🚨 Missing Shop Management UX Patterns**
1. **Dashboard-Centric Navigation** - No central inventory dashboard equivalent to shop management
2. **Quick Actions Section** - Missing fast-access actions like shop management's quick actions
3. **Status Indicators** - No comprehensive status badges/indicators system
4. **Bulk Operations Hub** - No centralized bulk management interface
5. **Analytics Integration** - Missing inventory analytics dashboard
6. **URL Information Display** - No product URL management like shop URLs
7. **Progress Tracking** - No workflow progress indicators
8. **Mobile-First Design** - Limited mobile optimization patterns

#### **🔧 Technical Architecture Gaps**
1. **State Management** - No centralized inventory state management
2. **Real-Time Updates** - Missing real-time inventory status updates
3. **Error Handling** - No comprehensive error recovery system
4. **Performance Optimization** - No lazy loading or virtualization
5. **Accessibility** - Missing WCAG compliance considerations
6. **Internationalization** - No i18n support for global markets

#### **🎯 User Experience Gaps**
1. **Onboarding Flow** - No guided onboarding for new users
2. **Help System** - Missing contextual help and tooltips
3. **Keyboard Navigation** - No keyboard shortcuts and navigation
4. **Undo/Redo** - No action reversal capabilities
5. **Search & Filtering** - Limited search and filter capabilities
6. **Export/Import** - Missing data portability features

---

## 🏪 Shop Management-Inspired UX Enhancements

### **📋 Central Inventory Dashboard (New Section)**

#### **Dashboard Layout Structure**
```typescript
interface InventoryDashboard {
  // Header Section (Shop Management Pattern)
  header: {
    title: string;
    subtitle: string;
    quickActions: QuickAction[];
    statusOverview: StatusOverview;
  };
  
  // Stats Overview (Shop Management Pattern)
  stats: {
    totalProducts: number;
    activeProducts: number;
    lowStockItems: number;
    outOfStockItems: number;
    pendingUpdates: number;
    variantCount: number;
  };
  
  // Main Content Areas
  content: {
    productList: ProductListSection;
    quickActions: QuickActionsSection;
    recentActivity: ActivityFeed;
    alerts: AlertSection;
  };
}
```

#### **Quick Actions Section (Shop Management Pattern)**
| Action | Icon | Description | Badge |
|--------|------|-------------|-------|
| Add Product | ➕ | Create new product | Primary |
| Bulk Upload | 📤 | Import multiple products | High Volume |
| Barcode Scan | 📷 | Scan barcode to add | AI-Powered |
| Quick Start | 🚀 | AI-powered catalog | Fastest |
| Enhance Products | ✨ | AI enhancement tools | Smart |
| Manage Variants | 🎯 | Advanced variant management | Advanced |

#### **Status Indicators (Shop Management Pattern)**
```typescript
interface ProductStatusIndicators {
  status: 'active' | 'draft' | 'archived' | 'out_of_stock' | 'low_stock';
  badges: {
    verified: boolean;
    featured: boolean;
    hasVariants: boolean;
    hasPhotos: boolean;
    enhanced: boolean;
  };
  healthScore: number; // 0-100 product completeness
}
```

### **🔄 Enhanced Product Card Design (Shop Management Pattern)**

#### **Product Card Structure**
```typescript
interface ProductCard {
  // Visual Header (Shop Management Pattern)
  header: {
    productImage: ImageInfo;
    productName: string;
    statusBadges: StatusBadge[];
    actionButtons: ActionButton[];
  };
  
  // Product Information
  info: {
    sku: string;
    price: PriceInfo;
    stock: StockInfo;
    category: CategoryInfo;
  };
  
  // URL Information Display (Shop Management Pattern)
  urls: {
    storefrontUrl: string;
    directoryUrl: string;
    googleShoppingUrl: string;
    copyButtons: CopyButton[];
  };
  
  // Variant Information
  variants: {
    hasVariants: boolean;
    variantCount: number;
    variantPreview: VariantPreview[];
  };
  
  // Quick Actions (Shop Management Pattern)
  quickActions: {
    edit: Button;
    duplicate: Button;
    enhance: Button;
    manageVariants: Button;
    viewAnalytics: Button;
  };
}
```

### **📊 Analytics Integration (Shop Management Pattern)**

#### **Inventory Analytics Dashboard**
```typescript
interface InventoryAnalytics {
  // Performance Metrics
  performance: {
    totalViews: number;
    conversionRate: number;
    averageRating: number;
    reviewCount: number;
  };
  
  // Inventory Health
  health: {
    lowStockAlerts: number;
    outOfStockItems: number;
    overstockItems: number;
    deadStockItems: number;
  };
  
  // Sales Data
  sales: {
    totalRevenue: number;
    topSellingProducts: ProductSales[];
    categoryPerformance: CategorySales[];
    variantPerformance: VariantSales[];
  };
}
```

### **🎯 Enhanced Wizard Navigation (Shop Management Pattern)**

#### **Progress Indicators**
```typescript
interface WizardProgress {
  currentStep: number;
  totalSteps: number;
  stepProgress: {
    [stepNumber: number]: {
      completed: boolean;
      valid: boolean;
      errors: string[];
      warnings: string[];
    };
  };
  overallProgress: number; // 0-100
}
```

#### **Step Navigation (Shop Management Pattern)**
```typescript
interface StepNavigation {
  previous: {
    enabled: boolean;
    label: string;
    saveProgress: boolean;
  };
  next: {
    enabled: boolean;
    label: string;
    skipValidation: boolean;
  };
  save: {
    enabled: boolean;
    label: string;
    saveAsDraft: boolean;
  };
  cancel: {
    enabled: boolean;
    label: string;
    confirmDialog: boolean;
  };
}
```

---

## 🔧 Technical Architecture Enhancements

### **🗂️ State Management System**

#### **Centralized State Management**
```typescript
interface InventoryState {
  // Product Data
  products: Product[];
  variants: ProductVariant[];
  categories: Category[];
  
  // UI State
  selectedProducts: string[];
  filters: FilterState;
  sorting: SortState;
  pagination: PaginationState;
  
  // Wizard State
  wizard: {
    currentStep: number;
    stepData: StepData[];
    validation: ValidationState;
    progress: ProgressState;
  };
  
  // Real-time Updates
  realTime: {
    stockUpdates: StockUpdate[];
    priceUpdates: PriceUpdate[];
    statusUpdates: StatusUpdate[];
  };
}
```

#### **Real-Time Updates (Shop Management Pattern)**
```typescript
interface RealTimeInventory {
  // WebSocket Connection
  connection: WebSocket;
  
  // Update Types
  updates: {
    stockChange: StockChangeUpdate;
    priceChange: PriceChangeUpdate;
    statusChange: StatusChangeUpdate;
    variantChange: VariantChangeUpdate;
  };
  
  // Update Handlers
  handlers: {
    onStockUpdate: (update: StockChangeUpdate) => void;
    onPriceUpdate: (update: PriceChangeUpdate) => void;
    onStatusUpdate: (update: StatusChangeUpdate) => void;
  };
}
```

### **📱 Mobile-First Design (Shop Management Pattern)**

#### **Responsive Design Patterns**
```typescript
interface MobileOptimization {
  // Layout Adaptation
  layout: {
    mobile: MobileLayout;
    tablet: TabletLayout;
    desktop: DesktopLayout;
  };
  
  // Touch Interactions
  interactions: {
    swipeGestures: boolean;
    pullToRefresh: boolean;
    longPressActions: boolean;
  };
  
  // Performance
  performance: {
    lazyLoading: boolean;
    virtualScrolling: boolean;
    imageOptimization: boolean;
  };
}
```

---

## 🎯 Enhanced User Experience Features

### **🔍 Advanced Search & Filtering (Shop Management Pattern)**

#### **Search System**
```typescript
interface AdvancedSearch {
  // Search Types
  searchTypes: {
    text: TextSearch;
    barcode: BarcodeSearch;
    image: ImageSearch;
    voice: VoiceSearch;
  };
  
  // Filter Options
  filters: {
    category: CategoryFilter;
    price: PriceRangeFilter;
    stock: StockFilter;
    status: StatusFilter;
    attributes: AttributeFilter;
    dateRange: DateRangeFilter;
  };
  
  // Search Results
  results: {
    products: Product[];
    totalCount: number;
    facets: SearchFacets[];
    suggestions: SearchSuggestion[];
  };
}
```

### **⌨️ Keyboard Navigation (Shop Management Pattern)**

#### **Keyboard Shortcuts**
```typescript
interface KeyboardShortcuts {
  // Navigation
  navigation: {
    'Ctrl+N': 'New Product';
    'Ctrl+F': 'Search';
    'Ctrl+U': 'Bulk Upload';
    'Ctrl+E': 'Enhance Products';
  };
  
  // Actions
  actions: {
    'Space': 'Toggle Selection';
    'Enter': 'Edit Selected';
    'Delete': 'Delete Selected';
    'Ctrl+C': 'Copy Product';
    'Ctrl+V': 'Paste Product';
  };
  
  // Wizard Navigation
  wizard: {
    'Tab': 'Next Field';
    'Shift+Tab': 'Previous Field';
    'Ctrl+Enter': 'Save & Continue';
    'Escape': 'Cancel';
  };
}
```

### **↩️ Undo/Redo System (Shop Management Pattern)**

#### **Action History**
```typescript
interface ActionHistory {
  // Action Stack
  actions: {
    undo: Action[];
    redo: Action[];
  };
  
  // Action Types
  actionTypes: {
    create: CreateAction;
    update: UpdateAction;
    delete: DeleteAction;
    bulk: BulkAction;
  };
  
  // History Management
  management: {
    maxHistorySize: number;
    autoSave: boolean;
    clearOnLogout: boolean;
  };
}
```

---

## 🌐 Accessibility & Internationalization

### **♿ Accessibility Features (Shop Management Pattern)**

#### **WCAG Compliance**
```typescript
interface AccessibilityFeatures {
  // Screen Reader Support
  screenReader: {
    ariaLabels: boolean;
    descriptions: boolean;
    announcements: boolean;
  };
  
  // Keyboard Navigation
  keyboard: {
    tabOrder: boolean;
    skipLinks: boolean;
    shortcuts: boolean;
  };
  
  // Visual Accessibility
  visual: {
    highContrast: boolean;
    largeText: boolean;
    colorBlindFriendly: boolean;
  };
}
```

### **🌍 Internationalization (Shop Management Pattern)**

#### **Multi-Language Support**
```typescript
interface Internationalization {
  // Language Support
  languages: {
    default: string;
    supported: string[];
    fallback: string;
  };
  
  // Localization
  localization: {
    currency: CurrencyFormat;
    date: DateFormat;
    number: NumberFormat;
    units: UnitSystem;
  };
  
  // Content Translation
  translation: {
    staticContent: boolean;
    dynamicContent: boolean;
    userGenerated: boolean;
  };
}
```

---

## 📈 Performance & Optimization

### **⚡ Performance Optimizations (Shop Management Pattern)**

#### **Loading Strategies**
```typescript
interface PerformanceOptimization {
  // Lazy Loading
  lazyLoading: {
    images: boolean;
    components: boolean;
    routes: boolean;
  };
  
  // Virtual Scrolling
  virtualScrolling: {
    enabled: boolean;
    itemHeight: number;
    bufferSize: number;
  };
  
  // Caching
  caching: {
    apiResponses: boolean;
    images: boolean;
    components: boolean;
  };
  
  // Code Splitting
  codeSplitting: {
    routes: boolean;
    components: boolean;
    vendorLibraries: boolean;
  };
}
```

---

## 🔧 Error Handling & Recovery

### **🚨 Error Management System (Shop Management Pattern)**

#### **Error Handling**
```typescript
interface ErrorHandling {
  // Error Types
  errorTypes: {
    network: NetworkError;
    validation: ValidationError;
    business: BusinessError;
    system: SystemError;
  };
  
  // Error Recovery
  recovery: {
    autoRetry: boolean;
    fallbackContent: boolean;
    errorBoundary: boolean;
    gracefulDegradation: boolean;
  };
  
  // User Communication
  communication: {
    errorMessages: ErrorMessage[];
    helpLinks: HelpLink[];
    supportContact: SupportInfo;
  };
}
```

---

## 📚 Help System & Onboarding

### **📖 Contextual Help (Shop Management Pattern)**

#### **Help System**
```typescript
interface HelpSystem {
  // Help Types
  helpTypes: {
    tooltips: Tooltip[];
    walkthroughs: Walkthrough[];
    documentation: Documentation[];
    videos: VideoTutorial[];
  };
  
  // Context Awareness
  context: {
    currentStep: string;
    userRole: string;
    previousActions: string[];
    skillLevel: 'beginner' | 'intermediate' | 'advanced';
  };
  
  // Onboarding
  onboarding: {
    firstTimeUser: boolean;
    featureIntroduction: boolean;
    guidedTour: boolean;
    progressTracking: boolean;
  };
}
```

---

## 🔄 Enhanced Workflow Integration

### **📊 Data Portability (Shop Management Pattern)**

#### **Export/Import System**
```typescript
interface DataPortability {
  // Export Options
  export: {
    formats: ['CSV', 'Excel', 'JSON', 'XML'];
    filters: ExportFilter[];
    scheduling: ExportSchedule[];
    automation: ExportAutomation[];
  };
  
  // Import Options
  import: {
    formats: ['CSV', 'Excel', 'JSON', 'XML'];
    validation: ImportValidation[];
    mapping: FieldMapping[];
    preview: ImportPreview[];
  };
  
  // Sync Options
  sync: {
    realTime: boolean;
    batchProcessing: boolean;
    conflictResolution: ConflictResolution[];
  };
}
```

---

## 🎯 Success Metrics (Enhanced)

### **📊 Comprehensive KPIs (Shop Management Pattern)**

#### **User Experience Metrics**
```typescript
interface SuccessMetrics {
  // Efficiency Metrics
  efficiency: {
    timeToCreate: number;      // Target: 60% reduction
    timeToEdit: number;        // Target: 50% reduction
    timeToVariant: number;     // Target: 80% reduction
    errorRate: number;         // Target: 90% reduction
  };
  
  // Engagement Metrics
  engagement: {
    userSatisfaction: number;  // Target: 4.5+ stars
    featureAdoption: number;   // Target: 75% adoption
    retentionRate: number;     // Target: 85% retention
    supportTickets: number;    // Target: 50% reduction
  };
  
  // Business Metrics
  business: {
    productQuality: number;    // Target: 75% improvement
    conversionRate: number;    // Target: 25% increase
    inventoryTurnover: number; // Target: 30% improvement
    dataAccuracy: number;      // Target: 95% accuracy
  };
}
```

---

## 🚀 Implementation Roadmap (Enhanced)

### **📅 Phased Implementation with Shop Management Patterns**

#### **Phase 1: Foundation & Dashboard (Weeks 1-3)**
- ✅ Central inventory dashboard (Shop Management Pattern)
- ✅ Quick actions section (Shop Management Pattern)
- ✅ Status indicators system (Shop Management Pattern)
- ✅ Basic wizard structure with progress tracking
- ✅ Mobile-first responsive design

#### **Phase 2: Core Features & UX (Weeks 4-6)**
- ✅ Enhanced product cards with URL display (Shop Management Pattern)
- ✅ Advanced search and filtering (Shop Management Pattern)
- ✅ Keyboard navigation system (Shop Management Pattern)
- ✅ Undo/redo functionality (Shop Management Pattern)
- ✅ Real-time inventory updates (Shop Management Pattern)

#### **Phase 3: Advanced Features (Weeks 7-9)**
- ✅ Analytics dashboard integration (Shop Management Pattern)
- ✅ Bulk operations hub (Shop Management Pattern)
- ✅ Help system and onboarding (Shop Management Pattern)
- ✅ Error handling and recovery (Shop Management Pattern)
- ✅ Performance optimizations (Shop Management Pattern)

#### **Phase 4: Polish & Accessibility (Weeks 10-12)**
- ✅ Accessibility compliance (WCAG 2.1)
- ✅ Internationalization support
- ✅ Data portability features
- ✅ Comprehensive testing
- ✅ Documentation and training materials

---

## 📋 Conclusion (Enhanced)

This enhanced inventory management workflow transforms the current overloaded modal system into a **professional, shop management-inspired dashboard experience** with **advanced variant support including individual photos**. By incorporating the successful UX patterns from the shop management dashboard, we create a cohesive, intuitive experience that users already understand and appreciate.

**Key Enhancements Added:**
- ✅ **Central Dashboard** - Shop management-inspired inventory hub
- ✅ **Quick Actions** - Fast-access action buttons
- ✅ **Status Indicators** - Comprehensive badge system
- ✅ **URL Display** - Product URL management like shops
- ✅ **Analytics Integration** - Performance metrics dashboard
- ✅ **Mobile-First Design** - Responsive across all devices
- ✅ **Real-Time Updates** - Live inventory status
- ✅ **Advanced Search** - Powerful filtering capabilities
- ✅ **Keyboard Navigation** - Power user shortcuts
- ✅ **Undo/Redo System** - Action reversal capabilities
- ✅ **Help System** - Contextual guidance
- ✅ **Accessibility** - WCAG 2.1 compliance
- ✅ **Internationalization** - Global market support

**Shop Management UX Patterns Applied:**
- 🎯 Dashboard-centric navigation
- 🎯 Quick action buttons
- 🎯 Status badge system
- 🎯 URL information display
- 🎯 Analytics integration
- 🎯 Mobile optimization
- 🎯 Progressive disclosure
- 🎯 Contextual help

This enhanced workflow positions the platform as a leader in inventory management with **shop management-quality UX** and **enterprise-grade variant capabilities** while maintaining ease of use for businesses of all sizes.

---

## �🔄 Current State Analysis

### 📊 Current EditItemModal Issues
- **Feature Overload**: 15+ features crammed into a single modal
- **Poor UX**: Overwhelming interface with no logical grouping
- **Variant Limitations**: No individual variant photo support
- **No Progressive Disclosure**: All complexity shown at once
- **Mobile Unfriendly**: Complex modal doesn't adapt well to mobile

### 🎯 Design Philosophy
- **Logical Grouping**: Related features organized into focused steps
- **Progressive Disclosure**: Show complexity gradually
- **Focused Context**: Each wizard step has clear purpose
- **Professional UX**: Modern, guided experience
- **Variant-First**: Advanced variant capabilities throughout

---

## 🚀 Enhanced Product Entry Workflows

### 📸 Multi-Method Barcode Scanning with Enrichment

#### 🔍 Four Scanning Methods

| Method | Icon | Description | Tier | Features |
|--------|------|-------------|------|----------|
| **Manual Entry** | ⌨️ | Type barcode number manually | Basic | • Auto-complete suggestions<br>• Barcode format validation<br>• Recent barcode history<br>• Bulk manual entry |
| **Camera Scanning** | 📷 | Use device camera for scanning | Professional | • Auto-focus detection<br>• Multi-format support (UPC, EAN, QR)<br>• Batch scanning mode<br>• Instant preview |
| **USB Scanner** | 🔌 | Professional USB scanner integration | Professional+ | • Plug-and-play detection<br>• High-speed scanning<br>• Continuous scanning mode<br>• Scanner type auto-detection |
| **Mobile App** | 📱 | Dedicated mobile app scanning | Enterprise | • Native camera integration<br>• Offline scanning capability<br>• Batch upload<br>• GPS location tagging |

#### 🤖 Intelligent Enrichment Pipeline

**Data Sources:**
- Universal Product Database (Core product data)
- Nutrition Database (USDA food information)
- Environmental Database (Sustainability data)
- Manufacturer Catalogs (Official specifications)
- Competitor Listings (Market intelligence)
- Marketplace Data (Amazon, eBay insights)
- Social Media Data (Visual content)
- Review Databases (Customer insights)

**Enrichment Categories:**

| Category | Fields | Confidence | Sources |
|----------|--------|------------|---------|
| **Basic Info** | Name, Brand, Manufacturer, Model, MPN | High | Universal DB, Manufacturer |
| **Descriptions** | Short, Detailed, Marketing Copy | Medium | Manufacturer, Competitors, AI |
| **Images** | Primary, Gallery, Lifestyle | High | Manufacturer, Social, Marketplace |
| **Nutrition** | Calories, Protein, Carbs, Vitamins | Very High | Nutrition DB, Manufacturer |
| **Environmental** | Carbon Footprint, Recyclability | Medium | Environmental DB, Manufacturer |
| **Pricing** | Market Range, Competitor Pricing | Medium | Competitors, Marketplace |
| **Specifications** | Technical Specs, Dimensions, Weight | High | Manufacturer, Universal DB |

---

## 🎨 Distributed Wizard-Based Workflow

### 📋 7-Step Product Creation Wizard

#### 🔥 Step 1: Basic Information
**Purpose**: Establish core product identity
```typescript
interface BasicInfoStep {
  name: string;                    // Product name
  brand: string;                   // Product brand
  condition: 'new' | 'used' | 'refurbished';
  status: 'draft' | 'active' | 'archived';
  
  preview: {
    name: string;
    brand: string;
    status: string;
  };
}
```

**Fields:**
- Product Name (Required, min 3 chars)
- Brand (Optional)
- Condition (Select: New/Used/Refurbished)
- Status (Toggle: Draft/Active)

**Validation:**
- Real-time name validation
- Brand suggestions from existing products
- Condition-based workflow adjustments

---

#### 🏷️ Step 2: Product Type & Variant Configuration
**Purpose**: Configure product type and advanced variant setup

```typescript
interface ProductTypeStep {
  productType: 'physical' | 'digital' | 'hybrid';
  hasVariants: boolean;
  variants: ProductVariant[];
  variantConfig: {
    cloningEnabled: boolean;
    individualPhotos: boolean;
    attributeTypes: string[];
  };
  digitalConfig?: DigitalProductData;
  physicalConfig?: {
    mpn: string;
    weight?: string;
    dimensions?: string;
  };
}
```

**🎯 Enhanced Variant Workflow Features:**

##### **Variant Creation Methods**
1. **From Scratch**: Create variants manually
2. **Clone Parent**: Clone parent product with variant-specific changes
3. **Template Based**: Use existing variant templates
4. **Import Variants**: Import from CSV/Excel

##### **Individual Variant Photo Support**
```typescript
interface ProductVariant {
  id?: string;
  sku: string;
  variant_name: string;
  price_cents: number;
  sale_price_cents?: number;
  stock: number;
  
  // 📸 INDIVIDUAL PHOTO SUPPORT
  image_url?: string;              // Variant-specific primary image
  image_gallery?: ImageInfo[];     // Variant-specific gallery
  cloned_from_parent?: boolean;    // Track cloning origin
  
  attributes: Record<string, string>;
  sort_order: number;
  is_active: boolean;
}
```

##### **🎯 Enhanced Variant Interface (Retaining Existing Nifty Features)**
```typescript
interface ProductVariant {
  id?: string;
  sku: string;
  variant_name: string;
  price_cents: number;
  sale_price_cents?: number;
  stock: number;
  
  // 📸 INDIVIDUAL PHOTO SUPPORT
  image_url?: string;              // Variant-specific primary image
  image_gallery?: ImageInfo[];     // Variant-specific gallery
  cloned_from_parent?: boolean;    // Track cloning origin
  
  // 🔥 EXISTING NIFTY FEATURES - RETAINED
  attributes: Record<string, string>;  // JSON storage for flexible attributes
  sort_order: number;
  is_active: boolean;
  
  // 🆕 NEW: Numeric Slider Support
  sliderInputs: {
    listPrice: SliderInputConfig;    // Numeric slider for list price
    salePrice: SliderInputConfig;    // Numeric slider for sale price
    stock: SliderInputConfig;         // Numeric slider for stock
  };
}

// 🆕 Numeric Slider Configuration
interface SliderInputConfig {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;                    // '$' for prices, 'units' for stock
  precision: number;               // Decimal places
  enabled: boolean;                // Can be disabled for inherited values
}

// 🔥 RETAINED: Auto-SKU Generator
interface AutoSKUGenerator {
  pattern: string;                  // e.g., "{parentSku}-{size}-{color}"
  attributeMapping: Record<string, string>;  // Map attributes to SKU parts
  autoIncrement: boolean;           // Add auto-increment if needed
  separator: string;                // Separator between parts
}

// 🔥 RETAINED: Flexible JSON Attribute Storage
interface FlexibleAttributes {
  standardAttributes: {
    size: string;
    color: string;
    material: string;
    style: string;
  };
  customAttributes: Record<string, {
    type: 'text' | 'number' | 'select' | 'boolean';
    value: any;
    required: boolean;
    options?: string[];             // For select type
  }>;
  attributeTemplates: AttributeTemplate[];  // Reusable attribute sets
}
```

##### **🎯 Enhanced Variant Cloning Workflow**
1. **Parent Selection**: Choose parent product to clone
2. **Attribute Configuration**: Define variant attributes using flexible JSON storage
3. **Photo Options**:
   - Clone parent photos
   - Upload variant-specific photos
   - Mix: Clone some, upload others
4. **🆕 Numeric Slider Setup**: Configure pricing and stock sliders
5. **🔥 Auto-SKU Generation**: Automatic SKU generation based on attributes
6. **Customization**: Modify variant-specific details
7. **Bulk Generation**: Create multiple variants at once

**🔥 Retained Nifty Features:**
- **Auto-SKU Generator**: `{parentSku}-{size}-{color}` patterns with auto-increment
- **JSON Attribute Storage**: Flexible attribute creation with custom types
- **Attribute Templates**: Reusable attribute sets for similar products
- **Dynamic Attribute Types**: Text, number, select, boolean with validation

**🆕 New Numeric Slider Features:**
- **List Price Slider**: Visual price adjustment with min/max bounds
- **Sale Price Slider**: Discount pricing with percentage/absolute options
- **Stock Slider**: Inventory quantity with bulk adjustment capabilities
- **Bulk Slider Operations**: Apply slider changes to multiple variants

**Variant Attribute Types (Enhanced):**
- **Standard**: Size, Color, Material, Style (with templates)
- **Custom**: Any user-defined attribute with JSON storage
- **Conditional**: Show/hide based on product type or other attributes
- **Required**: Must be filled for variant creation
- **Validated**: Type-specific validation (number ranges, select options, etc.)

---

#### 💰 Step 3: Pricing Strategy
**Purpose**: Set up pricing and payment configuration with numeric sliders

```typescript
interface PricingStep {
  listPrice: number;
  salePrice?: number;
  
  // 🆕 NUMERIC SLIDER CONFIGURATION
  sliderConfiguration: {
    listPrice: {
      enabled: boolean;
      min: number;
      max: number;
      step: 0.01;
      unit: '$';
      bulkAdjustment: boolean;      // Enable bulk slider adjustments
    };
    salePrice: {
      enabled: boolean;
      min: number;
      max: number;
      step: 0.01;
      unit: '$';
      discountMode: 'percentage' | 'absolute';
      bulkAdjustment: boolean;
    };
    stock: {
      enabled: boolean;
      min: 0;
      max: 10000;
      step: 1;
      unit: 'units';
      bulkAdjustment: boolean;
    };
  };
  
  // Variant-specific pricing
  variantPricing: {
    enabled: boolean;
    type: 'inherit' | 'override' | 'formula';
    priceAdjustments: VariantPriceAdjustment[];
    sliderInheritance: {
      inheritListPrice: boolean;
      inheritSalePrice: boolean;
      inheritStock: boolean;
    };
  };
  
  gatewaySelection: {
    gateway_type: string | null;
    gateway_id: string | null;
  };
  
  pricingStrategy: 'fixed' | 'variable' | 'subscription';
  bulkPricing?: BulkPricingTier[];
  subscriptionPricing?: SubscriptionPricing;
}
```

**🆕 Numeric Slider Interface Features:**

##### **List Price Slider**
- **Visual Control**: Drag slider for instant price updates
- **Precise Input**: Click to enter exact values
- **Bulk Operations**: Apply price changes to multiple variants
- **Range Limits**: Min/max bounds based on product category
- **Real-time Preview**: See profit margins update as you adjust

##### **Sale Price Slider**
- **Discount Modes**: 
  - Percentage discount (e.g., 20% off)
  - Absolute discount (e.g., $5 off)
- **Visual Indicator**: Show discount percentage/benefit
- **Auto-calculation**: Automatically calculate profit margins
- **Bulk Discounts**: Apply sale pricing to variant groups

##### **Stock Slider**
- **Inventory Control**: Visual stock quantity management
- **Bulk Updates**: Update stock for multiple variants
- **Low Stock Alerts**: Visual indicators when stock is low
- **Reorder Points**: Set automatic reorder thresholds

**🔥 Enhanced Variant Pricing Options:**
- **Inherit**: All variants use parent price (sliders disabled)
- **Override**: Individual variant prices with independent sliders
- **Formula**: Price based on attributes (e.g., size + material premiums)
- **Bulk Override**: Apply slider changes to selected variants

**🆕 Bulk Slider Operations:**
```typescript
interface BulkSliderOperation {
  operation: 'set' | 'increase' | 'decrease' | 'multiply';
  targetVariants: string[];           // Variant IDs to affect
  field: 'listPrice' | 'salePrice' | 'stock';
  value: number;
  unit: 'absolute' | 'percentage';
  preview: boolean;                  // Show changes before applying
}
```

**Slider Workflow Examples:**
1. **Individual Variant**: Adjust single variant with dedicated sliders
2. **Bulk Adjustment**: Select variants → Apply bulk slider change
3. **Formula Pricing**: Base price + attribute adjustments via sliders
4. **Inheritance Mode**: Parent price controls, variants inherit

---

#### 📝 Step 4: Content & Marketing
**Purpose**: Create compelling product descriptions and marketing content

```typescript
interface ContentStep {
  description: string;
  enhancedDescription: string;
  features: string[];
  specifications: Record<string, any>;
  
  // Variant-specific content
  variantContent: {
    enabled: boolean;
    perVariantDescriptions: Record<string, string>;
    variantSpecificFeatures: Record<string, string[]>;
  };
  
  seoTitle?: string;
  seoDescription?: string;
  tags: string[];
}
```

**AI-Powered Content Generation:**
- Generate enhanced descriptions
- Create variant-specific marketing copy
- SEO optimization per variant
- Feature extraction from images

---

#### 🖼️ Step 5: Media & Visuals
**Purpose**: Upload and optimize product images with variant support

```typescript
interface MediaStep {
  primaryImage: ImageInfo;
  galleryImages: ImageInfo[];
  
  // 📸 VARIANT PHOTO MANAGEMENT
  variantMedia: {
    cloningStrategy: 'clone_all' | 'clone_some' | 'upload_all';
    parentImagesToClone: string[];     // Which parent images to clone
    variantSpecificImages: Record<string, {
      primary: ImageInfo;
      gallery: ImageInfo[];
    }>;
    batchUpload: boolean;              // Upload multiple variant images
  };
  
  videoUrl?: string;
  videoThumbnail?: string;
}
```

**🎯 Variant Photo Workflow:**

##### **Photo Cloning Options**
1. **Clone All**: Use parent photos for all variants
2. **Clone Some**: Select specific parent photos to clone
3. **Upload All**: Upload unique photos for each variant
4. **Mixed Approach**: Clone some + upload variant-specific

##### **Batch Variant Photo Upload**
- Drag & drop multiple variant photos
- Auto-assign based on file naming (e.g., "product-red-large.jpg")
- Preview all variant photos in grid
- Bulk photo optimization

##### **Photo Management Features**
- **Variant Photo Gallery**: Individual photo galleries per variant
- **Photo Inheritance**: Automatic photo inheritance from parent
- **Override Capability**: Replace inherited photos with variant-specific ones
- **Bulk Operations**: Apply photo changes to multiple variants

---

#### 📁 Step 6: Organization & Categories
**Purpose**: Organize product with categories and tags

```typescript
interface OrganizationStep {
  primaryCategory: CategoryInfo;
  secondaryCategories?: CategoryInfo[];
  tags: string[];
  labels: ProductLabel[];
  
  // Variant organization
  variantOrganization: {
    individualCategories: boolean;      // Different categories per variant
    variantTags: Record<string, string[]>; // Tags per variant
    variantCollections: Record<string, string[]>; // Collections per variant
  };
  
  channels: {
    storefront: boolean;
    directory: boolean;
    googleShopping: boolean;
    socialMedia: boolean;
  };
}
```

---

#### ✅ Step 7: Review & Publish
**Purpose**: Final review and publishing with variant validation

```typescript
interface ReviewStep {
  productSummary: CompleteProductSummary;
  
  // 🎯 VARIANT QUALITY CHECKS
  variantQualityChecks: {
    completeness: Record<string, number>;    // Per variant completeness
    imageQuality: Record<string, number>;    // Per variant image quality
    priceConsistency: boolean;               // Price logic validation
    attributeValidation: Record<string, boolean>; // Attribute validation
    photoCoverage: boolean;                  // All variants have photos
  };
  
  publishingOptions: {
    publishImmediately: boolean;
    schedulePublishing?: Date;
    notifyCustomers: boolean;
    createPromotion: boolean;
    publishVariants: 'all' | 'selected' | 'none';
  };
}
```

**Variant Validation Features:**
- Completeness scoring per variant
- Photo coverage validation
- Price consistency checks
- Attribute requirement validation
- SEO optimization per variant

---

## � Advanced Variant Management System

### 🔥 Retained Nifty Features (Enhanced)

#### **Auto-SKU Generator**
```typescript
// Enhanced Auto-SKU Generation with Pattern Support
interface EnhancedAutoSKUGenerator {
  patterns: {
    default: "{parentSku}-{size}-{color}";           // JEANS-32-BLUE
    withBrand: "{brand}-{category}-{size}-{color}";   // LEVI-JEANS-32-BLUE
    withCollection: "{collection}-{parentSku}-{attr}"; // SUMMER-JEANS-32
  };
  
  autoIncrement: {
    enabled: boolean;
    startNumber: number;
    padding: number;                    // Zero-padding (001, 002, etc.)
    separator: string;                  // Separator between parts
  };
  
  attributeMapping: {
    size: ["S", "M", "L", "XL", "32", "34", "36"];
    color: ["RED", "BLUE", "BLACK", "WHITE", "GREEN"];
    material: ["COTTON", "DENIM", "LEATHER", "POLYESTER"];
  };
  
  validation: {
    checkDuplicates: boolean;
    enforceUniqueness: boolean;
    reservedPatterns: string[];
  };
}
```

**Auto-SKU Features:**
- **Pattern Templates**: Pre-defined SKU patterns for different product types
- **Smart Mapping**: Automatic attribute value mapping (e.g., "Small" → "S")
- **Duplicate Prevention**: Real-time duplicate checking
- **Bulk Generation**: Generate SKUs for multiple variants at once
- **Custom Patterns**: User-defined SKU patterns

#### **Flexible JSON Attribute Storage**
```typescript
// Enhanced Flexible Attribute System
interface EnhancedFlexibleAttributes {
  attributeTypes: {
    text: {
      validation: {
        minLength?: number;
        maxLength?: number;
        pattern?: string;                // Regex validation
        required?: boolean;
      };
      examples: ["Product Name", "Description", "Notes"];
    };
    
    number: {
      validation: {
        min?: number;
        max?: number;
        precision?: number;             // Decimal places
        unit?: string;                   // kg, cm, inches, etc.
      };
      examples: ["Weight", "Length", "Width"];
    };
    
    select: {
      options: string[];
      multiSelect?: boolean;            // Allow multiple selections
      required?: boolean;
      examples: ["Size", "Color", "Material"];
    };
    
    boolean: {
      defaultValue?: boolean;
      examples: ["In Stock", "Featured", "New Arrival"];
    };
    
    // 🆕 NEW: Rich Text
    richtext: {
      allowedTags: string[];            // HTML tags allowed
      maxLength?: number;
      examples: ["Detailed Description", "Care Instructions"];
    };
    
    // 🆕 NEW: Date/Time
    datetime: {
      format: string;                    // Date format
      timezone?: string;
      examples: ["Release Date", "Expiry Date"];
    };
  };
  
  attributeTemplates: {
    clothing: ["size", "color", "material", "style"];
    electronics: ["screen_size", "storage", "color", "model"];
    food: ["weight", "flavor", "expiration", "organic"];
    books: ["pages", "language", "format", "genre"];
  };
  
  conditionalAttributes: {
    // Show "screen_size" only if product_type is "electronics"
    conditions: AttributeCondition[];
  };
}
```

**JSON Attribute Features:**
- **Type System**: Text, number, select, boolean, rich text, datetime
- **Validation**: Per-type validation rules and constraints
- **Templates**: Reusable attribute sets for product categories
- **Conditional Logic**: Show/hide attributes based on other values
- **Import/Export**: Bulk attribute management via JSON

### 🆕 New Numeric Slider System

#### **Advanced Slider Components**
```typescript
// Enhanced Numeric Slider Interface
interface AdvancedNumericSlider {
  sliderType: 'price' | 'sale_price' | 'stock' | 'weight' | 'custom';
  
  configuration: {
    min: number;
    max: number;
    step: number;
    precision: number;
    unit: string;
    format: string;                    // Number formatting
    
    // Visual customization
    color: string;                     // Slider color theme
    showLabels: boolean;
    showTooltip: boolean;
    animateChanges: boolean;
  };
  
  bulkOperations: {
    enabled: boolean;
    operations: ['set', 'increase', 'decrease', 'multiply'];
    previewMode: boolean;              // Preview before applying
    targetSelection: 'all' | 'selected' | 'by_attribute';
  };
  
  integration: {
    autoSave: boolean;                 // Auto-save on change
    realTimeUpdates: boolean;         // Update preview in real-time
    undoRedo: boolean;                 // Undo/redo support
  };
}
```

#### **Slider Use Cases**

##### **Price Management**
- **Individual Pricing**: Per-variant price adjustments
- **Bulk Pricing**: Apply price changes to variant groups
- **Formula Pricing**: Base price + attribute premiums
- **Discount Management**: Sale price with percentage/absolute discounts

##### **Stock Management**
- **Inventory Control**: Visual stock quantity updates
- **Bulk Updates**: Update stock for multiple variants
- **Low Stock Alerts**: Visual warnings for low inventory
- **Reorder Management**: Automatic reorder point calculations

##### **Weight & Dimensions**
- **Shipping Calculations**: Weight-based shipping costs
- **Size Variations**: Different dimensions per variant
- **Bulk Updates**: Apply dimension changes to variant groups

### 🔄 Variant Cloning Workflow (Enhanced)

#### **Parent-to-Variant Cloning**
```typescript
interface EnhancedVariantCloning {
  parentProduct: {
    id: string;
    name: string;
    baseSKU: string;
    attributes: Record<string, string>;
    photos: ImageInfo[];
    pricing: PricingInfo;
    stock: number;
  };
  
  cloningOptions: {
    // What to clone from parent
    cloneAttributes: boolean;
    clonePhotos: boolean;
    clonePricing: boolean;
    cloneStock: boolean;
    cloneContent: boolean;
    
    // Photo cloning strategy
    photoStrategy: 'clone_all' | 'clone_some' | 'upload_all' | 'mixed';
    photosToClone: string[];           // Specific photos to clone
    
    // Attribute customization
    attributeOverrides: Record<string, string>;
    newAttributes: Record<string, string>;
    
    // Pricing customization
    priceAdjustments: {
      type: 'fixed' | 'percentage' | 'formula';
      adjustments: Record<string, number>;
    };
  };
  
  variantDefinitions: Array<{
    attributes: Record<string, string>;
    customPhotos?: ImageInfo[];
    customPricing?: PricingInfo;
    customStock?: number;
  }>;
}
```

**Cloning Workflow Steps:**
1. **Parent Selection**: Choose parent product with preview
2. **Cloning Options**: Select what to inherit from parent
3. **Attribute Definition**: Define variant-specific attributes
4. **Photo Management**: Choose photo cloning strategy
5. **Pricing Setup**: Configure variant pricing adjustments
6. **SKU Generation**: Auto-generate SKUs using patterns
7. **Preview & Review**: Review all variants before creation
8. **Bulk Creation**: Generate all variants at once

### 📸 Enhanced Photo Management

#### **Variant Photo System**
```typescript
interface VariantPhotoSystem {
  photoInheritance: {
    strategy: 'clone_all' | 'clone_some' | 'upload_all' | 'mixed';
    parentPhotos: ImageInfo[];
    inheritanceRules: PhotoInheritanceRule[];
  };
  
  variantPhotos: Record<string, {
    primaryImage: ImageInfo;
    gallery: ImageInfo[];
    photoMetadata: {
      source: 'parent' | 'upload' | 'generated';
      inheritedFrom?: string;
      customizations: PhotoCustomization[];
    };
  }>;
  
  bulkPhotoOperations: {
    enabled: boolean;
    operations: ['upload', 'replace', 'remove', 'optimize'];
    batchProcessing: boolean;
    autoTagging: boolean;              // Auto-tag photos by attributes
  };
  
  photoOptimization: {
    autoResize: boolean;
    compression: boolean;
    formatConversion: boolean;         // WebP, AVIF, etc.
    qualityEnhancement: boolean;
  };
}
```

**Photo Management Features:**
- **Smart Inheritance**: Intelligent photo cloning based on attributes
- **Bulk Operations**: Upload, replace, optimize multiple variant photos
- **Auto-Tagging**: Automatically tag photos by variant attributes
- **Quality Enhancement**: AI-powered photo optimization
- **Version Control**: Track photo changes and rollbacks

---

## 🔄 Universal Singleton Service System (Shop System Pattern)

### **🎯 Universal Singleton Architecture for Inventory**

#### **Backend Universal Singleton Service**
```typescript
// apps/api/src/services/InventorySingletonService.ts
export class InventorySingletonService extends UniversalSingleton {
  private static instance: InventorySingletonService;
  private cache: Map<string, ProductCacheEntry> = new Map();
  private metrics: {
    cacheHits: number;
    cacheMisses: number;
    dbQueries: number;
    responseTime: number;
  };

  // 🎯 SCOPE PATTERN IMPLEMENTATION
  public async resolveProductByIdentifier(identifier: string): Promise<{
    productId?: string;
    sku?: string;
    variantId?: string;
    autoId?: string;
    found: boolean;
  }> {
    // Try to resolve as product ID
    try {
      const product = await this.getProductById(identifier);
      if (product) {
        return {
          productId: product.id,
          sku: product.sku,
          found: true
        };
      }
    } catch (error) {
      // Product ID lookup failed
    }

    // Try to resolve as SKU
    try {
      const product = await this.getProductBySku(identifier);
      if (product) {
        return {
          productId: product.id,
          sku: product.sku,
          found: true
        };
      }
    } catch (error) {
      // SKU lookup failed
    }

    // Try to resolve as variant ID
    try {
      const variant = await this.getVariantById(identifier);
      if (variant) {
        return {
          productId: variant.productId,
          variantId: variant.id,
          found: true
        };
      }
    } catch (error) {
      // Variant ID lookup failed
    }

    // Try to resolve as autoId
    try {
      const product = await this.getProductByAutoId(identifier);
      if (product) {
        return {
          productId: product.id,
          autoId: identifier,
          found: true
        };
      }
    } catch (error) {
      // AutoId lookup failed
    }

    return { found: false };
  }

  // 🎯 MULTI-IDENTIFIER RESOLUTION
  public async getProductIdentifiersAsync(tenantId: string): Promise<ProductIdentifiers> {
    const cacheKey = `product-identifiers-${tenantId}`;
    
    // Check cache first
    const cached = await this.getCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    this.metrics.cacheMisses++;
    
    // Fetch from database
    const product = await this.getProductByTenantId(tenantId);
    
    const identifiers: ProductIdentifiers = {
      productId: product.id,
      sku: product.sku,
      variantId: product.defaultVariantId,
      autoId: product.autoId,
      urls: await this.generateProductUrls(product)
    };

    // Cache the result
    await this.setCache(cacheKey, identifiers, 300); // 5 minutes
    this.metrics.dbQueries++;

    return identifiers;
  }

  // 🎯 URL GENERATION (Shop System Pattern)
  public async generateProductUrls(product: Product): Promise<ProductUrls> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    
    return {
      // Primary URL (SKU-based)
      skuUrl: `/products/${product.sku}`,
      
      // Product ID URL
      productIdUrl: `/products/id/${product.id}`,
      
      // Auto ID URL
      autoIdUrl: `/products/auto/${product.autoId}`,
      
      // Canonical URL (most SEO-friendly)
      canonicalUrl: product.slug ? `/products/${product.slug}` : `/products/${product.sku}`,
      
      // Storefront URL
      storefrontUrl: `/shop/products/${product.sku}`,
      
      // Directory URL
      directoryUrl: `/directory/products/${product.sku}`
    };
  }
}

// 🎯 INTERFACES (Shop System Pattern)
export interface ProductIdentifiers {
  productId: string;
  sku: string;
  variantId?: string;
  autoId?: string;
  urls: ProductUrls;
}

export interface ProductUrls {
  skuUrl: string;
  productIdUrl: string;
  autoIdUrl: string;
  canonicalUrl: string;
  storefrontUrl: string;
  directoryUrl: string;
}
```

#### **Frontend Universal Singleton Client**
```typescript
// apps/web/src/lib/inventory/universal-singleton-client.ts
export class UniversalInventoryClient {
  private static instance: UniversalInventoryClient;
  private cache: Map<string, any> = new Map();
  private baseUrl: string;

  private constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  public static getInstance(baseUrl?: string): UniversalInventoryClient {
    if (!UniversalInventoryClient.instance) {
      UniversalInventoryClient.instance = new UniversalInventoryClient(
        baseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || ''
      );
    }
    return UniversalInventoryClient.instance;
  }

  // 🎯 PRODUCT RESOLUTION (Shop System Pattern)
  public async resolveProduct(identifier: string): Promise<ProductResolution> {
    const cacheKey = `resolve-${identifier}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const response = await fetch(`${this.baseUrl}/api/inventory/resolve/${identifier}`);
    const resolution = await response.json();
    
    this.cache.set(cacheKey, resolution);
    return resolution;
  }

  // 🎯 URL RESOLUTION (Shop System Pattern)
  public async getProductUrls(productId: string, slug?: string): Promise<ProductUrls> {
    const cacheKey = `urls-${productId}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const response = await fetch(`${this.baseUrl}/api/inventory/urls/${productId}`);
    const urls = await response.json();
    
    this.cache.set(cacheKey, urls);
    return urls;
  }

  // 🎯 BATCH OPERATIONS (Platform Optimization)
  public async batchResolve(identifiers: string[]): Promise<ProductResolution[]> {
    const response = await fetch(`${this.baseUrl}/api/inventory/batch-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers })
    });
    
    return response.json();
  }
}
```

---

## 🎯 Scope Pattern Implementation (Shop System Pattern)

### **🗂️ Scope-Based Data Access**

#### **Backend Scope Implementation**
```typescript
// apps/api/src/services/InventoryScopeService.ts
export class InventoryScopeService {
  // 🎯 TENANT SCOPING
  public async getScopedProducts(tenantId: string, options: ScopedQueryOptions = {}): Promise<ScopedProductResult> {
    const {
      includeVariants = false,
      includeCategories = false,
      includeAnalytics = false,
      limit = 50,
      offset = 0,
      filters = {}
    } = options;

    // Base query with tenant scoping
    let query = `
      SELECT 
        i.*,
        ${includeVariants ? this.getVariantSubquery() : 'NULL as variants'},
        ${includeCategories ? this.getCategorySubquery() : 'NULL as categories'},
        ${includeAnalytics ? this.getAnalyticsSubquery() : 'NULL as analytics'}
      FROM inventory_items i
      WHERE i.tenant_id = $1
      AND i.item_status != 'trashed'
    `;

    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Apply filters
    if (filters.category) {
      query += ` AND i.category_id = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters.status) {
      query += ` AND i.item_status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += ` AND (i.name ILIKE $${paramIndex++} OR i.sku ILIKE $${paramIndex++})`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // Apply pagination
    query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);

    return {
      products: result.rows,
      totalCount: await this.getScopedCount(tenantId, filters),
      hasMore: result.rows.length === limit
    };
  }

  // 🎯 VARIANT SCOPING
  public async getScopedVariants(productId: string, tenantId: string): Promise<ScopedVariantResult> {
    const query = `
      SELECT 
        v.*,
        i.name as product_name,
        i.sku as product_sku
      FROM product_variants v
      JOIN inventory_items i ON v.product_id = i.id
      WHERE v.product_id = $1
      AND i.tenant_id = $2
      AND v.is_active = true
      ORDER BY v.sort_order ASC
    `;

    const result = await this.pool.query(query, [productId, tenantId]);

    return {
      variants: result.rows,
      totalCount: result.rows.length
    };
  }

  // 🎯 ANALYTICS SCOPING
  public async getScopedAnalytics(productId: string, tenantId: string, dateRange?: DateRange): Promise<ScopedAnalytics> {
    const query = `
      SELECT 
        COUNT(DISTINCT oi.id) as total_orders,
        SUM(oi.quantity) as total_sold,
        SUM(oi.price_cents * oi.quantity) as total_revenue,
        AVG(oi.price_cents) as average_price,
        COUNT(DISTINCT o.customer_id) as unique_customers
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = $1
      AND o.tenant_id = $2
      ${dateRange ? `AND o.created_at BETWEEN $3 AND $4` : ''}
    `;

    const params = dateRange 
      ? [productId, tenantId, dateRange.start, dateRange.end]
      : [productId, tenantId];

    const result = await this.pool.query(query, params);

    return {
      ...result.rows[0],
      dateRange: dateRange || { start: null, end: null }
    };
  }
}

// 🎯 SCOPE INTERFACES
interface ScopedQueryOptions {
  includeVariants?: boolean;
  includeCategories?: boolean;
  includeAnalytics?: boolean;
  limit?: number;
  offset?: number;
  filters?: {
    category?: string;
    status?: string;
    search?: string;
    priceRange?: { min: number; max: number };
    stockRange?: { min: number; max: number };
  };
}

interface ScopedProductResult {
  products: Product[];
  totalCount: number;
  hasMore: boolean;
}

interface ScopedVariantResult {
  variants: ProductVariant[];
  totalCount: number;
}

interface ScopedAnalytics {
  totalOrders: number;
  totalSold: number;
  totalRevenue: number;
  averagePrice: number;
  uniqueCustomers: number;
  dateRange: DateRange;
}
```

---

## 🚀 Platform Optimization Techniques (Shop System Pattern)

### **⚡ Performance Optimization Patterns**

#### **🗂️ Caching Strategy (Shop System Pattern)**
```typescript
// apps/api/src/services/InventoryCacheService.ts
export class InventoryCacheService {
  private redis: Redis;
  private localCache: Map<string, CacheEntry> = new Map();

  // 🎯 MULTI-TIER CACHING
  public async get(key: string): Promise<any> {
    // L1: Local memory cache (fastest)
    const localEntry = this.localCache.get(key);
    if (localEntry && !this.isExpired(localEntry)) {
      return localEntry.data;
    }

    // L2: Redis cache (fast)
    try {
      const redisData = await this.redis.get(key);
      if (redisData) {
        const parsed = JSON.parse(redisData);
        // Backfill local cache
        this.localCache.set(key, {
          data: parsed,
          timestamp: Date.now(),
          ttl: 300 // 5 minutes
        });
        return parsed;
      }
    } catch (error) {
      console.warn('Redis cache miss:', error);
    }

    // L3: Database (slowest)
    return null;
  }

  // 🎯 INTELLIGENT CACHE INVALIDATION
  public async invalidateByPattern(pattern: string): Promise<void> {
    // Invalidate local cache
    for (const key of this.localCache.keys()) {
      if (key.includes(pattern)) {
        this.localCache.delete(key);
      }
    }

    // Invalidate Redis cache
    try {
      const redisKeys = await this.redis.keys(`*${pattern}*`);
      if (redisKeys.length > 0) {
        await this.redis.del(...redisKeys);
      }
    } catch (error) {
      console.warn('Redis invalidation error:', error);
    }
  }

  // 🎯 BATCH CACHE OPERATIONS
  public async mget(keys: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    const uncachedKeys: string[] = [];

    // Check local cache first
    for (const key of keys) {
      const localEntry = this.localCache.get(key);
      if (localEntry && !this.isExpired(localEntry)) {
        result[key] = localEntry.data;
      } else {
        uncachedKeys.push(key);
      }
    }

    // Batch fetch from Redis
    if (uncachedKeys.length > 0) {
      try {
        const redisValues = await this.redis.mget(...uncachedKeys);
        for (let i = 0; i < uncachedKeys.length; i++) {
          const key = uncachedKeys[i];
          const value = redisValues[i];
          
          if (value) {
            const parsed = JSON.parse(value);
            result[key] = parsed;
            
            // Backfill local cache
            this.localCache.set(key, {
              data: parsed,
              timestamp: Date.now(),
              ttl: 300
            });
          }
        }
      } catch (error) {
        console.warn('Redis mget error:', error);
      }
    }

    return result;
  }
}
```

#### **🔄 Database Optimization (Shop System Pattern)**
```typescript
// apps/api/src/services/InventoryOptimizationService.ts
export class InventoryOptimizationService {
  // 🎯 CONNECTION POOLING
  private pool: Pool;

  // 🎯 BATCH OPERATIONS
  public async batchUpdateProducts(updates: ProductUpdate[]): Promise<BatchUpdateResult> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const results: UpdateResult[] = [];
      
      for (const update of updates) {
        const result = await client.query(
          `UPDATE inventory_items 
           SET name = $1, price_cents = $2, stock = $3, updated_at = NOW()
           WHERE id = $4 AND tenant_id = $5
           RETURNING *`,
          [update.name, update.priceCents, update.stock, update.id, update.tenantId]
        );
        
        results.push({
          id: update.id,
          success: result.rowCount > 0,
          data: result.rows[0]
        });
      }

      await client.query('COMMIT');
      
      // Invalidate cache
      await this.cacheService.invalidateByPattern('products');
      
      return {
        success: true,
        results,
        totalProcessed: updates.length
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 🎯 VIRTUAL SCROLLING SUPPORT
  public async getVirtualizedProducts(tenantId: string, options: VirtualizedOptions): Promise<VirtualizedResult> {
    const { startIndex, endIndex, sortField, sortOrder, filters } = options;
    
    // Optimized query for virtual scrolling
    const query = `
      SELECT * FROM inventory_items 
      WHERE tenant_id = $1 
      AND item_status != 'trashed'
      ${this.buildFilterClause(filters)}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $2 OFFSET $3
    `;

    const result = await this.pool.query(query, [tenantId, endIndex - startIndex + 1, startIndex]);

    return {
      items: result.rows,
      startIndex,
      endIndex,
      totalCount: await this.getFilteredCount(tenantId, filters)
    };
  }

  // 🎯 INDEX OPTIMIZATION
  public async optimizeIndexes(): Promise<void> {
    const optimizations = [
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_tenant_status ON inventory_items(tenant_id, item_status)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_tenant_category ON inventory_items(tenant_id, category_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_tenant_price ON inventory_items(tenant_id, price_cents)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_tenant_stock ON inventory_items(tenant_id, stock)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_tenant_search ON inventory_items(tenant_id) WHERE name IS NOT NULL OR sku IS NOT NULL'
    ];

    for (const optimization of optimizations) {
      try {
        await this.pool.query(optimization);
        console.log('Index optimization completed:', optimization);
      } catch (error) {
        console.warn('Index optimization failed:', optimization, error);
      }
    }
  }
}
```

---

## 🚀 Implementation Architecture

### **📁 Enhanced File Structure with Shop System Patterns**
```
src/
├── api/src/services/inventory/
│   ├── InventorySingletonService.ts      # 🎯 Universal singleton (shop pattern)
│   ├── InventoryScopeService.ts           # 🎯 Scope-based data access
│   ├── InventoryCacheService.ts          # ⚡ Multi-tier caching
│   ├── InventoryOptimizationService.ts    # 🔄 Database optimization
│   └── routes/
│       ├── resolve.ts                     # 🎯 Product resolution API
│       ├── batch-resolve.ts               # 🔄 Batch operations
│       └── urls.ts                        # 🎯 URL generation API
├── web/src/lib/inventory/
│   ├── universal-singleton-client.ts      # 🎯 Frontend singleton (shop pattern)
│   ├── hooks/
│   │   ├── useInventoryResolution.ts      # 🎯 Product resolution hook
│   │   ├── useInventoryCache.ts           # ⚡ Caching hook
│   │   └── useInventoryVirtualization.ts  # 🔄 Virtual scrolling hook
│   └── components/
│       ├── wizards/
│       │   ├── ItemCreationWizard.tsx     # Main wizard container
│       │   ├── steps/                     # 7 wizard steps
│       │   └── components/                # Wizard components
│       ├── universal/                     # 🎯 Universal components
│       │   ├── ProductResolver.tsx        # 🎯 Multi-identifier resolution
│       │   ├── ProductUrlDisplay.tsx      # 🎯 URL display (shop pattern)
│       │   └── ProductCacheProvider.tsx   # ⚡ Cache provider
│       └── optimized/                     # ⚡ Performance components
│           ├── VirtualizedProductList.tsx # 🔄 Virtual scrolling
│           ├── BatchOperationPanel.tsx    # 🔄 Batch operations
│           └── LazyImageLoader.tsx        # ⚡ Lazy loading
└── shared/
    ├── types/inventory/                   # 🎯 Shared interfaces
    ├── constants/inventory/               # 🎯 Shared constants
    └── utils/inventory/                   # 🎯 Shared utilities
```

#### **🎯 API Routes Implementation (Shop System Pattern)**
```typescript
// apps/api/src/routes/inventory/resolve.ts
router.get('/resolve/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const inventoryService = InventorySingletonService.getInstance();
    
    const resolution = await inventoryService.resolveProductByIdentifier(identifier);
    
    res.json({
      success: resolution.found,
      data: resolution,
      message: resolution.found ? 'Product resolved successfully' : 'Product not found'
    });
  } catch (error) {
    console.error('[Product Resolution Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve product'
    });
  }
});

// apps/api/src/routes/inventory/batch-resolve.ts
router.post('/batch-resolve', async (req, res) => {
  try {
    const { identifiers } = req.body;
    const inventoryService = InventorySingletonService.getInstance();
    
    const results = await Promise.all(
      identifiers.map(async (identifier: string) => {
        const resolution = await inventoryService.resolveProductByIdentifier(identifier);
        return { identifier, ...resolution };
      })
    );
    
    res.json({
      success: true,
      data: results,
      message: 'Batch resolution completed'
    });
  } catch (error) {
    console.error('[Batch Resolution Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve products'
    });
  }
});

// apps/api/src/routes/inventory/urls/:productId.ts
router.get('/urls/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const inventoryService = InventorySingletonService.getInstance();
    
    const product = await inventoryService.getProductById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Product not found'
      });
    }
    
    const urls = await inventoryService.generateProductUrls(product);
    
    res.json({
      success: true,
      data: urls,
      message: 'Product URLs generated successfully'
    });
  } catch (error) {
    console.error('[URL Generation Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to generate product URLs'
    });
  }
});
```

---

## 🎯 Real-Time Updates & WebSocket Integration (Shop System Pattern)

### **🔄 WebSocket-Based Real-Time Inventory**

#### **Backend WebSocket Service**
```typescript
// apps/api/src/services/InventoryWebSocketService.ts
export class InventoryWebSocketService {
  private io: Server;
  private tenantSockets: Map<string, Set<string>> = new Map();

  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_BASE_URL,
        methods: ['GET', 'POST']
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected to inventory WebSocket');

      // Join tenant room
      socket.on('join-tenant', (tenantId: string) => {
        socket.join(`tenant-${tenantId}`);
        
        if (!this.tenantSockets.has(tenantId)) {
          this.tenantSockets.set(tenantId, new Set());
        }
        this.tenantSockets.get(tenantId)!.add(socket.id);
      });

      // Leave tenant room
      socket.on('leave-tenant', (tenantId: string) => {
        socket.leave(`tenant-${tenantId}`);
        this.tenantSockets.get(tenantId)?.delete(socket.id);
      });

      socket.on('disconnect', () => {
        // Clean up tenant socket mappings
        for (const [tenantId, sockets] of this.tenantSockets.entries()) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.tenantSockets.delete(tenantId);
          }
        }
      });
    });
  }

  // 🎯 BROADCAST INVENTORY UPDATES
  public broadcastInventoryUpdate(tenantId: string, update: InventoryUpdate): void {
    this.io.to(`tenant-${tenantId}`).emit('inventory-update', {
      type: 'inventory_update',
      data: update,
      timestamp: new Date().toISOString()
    });
  }

  // 🎯 BROADCAST VARIANT UPDATES
  public broadcastVariantUpdate(tenantId: string, update: VariantUpdate): void {
    this.io.to(`tenant-${tenantId}`).emit('variant-update', {
      type: 'variant_update',
      data: update,
      timestamp: new Date().toISOString()
    });
  }

  // 🎯 BROADCAST STOCK CHANGES
  public broadcastStockChange(tenantId: string, change: StockChange): void {
    this.io.to(`tenant-${tenantId}`).emit('stock-change', {
      type: 'stock_change',
      data: change,
      timestamp: new Date().toISOString()
    });
  }
}

// 🎯 UPDATE INTERFACES
interface InventoryUpdate {
  productId: string;
  field: string;
  oldValue: any;
  newValue: any;
  updatedBy: string;
}

interface VariantUpdate {
  variantId: string;
  productId: string;
  field: string;
  oldValue: any;
  newValue: any;
  updatedBy: string;
}

interface StockChange {
  productId: string;
  variantId?: string;
  oldStock: number;
  newStock: number;
  changeType: 'sale' | 'adjustment' | 'restock';
  updatedBy: string;
}
```

#### **Frontend WebSocket Hook**
```typescript
// apps/web/src/hooks/inventory/useInventoryWebSocket.ts
export function useInventoryWebSocket(tenantId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [updates, setUpdates] = useState<InventoryUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WS_BASE_URL || '', {
      transports: ['websocket']
    });

    newSocket.on('connect', () => {
      console.log('Connected to inventory WebSocket');
      setIsConnected(true);
      newSocket.emit('join-tenant', tenantId);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from inventory WebSocket');
      setIsConnected(false);
    });

    // Listen for inventory updates
    newSocket.on('inventory-update', (update: InventoryUpdate) => {
      setUpdates(prev => [update, ...prev.slice(0, 99)]); // Keep last 100 updates
    });

    // Listen for variant updates
    newSocket.on('variant-update', (update: VariantUpdate) => {
      // Handle variant-specific updates
      console.log('Variant update received:', update);
    });

    // Listen for stock changes
    newSocket.on('stock-change', (change: StockChange) => {
      // Handle stock changes with real-time updates
      console.log('Stock change received:', change);
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave-tenant', tenantId);
      newSocket.disconnect();
    };
  }, [tenantId]);

  const clearUpdates = useCallback(() => {
    setUpdates([]);
  }, []);

  return {
    socket,
    isConnected,
    updates,
    clearUpdates
  };
}
```

---

## 🎯 Advanced Search & Filtering (Shop System Pattern)

### **🔍 Intelligent Search System**

#### **Backend Search Service**
```typescript
// apps/api/src/services/InventorySearchService.ts
export class InventorySearchService {
  // 🎯 FULL-TEXT SEARCH
  public async searchProducts(tenantId: string, query: SearchQuery): Promise<SearchResult> {
    const {
      q,
      filters = {},
      sort = { field: 'created_at', order: 'DESC' },
      pagination = { limit: 50, offset: 0 }
    } = query;

    // Build search query
    let searchQuery = `
      SELECT 
        i.*,
        ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance_score,
        ${filters.includeVariants ? this.getVariantSubquery() : 'NULL as variants'}
      FROM inventory_items i
      WHERE i.tenant_id = $2
      AND i.item_status != 'trashed'
      AND i.search_vector @@ plainto_tsquery('english', $1)
    `;

    const params: any[] = [q, tenantId];
    let paramIndex = 3;

    // Apply filters
    if (filters.category) {
      searchQuery += ` AND i.category_id = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters.priceRange) {
      searchQuery += ` AND i.price_cents BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(filters.priceRange.min, filters.priceRange.max);
    }

    if (filters.stockRange) {
      searchQuery += ` AND i.stock BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(filters.stockRange.min, filters.stockRange.max);
    }

    // Apply sorting
    const sortField = sort.field === 'relevance' ? 'relevance_score DESC' : `${sort.field} ${sort.order}`;
    searchQuery += ` ORDER BY ${sortField}`;

    // Apply pagination
    searchQuery += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(pagination.limit, pagination.offset);

    const result = await this.pool.query(searchQuery, params);

    return {
      products: result.rows,
      totalCount: await this.getSearchCount(tenantId, query),
      hasMore: result.rows.length === pagination.limit,
      query,
      filters,
      sort
    };
  }

  // 🎯 SEARCH SUGGESTIONS
  public async getSearchSuggestions(tenantId: string, partial: string): Promise<SearchSuggestion[]> {
    const query = `
      SELECT DISTINCT 
        name,
        sku,
        category_name,
        ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance
      FROM inventory_items i
      LEFT JOIN item_categories c ON i.category_id = c.id
      WHERE i.tenant_id = $2
      AND i.item_status != 'trashed'
      AND (
        i.name ILIKE $3 OR 
        i.sku ILIKE $3 OR 
        c.name ILIKE $3
      )
      ORDER BY relevance DESC, i.name ASC
      LIMIT 10
    `;

    const result = await this.pool.query(query, [partial, tenantId, `%${partial}%`]);

    return result.rows.map(row => ({
      text: row.name,
      type: 'product',
      sku: row.sku,
      category: row.category_name,
      relevance: row.relevance
    }));
  }

  // 🎯 FACETED SEARCH
  public async getSearchFacets(tenantId: string, query: string): Promise<SearchFacets> {
    const baseQuery = `
      FROM inventory_items i
      LEFT JOIN item_categories c ON i.category_id = c.id
      WHERE i.tenant_id = $1
      AND i.item_status != 'trashed'
      AND i.search_vector @@ plainto_tsquery('english', $2)
    `;

    // Category facets
    const categoryQuery = `
      SELECT c.name, COUNT(*) as count
      ${baseQuery}
      AND c.id IS NOT NULL
      GROUP BY c.name
      ORDER BY count DESC
    `;

    // Price range facets
    const priceQuery = `
      SELECT 
        CASE 
          WHEN price_cents < 1000 THEN 'Under $10'
          WHEN price_cents < 5000 THEN '$10-$50'
          WHEN price_cents < 10000 THEN '$50-$100'
          WHEN price_cents < 25000 THEN '$100-$250'
          ELSE 'Over $250'
        END as price_range,
        COUNT(*) as count
      ${baseQuery}
      GROUP BY price_range
      ORDER BY MIN(price_cents)
    `;

    const [categories, priceRanges] = await Promise.all([
      this.pool.query(categoryQuery, [tenantId, query]),
      this.pool.query(priceQuery, [tenantId, query])
    ]);

    return {
      categories: categories.rows,
      priceRanges: priceRanges.rows
    };
  }
}

// 🎯 SEARCH INTERFACES
interface SearchQuery {
  q: string;
  filters?: {
    category?: string;
    priceRange?: { min: number; max: number };
    stockRange?: { min: number; max: number };
    status?: string;
    includeVariants?: boolean;
  };
  sort?: {
    field: string;
    order: 'ASC' | 'DESC';
  };
  pagination?: {
    limit: number;
    offset: number;
  };
}

interface SearchResult {
  products: Product[];
  totalCount: number;
  hasMore: boolean;
  query: SearchQuery;
  filters: any;
  sort: any;
}

interface SearchSuggestion {
  text: string;
  type: 'product' | 'category' | 'brand';
  sku?: string;
  category?: string;
  relevance: number;
}

interface SearchFacets {
  categories: Array<{ name: string; count: number }>;
  priceRanges: Array<{ price_range: string; count: number }>;
}
```

---

## 🌟 Product Featuring System Integration

### **🎯 Complete Featuring Support**

The enhanced inventory workflow **fully supports the product featuring system** that shops rely on heavily. This integration ensures that products created through the wizard can be immediately featured in storefront buckets and directory displays.

#### **📊 Featuring Database Schema Integration**
```prisma
model InventoryItem {
  // ... existing fields
  
  // Product featuring (fully supported)
  isFeatured       Boolean   @default(false) @map("is_featured")
  featuredAt       DateTime? @map("featured_at")
  featuredUntil    DateTime? @map("featured_until")
  featuredPriority Int?      @default(0) @map("featured_priority")
  
  @@map("InventoryItem")
}
```

#### **🎯 Wizard Featuring Integration**

##### **Step 7: Review & Publish - Featuring Options**
```typescript
interface ReviewStepData {
  publishingOptions: {
    publishImmediately: boolean;
    schedulePublishing?: Date;
    notifyCustomers: boolean;
    createPromotion: boolean;
    publishVariants: 'all' | 'selected' | 'none';
  };
  featuringOptions: {
    isFeatured: boolean;
    featuredDuration?: number; // Days
    featuredPriority: number; // 0-100
    featuredBuckets: string[]; // Which buckets to appear in
    autoFeature: boolean; // Auto-feature based on criteria
  };
}
```

##### **Featuring Configuration Panel**
```typescript
const FeaturingConfiguration = () => {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Star className="h-5 w-5 text-amber-600" />
          <span>Product Featuring</span>
          <Badge className="bg-amber-100 text-amber-800">Optional</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Feature Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-medium">Feature this product</Label>
            <p className="text-sm text-gray-600">
              Featured products appear prominently in storefront buckets
            </p>
          </div>
          <Switch
            checked={featuringOptions.isFeatured}
            onCheckedChange={(checked) => setFeaturingOptions(prev => ({
              ...prev,
              isFeatured: checked
            }))}
          />
        </div>

        {/* Featured Duration */}
        {featuringOptions.isFeatured && (
          <div>
            <Label className="font-medium">Featured Duration</Label>
            <Select
              value={featuringOptions.featuredDuration?.toString() || 'indefinite'}
              onValueChange={(value) => setFeaturingOptions(prev => ({
                ...prev,
                featuredDuration: value === 'indefinite' ? undefined : parseInt(value)
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="indefinite">Indefinite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Featured Priority */}
        {featuringOptions.isFeatured && (
          <div>
            <Label className="font-medium">Featured Priority</Label>
            <p className="text-sm text-gray-600 mb-2">
              Higher priority = more prominent display
            </p>
            <Slider
              value={[featuringOptions.featuredPriority]}
              onValueChange={([value]) => setFeaturingOptions(prev => ({
                ...prev,
                featuredPriority: value
              }))}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Low</span>
              <span>{featuringOptions.featuredPriority}</span>
              <span>High</span>
            </div>
          </div>
        )}

        {/* Bucket Selection */}
        {featuringOptions.isFeatured && (
          <div>
            <Label className="font-medium">Featured Buckets</Label>
            <p className="text-sm text-gray-600 mb-2">
              Select which storefront buckets this product should appear in
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {availableBuckets.map((bucket) => (
                <div key={bucket.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`bucket-${bucket.id}`}
                    checked={featuringOptions.featuredBuckets.includes(bucket.id)}
                    onCheckedChange={(checked) => {
                      setFeaturingOptions(prev => ({
                        ...prev,
                        featuredBuckets: checked
                          ? [...prev.featuredBuckets, bucket.id]
                          : prev.featuredBuckets.filter(id => id !== bucket.id)
                      });
                    }}
                  />
                  <Label htmlFor={`bucket-${bucket.id}`} className="text-sm">
                    {bucket.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Auto-Feature */}
        {featuringOptions.isFeatured && (
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Auto-feature based on criteria</Label>
              <p className="text-sm text-gray-600">
                Automatically feature based on sales, views, or inventory
              </p>
            </div>
            <Switch
              checked={featuringOptions.autoFeature}
              onCheckedChange={(checked) => setFeaturingOptions(prev => ({
                ...prev,
                autoFeature: checked
              }))}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

#### **📱 Dashboard Featuring Integration**

##### **Quick Actions - Feature Products**
```typescript
const QuickActions = ({ tenantId }: QuickActionsProps) => {
  const quickActions: QuickAction[] = [
    // ... existing actions
    {
      id: 'feature-products',
      title: 'Feature Products',
      description: 'Mark products as featured for storefront',
      icon: <Star className="h-5 w-5" />,
      badge: 'Promote',
      badgeVariant: 'default',
      href: `/t/${tenantId}/inventory/featuring`,
      disabled: false
    }
  ];
};
```

##### **Product List - Featuring Status**
```typescript
const ProductList = ({ products, ... }: ProductListProps) => {
  return (
    <div className="space-y-4">
      {products.map((product) => (
        <Card key={product.id}>
          <CardContent className="p-4">
            <div className="flex items-start space-x-4">
              {/* ... existing product info */}
              
              {/* Featuring Status */}
              <div className="flex items-center space-x-2">
                {product.isFeatured && (
                  <Badge className="bg-amber-100 text-amber-800 flex items-center space-x-1">
                    <Star className="h-3 w-3" />
                    Featured
                  </Badge>
                )}
                
                {/* Feature/Unfeature Quick Action */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleFeaturing(product.id)}
                  className="p-2"
                >
                  {product.isFeatured ? (
                    <StarOff className="h-4 w-4" />
                  ) : (
                    <Star className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
```

#### **🔧 Backend API Integration**

##### **Enhanced Singleton Service**
```typescript
export class InventorySingletonService extends UniversalSingleton {
  // ... existing methods

  // 🌟 Featuring Methods
  public async featureProduct(
    productId: string, 
    options: {
      duration?: number;
      priority?: number;
      buckets?: string[];
    }
  ): Promise<ProductInfo> {
    const cacheKey = `feature-${productId}`;
    
    // Update database
    const featuredUntil = options.duration 
      ? new Date(Date.now() + options.duration * 24 * 60 * 60 * 1000)
      : undefined;
    
    await basePrisma.inventoryItem.update({
      where: { id: productId },
      data: {
        isFeatured: true,
        featuredAt: new Date(),
        featuredUntil,
        featuredPriority: options.priority || 0
      }
    });

    // Invalidate cache
    await this.clearProductCache(productId);
    
    // Return updated product
    return await this.getProductById(productId);
  }

  public async unfeatureProduct(productId: string): Promise<ProductInfo> {
    const cacheKey = `feature-${productId}`;
    
    await basePrisma.inventoryItem.update({
      where: { id: productId },
      data: {
        isFeatured: false,
        featuredAt: null,
        featuredUntil: null,
        featuredPriority: 0
      }
    });

    await this.clearProductCache(productId);
    
    return await this.getProductById(productId);
  }

  public async getFeaturedProducts(
    tenantId: string,
    options: {
      limit?: number;
      activeOnly?: boolean;
      bucketId?: string;
    } = {}
  ): Promise<ProductInfo[]> {
    const cacheKey = `featured-${tenantId}-${JSON.stringify(options)}`;
    
    const cached = await this.getCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    this.metrics.cacheMisses++;
    
    const whereClause: any = {
      tenantId,
      isFeatured: true
    };

    if (options.activeOnly) {
      whereClause.OR = [
        { featuredUntil: null },
        { featuredUntil: { gte: new Date() } }
      ];
    }

    const products = await basePrisma.inventoryItem.findMany({
      where: whereClause,
      orderBy: [
        { featuredPriority: 'desc' },
        { featuredAt: 'desc' }
      ],
      take: options.limit || 10,
      include: {
        variants: true,
        category: true
      }
    });

    const result = products.map(this.mapDbToProductInfo);
    
    await this.setCache(cacheKey, result, 300); // 5 minutes
    
    return result;
  }
}
```

##### **API Routes for Featuring**
```typescript
// apps/api/src/routes/inventory/featuring.ts

// Feature a product
router.post('/:productId/feature', async (req, res) => {
  try {
    const { productId } = req.params;
    const { duration, priority, buckets } = req.body;
    
    const inventoryService = InventorySingletonService.getInstance();
    const product = await inventoryService.featureProduct(productId, {
      duration,
      priority,
      buckets
    });
    
    res.json({
      success: true,
      data: product,
      message: 'Product featured successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to feature product'
    });
  }
});

// Unfeature a product
router.delete('/:productId/feature', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const inventoryService = InventorySingletonService.getInstance();
    const product = await inventoryService.unfeatureProduct(productId);
    
    res.json({
      success: true,
      data: product,
      message: 'Product unfeatured successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to unfeature product'
    });
  }
});

// Get featured products
router.get('/featured', async (req, res) => {
  try {
    const { limit, activeOnly, bucketId } = req.query;
    
    const inventoryService = InventorySingletonService.getInstance();
    const products = await inventoryService.getFeaturedProducts(req.tenantId, {
      limit: limit ? parseInt(limit) : undefined,
      activeOnly: activeOnly === 'true',
      bucketId: bucketId as string
    });
    
    res.json({
      success: true,
      data: products,
      message: 'Featured products retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to retrieve featured products'
    });
  }
});
```

#### **🎯 Featuring Management Dashboard**

##### **Dedicated Featuring Page**
```typescript
// apps/web/src/app/t/[tenantId]/inventory/featuring/page.tsx

export default function FeaturingManagementPage({ params }: FeaturingPageProps) {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Product Featuring</h1>
        <p className="text-gray-600">
          Manage featured products for storefront buckets and directory displays
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Featured Products */}
        <div className="lg:col-span-2">
          <FeaturedProductsList tenantId={params.tenantId} />
        </div>
        
        {/* Featuring Controls */}
        <div className="space-y-4">
          <FeaturingControls tenantId={params.tenantId} />
          <FeaturingAnalytics tenantId={params.tenantId} />
        </div>
      </div>
    </div>
  );
}
```

#### **📊 Featuring Analytics Integration**

##### **Enhanced Stats with Featuring Metrics**
```typescript
const InventoryStats = ({ tenantId }: InventoryStatsProps) => {
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Enhanced stats including featuring
  const enhancedStats = {
    ...stats,
    featuredProducts: number;
    featuringClickRate: number;
    featuringConversionRate: number;
    featuringRevenue: number;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* ... existing stat cards */}
      
      {/* Featured Products */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Star className="h-4 w-4 text-muted-foreground" />
          <Badge variant="secondary" className="text-xs">
            Featured
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">
            {enhancedStats.featuredProducts}
          </div>
          <p className="text-xs text-muted-foreground">
            Products currently featured
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
```

#### **🔄 Real-Time Featuring Updates**

##### **WebSocket Integration for Featuring**
```typescript
// Broadcast featuring updates
public broadcastFeaturingUpdate(tenantId: string, update: FeaturingUpdate): void {
  this.io.to(`tenant-${tenantId}`).emit('featuring-update', {
    type: 'featuring_update',
    data: update,
    timestamp: new Date().toISOString()
  });
}

// Frontend WebSocket hook updates
useEffect(() => {
  if (updates.length > 0) {
    const featuringUpdates = updates.filter(update => update.type === 'featuring_update');
    if (featuringUpdates.length > 0) {
      refresh(); // Refresh product list when featuring changes
    }
  }
}, [updates]);
```

---

## 🔄 Enhanced Product Management Dashboard

### 🎯 Complete Workflow Integration

#### **Entry Points Section**
| Method | Icon | Title | Description | Badge |
|--------|------|------|-------------|-------|
| Manual | ✏️ | Create Manually | Step-by-step product creation | Beginner Friendly |
| Barcode | 📷 | Barcode Scanning | 4 scanning methods + enrichment | AI-Powered |
| Bulk | 📤 | Bulk Upload | Import hundreds at once | High Volume |
| Quick Start | 🚀 | Quick Start | AI-powered catalog generation | Fastest Setup |
| POS Sync | 💳 | POS Sync | Sync from Clover, Square, etc. | Real-time |

#### **Enhancement Tools Section**
| Tool | Icon | Title | Description | Badge |
|------|------|------|-------------|-------|
| Barcode Enrichment | 📷 | Scan to Enrich | Scan existing products for enrichment | AI-Powered |
| Content Enhancement | ✨ | Enhance Content | AI-powered content enhancement | Smart Content |
| Image Enhancement | 🖼️ | Enhance Images | Find and optimize product images | Visual Enhancement |
| Category Optimization | 📁 | Optimize Categories | Smart category assignment | SEO Optimized |
| Bulk Enhancement | 🔄 | Bulk Enhancement | Enhance multiple products | Batch Processing |
| **Variant Enhancement** | 🎯 | **Enhance Variants** | **Advanced variant management** | **NEW** |

---

## 🎯 Advanced Variant Features

### 🔄 Variant Cloning Workflow

#### **Step 1: Parent Selection**
- Search and select parent product
- Preview parent product details
- Show parent photos and attributes

#### **Step 2: Variant Configuration**
```typescript
interface VariantCloningConfig {
  parentProductId: string;
  cloningOptions: {
    clonePhotos: boolean;
    cloneAttributes: boolean;
    clonePricing: boolean;
    cloneContent: boolean;
  };
  variantDefinitions: VariantDefinition[];
}
```

#### **Step 3: Attribute Definition**
- Define variant attributes (size, color, etc.)
- Create attribute combinations
- Preview variant matrix

#### **Step 4: Photo Management**
- Choose photo cloning strategy
- Upload variant-specific photos
- Preview all variant photos

#### **Step 5: Customization**
- Customize individual variants
- Override parent data where needed
- Set variant-specific pricing

#### **Step 6: Generation & Review**
- Generate all variants
- Review complete variant set
- Quality checks and validation

### 📸 Individual Variant Photo Features

#### **Photo Inheritance System**
```typescript
interface PhotoInheritance {
  parentId: string;
  inheritanceRules: {
    primaryImage: 'inherit' | 'override' | 'merge';
    galleryImages: 'inherit_all' | 'inherit_some' | 'override_all';
    inheritanceConditions: PhotoInheritanceCondition[];
  };
}
```

#### **Batch Photo Operations**
- **Bulk Upload**: Upload photos for multiple variants
- **Smart Assignment**: Auto-assign photos based on file names
- **Photo Templates**: Apply photo templates to variants
- **Quality Control**: Batch photo quality checks

#### **Variant Photo Gallery**
- Individual photo galleries per variant
- Photo comparison between variants
- Bulk photo editing capabilities
- Photo inheritance visualization

---

## 🚀 Implementation Phases

### **Phase 1: Foundation (Weeks 1-2)**
- Basic wizard structure
- Step 1-2 implementation
- Basic variant support
- Parent cloning foundation

### **Phase 2: Core Features (Weeks 3-4)**
- Steps 3-4 implementation
- Enhanced variant management
- Individual variant photos
- Photo cloning workflow

### **Phase 3: Advanced Features (Weeks 5-6)**
- Steps 5-6 implementation
- Advanced photo management
- Batch variant operations
- AI-powered content generation

### **Phase 4: Review & Polish (Weeks 7-8)**
- Step 7 implementation
- Quality assurance
- User testing
- Performance optimization

---

## 📊 Success Metrics

### **User Experience Metrics**
- **Time to Create**: Reduce product creation time by 60%
- **Variant Efficiency**: 80% faster variant creation vs manual
- **Error Reduction**: 90% reduction in data entry errors
- **User Satisfaction**: Target 4.5+ star rating

### **Business Metrics**
- **Product Quality**: 75% improvement in product completeness
- **Photo Coverage**: 95% of variants have photos
- **SEO Performance**: 50% improvement in search rankings
- **Conversion Rate**: 25% increase in product page conversions

---

## 🎯 Key Differentiators

### **Variant-First Design**
- Individual variant photo support
- Parent product cloning
- Batch variant operations
- Variant-specific content

### **AI-Powered Enhancement**
- Intelligent barcode enrichment
- AI-generated content
- Smart photo suggestions
- Automated quality checks

### **Professional Workflow**
- Distributed wizard approach
- Progressive disclosure
- Contextual guidance
- Mobile-optimized interface

---

## 🔮 Future Enhancements

### **Advanced Variant Features**
- 3D variant visualization
- AR variant preview
- Variant-specific inventory
- Dynamic pricing based on variants

### **AI Enhancements**
- Predictive variant suggestions
- Automated photo enhancement
- Intelligent content personalization
- Market trend integration

### **Integration Expansion**
- Additional POS systems
- Marketplace synchronization
- Social media integration
- Advanced analytics

---

## 📋 Conclusion

This enhanced inventory management workflow transforms the current overloaded modal system into a professional, distributed wizard-based approach with **advanced variant support including individual photos**. The variant-first design enables users to efficiently create complex product catalogs with rich media support, while the AI-powered enhancement ensures high-quality product data.

The workflow draws inspiration from the shop management dashboard's successful UX patterns while introducing innovative features like variant cloning and individual photo management that set it apart from traditional inventory management systems.

**Key Benefits:**
- ✅ 60% faster product creation
- ✅ Advanced variant management with photos
- ✅ AI-powered enrichment
- ✅ Professional user experience
- ✅ Mobile-optimized interface
- ✅ Scalable architecture

This workflow positions the platform as a leader in inventory management with variant capabilities that rival enterprise solutions while maintaining ease of use for businesses of all sizes.
