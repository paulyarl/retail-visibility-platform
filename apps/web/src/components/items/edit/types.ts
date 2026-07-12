import { Item } from '@/services/itemsDataService';
import { ProductType } from '../ProductTypeSelector';
import { DigitalProductData } from '../DigitalProductConfig';

export type ItemStatus = 'draft' | 'active' | 'archived';
export type ItemCondition = 'new' | 'used' | 'refurbished';

export interface GatewaySelection {
  gateway_type: string | null;
  gateway_id: string | null;
}

export interface ItemFormValues {
  sku: string;
  name: string;
  brand: string;
  manufacturer: string;
  condition: ItemCondition;
  mpn: string;
  gtin: string;
  price: string;
  salePrice: string;
  stock: string;
  description: string;
  enhancedDescription: string;
  features: string;
  specifications: string;
  status: ItemStatus;
  tenantCategoryId: string;
  gatewaySelection: GatewaySelection;
  productType: ProductType;
  digitalProductData: DigitalProductData;
  showCategorySelector: boolean;
  gtinEnriching: boolean;
}

export interface ItemFormSetters {
  setSku: (v: string) => void;
  setName: (v: string) => void;
  setBrand: (v: string) => void;
  setManufacturer: (v: string) => void;
  setCondition: (v: ItemCondition) => void;
  setMpn: (v: string) => void;
  setGtin: (v: string) => void;
  setPrice: (v: string) => void;
  setSalePrice: (v: string) => void;
  setStock: (v: string) => void;
  setDescription: (v: string) => void;
  setEnhancedDescription: (v: string) => void;
  setFeatures: (v: string) => void;
  setSpecifications: (v: string) => void;
  setStatus: (v: ItemStatus) => void;
  setTenantCategoryId: (v: string) => void;
  setGatewaySelection: (v: GatewaySelection) => void;
  setProductType: (v: ProductType) => void;
  setDigitalProductData: (v: DigitalProductData) => void;
  setShowCategorySelector: (v: boolean) => void;
}

export interface VariantChange {
  action: 'update' | 'delete' | 'create';
  variantId?: string;
  data?: any;
}

export interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  onSave: (item: Item) => Promise<Item>;
  onItemUpdated?: () => void;
}
