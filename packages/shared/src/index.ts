export type Tenant = { id: string; name: string; createdAt: string };
export type User = { id: string; tenantId: string; email: string; role: string; createdAt: string };
export type InventoryItem = { id: string; tenantId: string; sku: string; name: string; metadata?: Record<string, unknown> };
export type PhotoAsset = { id: string; tenantId: string; inventoryItemId: string; url: string; capturedAt: string; metadata?: Record<string, unknown> };
