import type { StorefrontOptionFlags, PublicFaqOptionsFlags, PublicCrmOptionsFlags, FeaturedOptionsState } from '@/services/CapabilityResolutionService';
import type { ActiveFeaturedResult } from '@/services/ActiveFeaturedService';

export type DirectoryEntryLayoutKey = 'classic' | 'editorial' | 'immersive' | 'premium';

export interface DirectoryEntryLayoutProps {
  tenantId: string;
  listing: any;
  tenantLogo: string | null;
  businessProfile: any;
  businessHours: any;
  storefrontCategories: { categories: any[]; uncategorizedCount: number };
  featuredProducts: any[];
  activeFeatured?: ActiveFeaturedResult;
  relatedProducts: any[];
  tenantInfo: any;
  slugForRelated: string;
  optFlags: StorefrontOptionFlags | null;
  showStatusPanel: boolean;
  hoursStatus: any;
  isRetailStore: boolean;
  isOnlineStore: boolean;
  isServiceStore: boolean;
  showsHours: boolean;
  showsMap: boolean;
  showsLocation: boolean;
  currentUrl: string;
  baseUrl: string;
  faqFlags: PublicFaqOptionsFlags | null;
  crmFlags: PublicCrmOptionsFlags | null;
  paymentGatewayStatus: { hasActiveGateway: boolean; defaultGatewayType: string | null };
  featuredOptionsState: FeaturedOptionsState | null;
  actualProductCount: number;
  storeStatus: any;
  fullAddress: string;
  isDemo?: boolean;
  demoExpiresAt?: string | null;
}
