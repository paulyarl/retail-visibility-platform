/**
 * Digital Assets Module
 * Exports services for managing digital products, file storage, and access control
 */

export { DigitalAssetService, digitalAssetService } from './DigitalAssetService';
export { DigitalAccessService, digitalAccessService } from './DigitalAccessService';
export { DigitalFulfillmentService, digitalFulfillmentService } from './DigitalFulfillmentService';

export type { DigitalAsset, UploadResult } from './DigitalAssetService';
export type { AccessGrant, CreateAccessGrantParams } from './DigitalAccessService';
export type { FulfillmentResult } from './DigitalFulfillmentService';
