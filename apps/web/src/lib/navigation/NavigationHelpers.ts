import { NavigationData } from './NavigationData';
import NavigationStandards from './NavigationStandards';

// Helper functions for consistent navigation
export const NavigationHelpers = {
  // Generate consistent URL patterns
  generateUrl: (scope: 'platform' | 'tenant' | 'admin', path: string, tenantId?: string) => {
    const base = NavigationData.URL_PATTERNS[scope.toUpperCase() as keyof typeof NavigationData.URL_PATTERNS];
    return tenantId ? base.replace('[tenantId]', tenantId) + path : base + path;
  },

  // Validate navigation structure
  validateStructure: (items: any[], scope: string) => {
    const errors = [];

    if (items.length > NavigationData.NAVIGATION_DEPTH.PRIMARY_MAX) {
      errors.push(`${scope}: Too many primary items (${items.length} > ${NavigationData.NAVIGATION_DEPTH.PRIMARY_MAX})`);
    }

    items.forEach((item, index) => {
      if (item.children?.length > NavigationData.NAVIGATION_DEPTH.SECONDARY_MAX) {
        errors.push(`${scope}: ${item.label} has too many children (${item.children.length})`);
      }

      item.children?.forEach((child: any) => {
        if (child.children?.length > NavigationData.NAVIGATION_DEPTH.TERTIARY_MAX) {
          errors.push(`${scope}: ${child.label} has too many grandchildren`);
        }
      });
    });

    return errors;
  },

  // Get standardized icon
  getStandardIcon: (type: keyof typeof NavigationData.ICON_KEYS) => {
    // Use NavigationStandards for the actual icon (client-side)
    if (NavigationStandards?.ICONS) {
      return NavigationStandards.ICONS[type]();
    }
    
    // Fallback: return null or handle appropriately
    return null;
  },

  // Get standardized color
  getStandardColor: (type: keyof typeof NavigationData.COLORS) => {
    return NavigationData.COLORS[type];
  },

  // Sort items by hierarchy
  sortByHierarchy: (items: any[]) => {
    return items.sort((a, b) => {
      const aOrder = a.hierarchy || 999;
      const bOrder = b.hierarchy || 999;
      return aOrder - bOrder;
    });
  },
};
