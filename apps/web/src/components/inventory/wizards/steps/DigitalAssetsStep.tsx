/**
 * Digital Assets Step (Step 8)
 * 
 * Manages digital asset uploads and external links for digital/hybrid products.
 * Handles file uploads to Supabase storage and external link configuration.
 * 
 * Part of the product creation wizard for digital products.
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { 
  Upload, Link as LinkIcon, FileText, Trash2, Plus, 
  Loader2, AlertCircle, CheckCircle, ExternalLink, X,
  File, Image, Video, Music, Archive, FileCode
} from 'lucide-react';

import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Alert, AlertDescription } from '@/components/ui/Alert';
// File upload will be handled via API route

export interface DigitalAsset {
  id: string;
  name: string;
  type: 'file' | 'link';
  storage_method: 'platform' | 'external';
  file_path?: string;
  external_url?: string;
  file_size_bytes?: number;
  mime_type?: string;
  description?: string;
  upload_progress?: number;
  upload_status?: 'pending' | 'uploading' | 'complete' | 'error';
}

interface DigitalAssetsStepProps {
  data: {
    assets: DigitalAsset[];
    deliveryMethod: 'direct_download' | 'external_link' | 'license_key' | 'access_grant';
  };
  errors: Record<string, string>;
  onChange: (data: any) => void;
  tenantId: string;
  itemId?: string;
  disabled?: boolean;
}

const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  'Documents': ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.epub', '.mobi'],
  'Archives': ['.zip', '.rar', '.7z', '.tar', '.gz'],
  'Video': ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
  'Audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
  'Images': ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'],
  'Code': ['.js', '.ts', '.py', '.java', '.cpp', '.zip'],
  'Other': ['.iso', '.dmg', '.exe', '.apk'],
};

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const getFileIcon = (mimeType?: string, fileName?: string) => {
  if (!mimeType && fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(`.${ext}`)) return Image;
    if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(`.${ext}`)) return Video;
    if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'].includes(`.${ext}`)) return Music;
    if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(`.${ext}`)) return Archive;
    if (['.js', '.ts', '.py', '.java', '.cpp'].includes(`.${ext}`)) return FileCode;
  }
  
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.startsWith('video/')) return Video;
  if (mimeType?.startsWith('audio/')) return Music;
  if (mimeType?.includes('zip') || mimeType?.includes('archive')) return Archive;
  
  return FileText;
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return 'Unknown size';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

export default function DigitalAssetsStep({ 
  data, 
  errors, 
  onChange, 
  tenantId, 
  itemId,
  disabled = false 
}: DigitalAssetsStepProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkDescription, setNewLinkDescription] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAssetsChange = useCallback((assets: DigitalAsset[]) => {
    onChange({ ...data, assets });
  }, [data, onChange]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File size exceeds 500MB limit. Current size: ${formatBytes(file.size)}`);
      return;
    }
    
    setIsUploading(true);
    setUploadError(null);
    
    try {
      // Create a pending asset entry
      const pendingAsset: DigitalAsset = {
        id: `asset_${Date.now()}`,
        name: file.name,
        type: 'file',
        storage_method: 'platform',
        mime_type: file.type,
        file_size_bytes: file.size,
        upload_progress: 0,
        upload_status: 'uploading',
      };
      
      // Add to assets list immediately
      handleAssetsChange([...data.assets, pendingAsset]);
      
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1];
        
        try {
          // Upload via API route
          const response = await fetch('/api/digital-assets/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenantId,
              itemId: itemId || `temp_${Date.now()}`,
              fileName: file.name,
              mimeType: file.type,
              fileData: base64Data,
            }),
          });
          
          if (!response.ok) {
            throw new Error('Upload failed');
          }
          
          const result = await response.json();
          
          // Update asset with upload result
          const updatedAssets = data.assets.map(a => 
            a.id === pendingAsset.id 
              ? {
                  ...a,
                  id: result.asset?.id || pendingAsset.id,
                  file_path: result.asset?.file_path,
                  upload_progress: 100,
                  upload_status: 'complete' as const,
                }
              : a
          );
          
          handleAssetsChange(updatedAssets);
        } catch (err: any) {
          // Mark asset as error
          const updatedAssets = data.assets.map(a => 
            a.id === pendingAsset.id 
              ? { ...a, upload_status: 'error' as const }
              : a
          );
          handleAssetsChange(updatedAssets);
          setUploadError(err.message || 'Upload failed');
        }
      };
      
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (disabled || isUploading) return;
    
    handleFileSelect(e.dataTransfer.files);
  };

  const handleAddExternalLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) return;
    
    // Validate URL
    try {
      new URL(newLinkUrl);
    } catch {
      setUploadError('Invalid URL format');
      return;
    }
    
    const newAsset: DigitalAsset = {
      id: `asset_${Date.now()}`,
      name: newLinkName.trim(),
      type: 'link',
      storage_method: 'external',
      external_url: newLinkUrl.trim(),
      description: newLinkDescription.trim() || undefined,
      upload_status: 'complete',
    };
    
    handleAssetsChange([...data.assets, newAsset]);
    
    // Reset form
    setNewLinkName('');
    setNewLinkUrl('');
    setNewLinkDescription('');
    setShowAddLink(false);
    setUploadError(null);
  };

  const handleRemoveAsset = (assetId: string) => {
    handleAssetsChange(data.assets.filter(a => a.id !== assetId));
  };

  const isFormValid = () => {
    if (data.deliveryMethod === 'direct_download') {
      return data.assets.some(a => a.type === 'file' && a.upload_status === 'complete');
    }
    if (data.deliveryMethod === 'external_link') {
      return data.assets.some(a => a.type === 'link');
    }
    return true; // license_key and access_grant don't require assets
  };

  return (
    <div className="space-y-6">
      {/* Help Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Upload className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Digital Assets</h4>
              <p className="text-sm text-blue-700 mt-1">
                Upload files or add external links for your digital product. 
                Files are stored securely and customers will receive download access after purchase.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Section - Only for direct_download */}
      {data.deliveryMethod === 'direct_download' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.zip,.mp4,.mp3,.jpg,.png,.gif,.doc,.docx,.epub,.mobi"
                onChange={(e) => handleFileSelect(e.target.files)}
                disabled={disabled || isUploading}
              />
              
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                  <p className="mt-4 text-sm text-gray-600">Uploading file...</p>
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="mt-4 font-medium text-gray-700">
                    Drop files here or click to upload
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Supported: PDF, ZIP, MP4, MP3, EPUB, MOBI, Images (max 500MB)
                  </p>
                </>
              )}
            </div>
            
            {uploadError && (
              <Alert variant="error" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* External Links Section - Only for external_link */}
      {data.deliveryMethod === 'external_link' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Add External Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAddLink ? (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <Input
                  label="Link Name"
                  type="text"
                  value={newLinkName}
                  onChange={(e) => setNewLinkName(e.target.value)}
                  placeholder="e.g., User Guide PDF, Installation Video"
                  disabled={disabled}
                />
                
                <Input
                  label="URL"
                  type="url"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/..."
                  disabled={disabled}
                />
                
                <div>
                  <Label className="text-sm font-medium">Description (Optional)</Label>
                  <textarea
                    value={newLinkDescription}
                    onChange={(e) => setNewLinkDescription(e.target.value)}
                    placeholder="Brief description of the content..."
                    rows={2}
                    disabled={disabled}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleAddExternalLink} disabled={!newLinkName || !newLinkUrl || disabled}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Link
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddLink(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowAddLink(true)} disabled={disabled}>
                <Plus className="h-4 w-4 mr-2" />
                Add External Link
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Uploaded Assets List */}
      {data.assets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Uploaded Assets ({data.assets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.assets.map((asset) => {
                const FileIcon = getFileIcon(asset.mime_type, asset.name);
                
                return (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`
                        p-2 rounded-lg
                        ${asset.upload_status === 'error' ? 'bg-red-100' : 'bg-blue-100'}
                      `}>
                        <FileIcon className={`
                          h-5 w-5
                          ${asset.upload_status === 'error' ? 'text-red-600' : 'text-blue-600'}
                        `} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {asset.name}
                          </p>
                          {asset.upload_status === 'complete' && (
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          )}
                          {asset.upload_status === 'uploading' && (
                            <Loader2 className="h-4 w-4 text-blue-600 animate-spin flex-shrink-0" />
                          )}
                          {asset.upload_status === 'error' && (
                            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          {asset.type === 'link' ? (
                            <>
                              <ExternalLink className="h-3 w-3" />
                              <span className="truncate">{asset.external_url}</span>
                            </>
                          ) : (
                            <>
                              <Badge variant="outline" className="text-xs">
                                {asset.storage_method === 'platform' ? 'Platform Hosted' : 'External'}
                              </Badge>
                              {asset.file_size_bytes && (
                                <span>{formatBytes(asset.file_size_bytes)}</span>
                              )}
                            </>
                          )}
                        </div>
                        
                        {asset.upload_status === 'uploading' && asset.upload_progress !== undefined && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className="bg-blue-600 h-1.5 rounded-full transition-all"
                                style={{ width: `${asset.upload_progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAsset(asset.id)}
                      disabled={disabled || asset.upload_status === 'uploading'}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info for license_key and access_grant */}
      {(data.deliveryMethod === 'license_key' || data.deliveryMethod === 'access_grant') && (
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              {data.deliveryMethod === 'license_key' ? (
                <>
                  <FileCode className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-purple-900">License Key Delivery</h4>
                    <p className="text-sm text-purple-700 mt-1">
                      Unique license keys will be automatically generated for each purchase.
                      No file upload is required for this delivery method.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <ExternalLink className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-purple-900">Access Grant Delivery</h4>
                    <p className="text-sm text-purple-700 mt-1">
                      Customers will receive access credentials to your platform.
                      Configure access duration in the product settings.
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Validation Summary */}
      <Card className={isFormValid() ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            {isFormValid() ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            )}
            <div>
              <h4 className="font-medium">
                {isFormValid() ? 'Assets configured' : 'Assets needed'}
              </h4>
              <p className="text-sm text-gray-600">
                {isFormValid() 
                  ? `${data.assets.length} asset(s) ready for delivery.`
                  : data.deliveryMethod === 'direct_download'
                  ? 'Upload at least one file for customers to download.'
                  : data.deliveryMethod === 'external_link'
                  ? 'Add at least one external link for customers to access.'
                  : 'Configuration is ready to continue.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
