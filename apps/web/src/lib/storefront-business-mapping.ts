export type StorefrontType = 'online' | 'retail' | 'service' | 'social' | 'flexible' | 'none';

export const STOREFRONT_BUSINESS_PRIORITY: Record<StorefrontType, string[]> = {
  online: ['electronics', 'books_media', 'fashion', 'home_garden', 'general'],
  retail: ['grocery', 'fashion', 'hardware_tools', 'furniture', 'pharmacy', 'general'],
  service: ['service_business', 'general'],
  social: ['fashion', 'health_beauty', 'jewelry', 'electronics', 'general'],
  flexible: [],
  none: [],
};

export const STOREFRONT_DEFAULT_CATEGORY_COUNT: Record<StorefrontType, number> = {
  online: 12,
  retail: 15,
  service: 4,
  social: 10,
  flexible: 15,
  none: 15,
};

export const STOREFRONT_DEFAULT_PRODUCT_TYPE: Record<StorefrontType, 'physical' | 'digital' | 'hybrid' | 'service'> = {
  online: 'digital',
  retail: 'physical',
  service: 'service',
  social: 'physical',
  flexible: 'physical',
  none: 'physical',
};

export const STOREFRONT_DEFAULT_PRODUCT_COUNT: Record<StorefrontType, number> = {
  online: 15,
  retail: 25,
  service: 10,
  social: 20,
  flexible: 25,
  none: 25,
};

export function getPrioritizedBusinessTypes(storefrontType: StorefrontType | undefined, allTypes: { id: string }[]): { id: string }[] {
  if (!storefrontType) return allTypes;
  const priority = STOREFRONT_BUSINESS_PRIORITY[storefrontType];
  if (!priority || priority.length === 0) return allTypes;
  const prioritySet = new Set(priority);
  const prioritized = allTypes.filter(t => prioritySet.has(t.id));
  const rest = allTypes.filter(t => !prioritySet.has(t.id));
  return [...prioritized, ...rest];
}
