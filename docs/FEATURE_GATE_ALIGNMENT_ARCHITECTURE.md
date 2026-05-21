# Feature Gate & Resolver Alignment Architecture

## Executive Summary

**Critical Requirement:** The FeatureResolver and FeatureGate systems must be perfectly synchronized between API and Web workspaces to prevent feature access inconsistencies and security vulnerabilities.

---

## 🔄 Synchronization Strategy

### **1. Shared Definition Source**

**Problem:** API and Web currently have separate feature definitions
**Solution:** Create shared canonical definitions

```
┌─────────────────────────────────────────────────────────┐
│                   SHARED PACKAGE                         │
│  @platform/feature-definitions                           │
│                                                         │
│  • Canonical feature definitions                        │
│  • Legacy mappings                                      │
│  • Tier hierarchies                                     │
│  • Permission types                                     │
│  • Operation registry                                   │
└─────────────────────────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────┐    ┌─────────────────┐
│   API Workspace  │    │   Web Workspace  │
│                 │    │                 │
│ ApiFeatureResolver │    │ WebFeatureResolver │
│ + Server logic   │    │ + Client logic   │
│ + DB integration │    │ + UI components  │
│ + Middleware     │    │ + Hooks          │
└─────────────────┘    └─────────────────┘
```

### **2. Version Alignment**

**Version Locking Strategy:**
```typescript
// Both workspaces import same version
import { 
  FEATURE_DEFINITIONS, 
  LEGACY_MAPPINGS,
  FEATURE_OPERATIONS 
} from '@platform/feature-definitions@1.0.0';

// Runtime validation ensures alignment
export function validateAlignment(): boolean {
  const apiVersion = process.env.FEATURE_DEFINITIONS_VERSION;
  const webVersion = process.env.FEATURE_DEFINITIONS_VERSION;
  return apiVersion === webVersion;
}
```

---

## 🏗️ Architecture Overview

### **API Workspace (Backend)**

```typescript
// apps/api/src/lib/features/ApiFeatureResolver.ts
export class ApiFeatureResolver {
  // ✅ Server-side optimized
  // ✅ Database integration
  // ✅ Caching with Redis
  // ✅ Middleware support
  
  async resolveTierFeatures(tierFeatures: TierFeatureRecord[]): Promise<TierFeatureRecord[]>
  async prepareForApiResponse(tierFeatures: TierFeatureRecord[], tierKey?: string): Promise<TierFeatureRecord[]>
  validateFeatureList(features: string[]): ValidationResult
}

// apps/api/src/lib/features/ApiFeatureGate.ts
export class ApiFeatureGate {
  // ✅ Server-side validation
  // ✅ Permission checking
  // ✅ Audit logging
  // ✅ Security enforcement
  
  static checkAccess(operation: string, context: ApiContext): FeatureGateResult
  static middleware(operation: string): MiddlewareFunction
  static validateApiEndpoint(endpoint: string, user: User): Promise<boolean>
}
```

### **Web Workspace (Frontend)**

```typescript
// apps/web/src/lib/features/WebFeatureResolver.ts
export class WebFeatureResolver {
  // ✅ Client-side optimized
  // ✅ UI metadata
  // ✅ Component mapping
  // ✅ Browser caching
  
  resolveFeature(featureKey: string): string
  getFeature(featureKey: string): FeatureCapability | null
  getTierMetadata(featureKey: string, tierKey?: string): Record<string, any>
}

// apps/web/src/hooks/useFeatureGate.ts
export function useFeatureGate(operation: string): FeatureGateResult {
  // ✅ React hook
  // ✅ Real-time updates
  // ✅ UI integration
  // ✅ Error handling
}
```

---

## 🔒 Private vs Public Services

### **Public Services (Client-Facing)**

**Scope:** Features that affect UI and user experience

```typescript
// apps/web/src/services/public/FeatureService.ts
export class PublicFeatureService {
  // ✅ Available to all components
  // ✅ UI feature checks
  // ✅ Client-side only
  // ✅ No sensitive data
  
  // Example: Show/hide UI elements
  canShowBarcodeScanner(): boolean
  canAccessCheckout(): boolean
  getUpgradePrompt(feature: string): UpgradePrompt
}

// Usage in components
const featureService = new PublicFeatureService();
const canScan = featureService.canShowBarcodeScanner();
```

### **Private Services (Internal/Backend)**

**Scope:** Features that require server validation and security

```typescript
// apps/web/src/services/private/InternalFeatureService.ts
export class InternalFeatureService {
  // 🔒 Internal use only
  // 🔒 Server communication
  // 🔒 Security checks
  // 🔒 Audit logging
  
  // Example: Validate API calls
  async validateApiAccess(operation: string, context: RequestContext): Promise<boolean>
  async logFeatureAccess(operation: string, result: boolean): Promise<void>
  async checkPermissionOverride(userId: string, feature: string): Promise<boolean>
}

// apps/api/src/services/private/ServerFeatureService.ts
export class ServerFeatureService {
  // 🔒 Server-side only
  // 🔒 Database access
  // 🔒 Admin functions
  // 🔒 Security enforcement
  
  // Example: Server validation
  async validateFeatureAccess(tenantId: string, operation: string): Promise<boolean>
  async updateFeatureOverride(tenantId: string, feature: string, enabled: boolean): Promise<void>
  async auditFeatureUsage(tenantId: string, operation: string): Promise<void>
}
```

---

## 🔄 Alignment Validation

### **1. Startup Validation**

```typescript
// apps/web/src/lib/features/AlignmentValidator.ts
export class AlignmentValidator {
  static async validateAlignment(): Promise<AlignmentResult> {
    const results = await Promise.all([
      this.validateFeatureDefinitions(),
      this.validateLegacyMappings(),
      this.validateTierHierarchies(),
      this.validateOperationRegistry()
    ]);
    
    return {
      isAligned: results.every(r => r.isValid),
      issues: results.flatMap(r => r.issues),
      timestamp: new Date()
    };
  }
  
  private static async validateFeatureDefinitions(): Promise<ValidationResult> {
    // Fetch API definitions
    const apiDefinitions = await fetch('/api/features/definitions').then(r => r.json());
    
    // Compare with local definitions
    const localDefinitions = FEATURE_DEFINITIONS;
    
    // Check for mismatches
    const issues = this.compareDefinitions(apiDefinitions, localDefinitions);
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}
```

### **2. Runtime Validation**

```typescript
// apps/web/src/hooks/useFeatureAlignment.ts
export function useFeatureAlignment() {
  const [alignment, setAlignment] = useState<AlignmentResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  
  useEffect(() => {
    const validate = async () => {
      setIsValidating(true);
      try {
        const result = await AlignmentValidator.validateAlignment();
        setAlignment(result);
        
        if (!result.isAligned) {
          console.error('Feature alignment issues detected:', result.issues);
          // Could trigger error boundary or warning
        }
      } finally {
        setIsValidating(false);
      }
    };
    
    validate();
    
    // Re-validate periodically
    const interval = setInterval(validate, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);
  
  return { alignment, isValidating };
}
```

### **3. API Endpoint for Validation**

```typescript
// apps/api/src/routes/features/validation.ts
app.get('/api/features/validation', async (req, res) => {
  const result = await AlignmentValidator.validateAlignment();
  
  res.json({
    aligned: result.isAligned,
    issues: result.issues,
    timestamp: result.timestamp,
    version: process.env.FEATURE_DEFINITIONS_VERSION
  });
});
```

---

## 📊 Service Scope Matrix

| Service Type | Location | Access | Use Case | Security Level |
|--------------|----------|---------|----------|----------------|
| **PublicFeatureService** | Web Frontend | All Components | UI feature checks | 🔓 Low |
| **WebFeatureResolver** | Web Frontend | All Components | Feature resolution | 🔓 Low |
| **useFeatureGate** | Web Frontend | React Components | Hook-based checks | 🔓 Low |
| **InternalFeatureService** | Web Frontend | Internal Services | API validation | 🔒 Medium |
| **ApiFeatureResolver** | API Backend | All Endpoints | Server resolution | 🔒 Medium |
| **ApiFeatureGate** | API Backend | Middleware | Server validation | 🔔 High |
| **ServerFeatureService** | API Backend | Admin Services | Database operations | 🔔 High |

---

## 🚀 Implementation Plan

### **Phase 1: Shared Package Creation**

```bash
# Create shared package
mkdir packages/feature-definitions
cd packages/feature-definitions

# Initialize package
npm init -y
npm install typescript

# Create structure
src/
├── definitions/
│   ├── canonical-features.ts
│   ├── legacy-mappings.ts
│   └── tier-hierarchies.ts
├── operations/
│   └── feature-operations.ts
├── types/
│   └── index.ts
└── index.ts
```

### **Phase 2: API Workspace Integration**

```typescript
// apps/api/src/lib/features/ApiFeatureResolver.ts
import { FEATURE_DEFINITIONS, LEGACY_MAPPINGS } from '@platform/feature-definitions';

export class ApiFeatureResolver {
  private static instance: ApiFeatureResolver;
  
  // Use shared definitions
  resolveFeature(featureKey: string): string {
    return LEGACY_MAPPINGS[featureKey] || featureKey;
  }
  
  // Add server-specific logic
  async resolveTierFeatures(tierFeatures: TierFeatureRecord[]): Promise<TierFeatureRecord[]> {
    // Server implementation using shared definitions
  }
}
```

### **Phase 3: Web Workspace Integration**

```typescript
// apps/web/src/lib/features/WebFeatureResolver.ts
import { FEATURE_DEFINITIONS, LEGACY_MAPPINGS } from '@platform/feature-definitions';

export class WebFeatureResolver {
  private static instance: WebFeatureResolver;
  
  // Use same shared definitions
  resolveFeature(featureKey: string): string {
    return LEGACY_MAPPINGS[featureKey] || featureKey;
  }
  
  // Add client-specific logic
  getFeatureMetadata(featureKey: string, tierKey?: string): Record<string, any> {
    // Client implementation using shared definitions
  }
}
```

### **Phase 4: Service Separation**

```typescript
// apps/web/src/services/public/FeatureService.ts
export class PublicFeatureService {
  // Public-facing feature checks
  canShowFeature(operation: string): boolean {
    // Use WebFeatureResolver
  }
}

// apps/web/src/services/private/InternalFeatureService.ts
export class InternalFeatureService {
  // Internal validation
  async validateApiCall(operation: string): Promise<boolean> {
    // Call API for validation
  }
}
```

---

## 🔍 Validation Checklist

### **Startup Validation**
- [ ] Shared package version matches across workspaces
- [ ] Feature definitions are identical
- [ ] Legacy mappings are synchronized
- [ ] Tier hierarchies are consistent
- [ ] Operation registry matches

### **Runtime Validation**
- [ ] Feature resolution returns same results
- [ ] Permission checks are consistent
- [ ] Metadata is synchronized
- [ ] Cache invalidation works
- [ ] Error handling is aligned

### **Security Validation**
- [ ] Private services are properly scoped
- [ ] Public services don't expose sensitive data
- [ ] API validation is enforced
- [ ] Audit logging is consistent
- [ ] Rate limiting is applied

---

## 🎯 Success Metrics

### **Alignment Metrics**
- ✅ **100% feature definition consistency** between API and Web
- ✅ **Zero runtime mismatches** in feature resolution
- ✅ **Sub-second validation** on startup
- ✅ **Real-time alignment monitoring**

### **Security Metrics**
- ✅ **Zero unauthorized feature access** attempts
- ✅ **Complete audit trail** for feature checks
- ✅ **Proper scope separation** between public/private services
- ✅ **Rate limiting** on validation endpoints

### **Performance Metrics**
- ✅ **<100ms response time** for feature resolution
- ✅ **<500ms startup validation** time
- ✅ **99.9% uptime** for feature services
- ✅ **Minimal memory footprint** for caching

---

## 🔄 Next Steps

1. **Create shared package** for feature definitions
2. **Implement alignment validation** in both workspaces
3. **Separate public/private services** with proper scoping
4. **Add comprehensive testing** for alignment
5. **Set up monitoring** for alignment issues
6. **Document service boundaries** and usage patterns

This architecture ensures perfect synchronization between API and Web workspaces while maintaining proper security boundaries between public and private services.
