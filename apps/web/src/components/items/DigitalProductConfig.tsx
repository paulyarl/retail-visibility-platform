/**
 * Digital Product Configuration Component
 * Manages digital delivery settings, assets, and access control
 */

import { useState } from 'react';
import { Download, Link as LinkIcon, Key, Award, Upload, X, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export type DeliveryMethod = 'direct_download' | 'external_link' | 'license_key' | 'access_grant';
export type LicenseType = 'personal' | 'commercial' | 'educational' | 'enterprise';

export interface DigitalAsset {
  id: string;
  name: string;
  type: 'file' | 'link' | 'license_key';
  storage_method: 'platform' | 'external';
  file_path?: string;
  external_url?: string;
  file_size_bytes?: number;
  mime_type?: string;
  description?: string;
}

export interface DigitalProductData {
  deliveryMethod: DeliveryMethod;
  assets: DigitalAsset[];
  licenseType?: LicenseType;
  accessDurationDays?: number | null;
  downloadLimit?: number | null;
  externalUrl?: string;
  accessInstructions?: string;
}

interface DigitalProductConfigProps {
  value: DigitalProductData;
  onChange: (data: DigitalProductData) => void;
  disabled?: boolean;
}

export default function DigitalProductConfig({ value, onChange, disabled }: DigitalProductConfigProps) {
  const [showFileUpload, setShowFileUpload] = useState(false);

  const deliveryMethods = [
    {
      value: 'direct_download' as DeliveryMethod,
      icon: Download,
      label: 'Direct Download',
      description: 'Upload files - customers download directly',
    },
    {
      value: 'external_link' as DeliveryMethod,
      icon: LinkIcon,
      label: 'External Link',
      description: 'Link to Dropbox, Google Drive, etc.',
    },
    {
      value: 'license_key' as DeliveryMethod,
      icon: Key,
      label: 'License Key',
      description: 'Generate unique license keys',
    },
    {
      value: 'access_grant' as DeliveryMethod,
      icon: Award,
      label: 'Access Grant',
      description: 'Grant access to content/membership',
    },
  ];

  const handleDeliveryMethodChange = (method: DeliveryMethod) => {
    onChange({ ...value, deliveryMethod: method });
  };

  const handleAddExternalLink = () => {
    if (!value.externalUrl) return;
    
    const newAsset: DigitalAsset = {
      id: `asset_${Date.now()}`,
      name: value.externalUrl.split('/').pop() || 'External File',
      type: 'link',
      storage_method: 'external',
      external_url: value.externalUrl,
      description: value.accessInstructions,
    };

    onChange({
      ...value,
      assets: [...value.assets, newAsset],
      externalUrl: '',
      accessInstructions: '',
    });
  };

  const handleRemoveAsset = (assetId: string) => {
    onChange({
      ...value,
      assets: value.assets.filter(a => a.id !== assetId),
    });
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      {/* Delivery Method Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Delivery Method
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {deliveryMethods.map((method) => {
            const Icon = method.icon;
            const isSelected = value.deliveryMethod === method.value;
            
            return (
              <button
                key={method.value}
                type="button"
                onClick={() => !disabled && handleDeliveryMethodChange(method.value)}
                disabled={disabled}
                className={`
                  flex items-start p-4 border-2 rounded-lg transition-all text-left
                  ${isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className={`
                  p-2 rounded-lg mr-3
                  ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}
                `}>
                  <Icon className={`
                    w-5 h-5
                    ${isSelected ? 'text-blue-600' : 'text-gray-600'}
                  `} />
                </div>
                <div className="flex-1">
                  <div className={`
                    text-sm font-semibold mb-1
                    ${isSelected ? 'text-blue-900' : 'text-gray-900'}
                  `}>
                    {method.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    {method.description}
                  </div>
                </div>
                {isSelected && (
                  <div className="ml-2">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Direct Download - File Upload */}
      {value.deliveryMethod === 'direct_download' && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                File upload will be available after Supabase storage setup
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Supported: PDF, ZIP, MP3, MP4, EPUB, MOBI (max 500MB)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* External Link */}
      {value.deliveryMethod === 'external_link' && (
        <div className="space-y-4">
          <Input
            label="Download Link"
            type="url"
            value={value.externalUrl || ''}
            onChange={(e) => onChange({ ...value, externalUrl: e.target.value })}
            placeholder="https://drive.google.com/file/..."
            disabled={disabled}
            helperText="Provide a permanent link to your file (Dropbox, Google Drive, OneDrive, etc.)"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Instructions (Optional)
            </label>
            <textarea
              value={value.accessInstructions || ''}
              onChange={(e) => onChange({ ...value, accessInstructions: e.target.value })}
              placeholder="Provide any special instructions for accessing the file..."
              rows={3}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <Button
            onClick={handleAddExternalLink}
            disabled={!value.externalUrl || disabled}
            variant="secondary"
            size="sm"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Add Link
          </Button>
        </div>
      )}

      {/* License Key */}
      {value.deliveryMethod === 'license_key' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Key className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 mb-1">
                License Key Generation
              </h4>
              <p className="text-sm text-blue-700">
                Unique license keys will be automatically generated for each purchase.
                Keys will be delivered via email to the customer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Access Grant */}
      {value.deliveryMethod === 'access_grant' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start">
            <Award className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-purple-900 mb-1">
                Access Grant System
              </h4>
              <p className="text-sm text-purple-700">
                Customers will receive access credentials to your platform or content.
                Configure access duration and permissions below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Asset List */}
      {value.assets.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Digital Assets ({value.assets.length})
          </label>
          <div className="space-y-2">
            {value.assets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <div className="flex items-center flex-1 min-w-0">
                  {asset.type === 'link' ? (
                    <ExternalLink className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                  ) : (
                    <Download className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {asset.name}
                    </div>
                    {asset.file_size_bytes && (
                      <div className="text-xs text-gray-500">
                        {formatBytes(asset.file_size_bytes)}
                      </div>
                    )}
                    {asset.external_url && (
                      <div className="text-xs text-gray-500 truncate">
                        {asset.external_url}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAsset(asset.id)}
                  disabled={disabled}
                  className="ml-3 p-1 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Access Control Settings */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Access Control
        </h3>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* License Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              License Type
            </label>
            <select
              value={value.licenseType || 'personal'}
              onChange={(e) => onChange({ ...value, licenseType: e.target.value as LicenseType })}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="personal">Personal Use</option>
              <option value="commercial">Commercial Use</option>
              <option value="educational">Educational Use</option>
              <option value="enterprise">Enterprise License</option>
            </select>
          </div>

          {/* Access Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Duration
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={value.accessDurationDays || ''}
                onChange={(e) => onChange({ 
                  ...value, 
                  accessDurationDays: e.target.value ? parseInt(e.target.value) : null 
                })}
                placeholder="Unlimited"
                min="1"
                disabled={disabled}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-500">days</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Leave empty for lifetime access
            </p>
          </div>

          {/* Download Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Download Limit
            </label>
            <input
              type="number"
              value={value.downloadLimit || ''}
              onChange={(e) => onChange({ 
                ...value, 
                downloadLimit: e.target.value ? parseInt(e.target.value) : null 
              })}
              placeholder="Unlimited"
              min="1"
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty for unlimited downloads
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
