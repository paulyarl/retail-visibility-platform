/**
 * Shared Onboarding State Service
 * 
 * Manages state between two-phase onboarding:
 * - Phase 1 (/onboarding): Account setup + tenant creation
 * - Phase 2 (/t/{tenantId}/onboarding): Business profile details
 * 
 * Uses localStorage for persistence across page navigations
 */

export interface Phase1Data {
  // User profile
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  
  // Initial business info
  businessName: string;
  businessType: string;
  
  // Created tenant (after phase 1 completion)
  tenantId?: string;
  tenantSlug?: string;
  
  // Timestamps
  completedAt?: string;
  startedAt: string;
}

export interface Phase2Data {
  // Business profile (from OnboardingWizard)
  business_name?: string;
  business_description?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
  phone_number?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  hours?: Record<string, string>;
  social_links?: Record<string, string>;
  seo_tags?: string[];
  latitude?: number;
  longitude?: number;
  admin_email?: string;
  slug?: string;
  
  // Timestamps
  startedAt?: string;
  lastSavedAt?: string;
}

export interface OnboardingState {
  phase1: Phase1Data | null;
  phase2: Phase2Data | null;
  currentPhase: 1 | 2 | null;
  tenantId?: string;
}

const STORAGE_KEY_PREFIX = 'onboarding_state_';
const PHASE1_KEY = 'onboarding_phase1_';
const GLOBAL_STATE_KEY = 'onboarding_global_state';

class OnboardingStateService {
  /**
   * Initialize phase 1 state
   */
  startPhase1(): Phase1Data {
    const state: Phase1Data = {
      firstName: '',
      lastName: '',
      businessName: '',
      businessType: '',
      startedAt: new Date().toISOString(),
    };
    
    this.savePhase1(state);
    this.setGlobalState({ currentPhase: 1, tenantId: undefined });
    
    return state;
  }

  /**
   * Save phase 1 data
   */
  savePhase1(data: Partial<Phase1Data>): Phase1Data {
    const existing = this.getPhase1() || {
      firstName: '',
      lastName: '',
      businessName: '',
      businessType: '',
      startedAt: new Date().toISOString(),
    };
    
    const updated = { ...existing, ...data };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(PHASE1_KEY, JSON.stringify(updated));
    }
    
    return updated;
  }

  /**
   * Get phase 1 data
   */
  getPhase1(): Phase1Data | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const data = localStorage.getItem(PHASE1_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * Complete phase 1 and prepare for phase 2
   */
  completePhase1(tenantId: string, tenantSlug?: string): void {
    const phase1 = this.getPhase1();
    
    if (phase1) {
      this.savePhase1({
        ...phase1,
        tenantId,
        tenantSlug,
        completedAt: new Date().toISOString(),
      });
      
      // Initialize phase 2 with data from phase 1
      this.startPhase2(tenantId, {
        business_name: phase1.businessName,
        phone_number: phase1.phone || '',
        email: phase1.email || '',
      });
      
      this.setGlobalState({ currentPhase: 2, tenantId });
    }
  }

  /**
   * Initialize phase 2 state
   */
  startPhase2(tenantId: string, initialData?: Partial<Phase2Data>): Phase2Data {
    const state: Phase2Data = {
      ...initialData,
      startedAt: new Date().toISOString(),
    };
    
    this.savePhase2(tenantId, state);
    this.setGlobalState({ currentPhase: 2, tenantId });
    
    return state;
  }

  /**
   * Save phase 2 data for a specific tenant
   */
  savePhase2(tenantId: string, data: Partial<Phase2Data>): Phase2Data {
    const key = `${STORAGE_KEY_PREFIX}${tenantId}`;
    const existing = this.getPhase2(tenantId) || {};
    
    const updated = {
      ...existing,
      ...data,
      lastSavedAt: new Date().toISOString(),
    };
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(updated));
    }
    
    return updated;
  }

  /**
   * Get phase 2 data for a specific tenant
   */
  getPhase2(tenantId: string): Phase2Data | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const key = `${STORAGE_KEY_PREFIX}${tenantId}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get global onboarding state
   */
  getGlobalState(): OnboardingState {
    if (typeof window === 'undefined') {
      return { phase1: null, phase2: null, currentPhase: null };
    }
    
    try {
      const data = localStorage.getItem(GLOBAL_STATE_KEY);
      const state = data ? JSON.parse(data) : { currentPhase: null, tenantId: undefined };
      
      return {
        phase1: this.getPhase1(),
        phase2: state.tenantId ? this.getPhase2(state.tenantId) : null,
        currentPhase: state.currentPhase,
        tenantId: state.tenantId,
      };
    } catch {
      return { phase1: null, phase2: null, currentPhase: null };
    }
  }

  /**
   * Set global onboarding state
   */
  private setGlobalState(state: { currentPhase: 1 | 2 | null; tenantId?: string }): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(GLOBAL_STATE_KEY, JSON.stringify(state));
    }
  }

  /**
   * Check if user is coming from phase 1 completion
   */
  isComingFromPhase1(): boolean {
    const state = this.getGlobalState();
    return state.currentPhase === 2 && !!state.tenantId && !!state.phase1?.completedAt;
  }

  /**
   * Check if phase 1 is complete
   */
  isPhase1Complete(): boolean {
    const phase1 = this.getPhase1();
    return !!phase1?.completedAt && !!phase1?.tenantId;
  }

  /**
   * Check if phase 2 is complete (business profile filled)
   */
  isPhase2Complete(tenantId: string): boolean {
    const phase2 = this.getPhase2(tenantId);
    if (!phase2) return false;
    
    // Check required fields
    return !!(
      phase2.business_name &&
      phase2.address_line1 &&
      phase2.city &&
      phase2.postal_code &&
      phase2.country_code &&
      phase2.phone_number &&
      phase2.email
    );
  }

  /**
   * Get phase 1 data to pre-populate phase 2
   */
  getPhase1DataForPhase2(): Partial<Phase2Data> | null {
    const phase1 = this.getPhase1();
    if (!phase1) return null;
    
    return {
      business_name: phase1.businessName,
      phone_number: phase1.phone || '',
      email: phase1.email || '',
    };
  }

  /**
   * Clear all onboarding state
   */
  clearAll(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(PHASE1_KEY);
    localStorage.removeItem(GLOBAL_STATE_KEY);
    
    // Clear all tenant-specific phase 2 data
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Clear phase 1 only (after phase 2 starts)
   */
  clearPhase1(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PHASE1_KEY);
    }
  }

  /**
   * Clear phase 2 for a specific tenant
   */
  clearPhase2(tenantId: string): void {
    if (typeof window !== 'undefined') {
      const key = `${STORAGE_KEY_PREFIX}${tenantId}`;
      localStorage.removeItem(key);
    }
  }
}

// Export singleton
export const onboardingStateService = new OnboardingStateService();
