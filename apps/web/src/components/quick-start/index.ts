// Quick Start Components - Single source of truth for business types and quick start UI
export { 
  BusinessTypeSelector, 
  BUSINESS_TYPES, 
  getBusinessType, 
  getDefaultCount,
  type BusinessType,
  type BusinessTypeId,
} from './BusinessTypeSelector';

export { QuickStartCategoryModal } from './QuickStartCategoryModal';
export { QuickStartProductModal, type QuickStartProductConfig } from './QuickStartProductModal';
export { 
  QuickStartProductSettings, 
  DEFAULT_PRODUCT_SETTINGS,
  type ProductGenerationSettings,
} from './QuickStartProductSettings';
