/**
 * Download Progress Component
 * 
 * Displays download progress with real-time progress bar,
 * handles file download via blob URL creation.
 * 
 * Used in customer download pages and dashboard.
 */

'use client';

import { useState, useCallback } from 'react';
import { Download, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { publicDownloadService } from '@/services/downloads/PublicDownloadService';

interface DownloadableAsset {
  id: string;
  name: string;
  downloadUrl: string;
  fileSize?: number;
  mimeType?: string;
}

interface DownloadProgressProps {
  asset: DownloadableAsset;
  accessToken: string;
  onDownloadComplete?: (asset: DownloadableAsset) => void;
  onDownloadError?: (asset: DownloadableAsset, error: string) => void;
  disabled?: boolean;
  className?: string;
}

const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

export default function DownloadProgress({
  asset,
  accessToken,
  onDownloadComplete,
  onDownloadError,
  disabled = false,
  className = '',
}: DownloadProgressProps) {
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadSize, setDownloadSize] = useState<number | null>(null);

  const handleDownload = useCallback(async () => {
    if (isDownloading || disabled) return;

    setIsDownloading(true);
    setError(null);
    setProgress(0);
    setIsComplete(false);

    try {
      // Use service for download with progress tracking
      const { blob, totalSize } = await publicDownloadService.downloadFromUrl(
        asset.downloadUrl,
        accessToken,
        {
          expectedSize: asset.fileSize,
          onProgress: (prog, loaded, total) => {
            setProgress(prog);
            if (total > 0) {
              setDownloadSize(total);
            }
          },
        }
      );

      setDownloadSize(totalSize);

      // Create download URL
      const url = window.URL.createObjectURL(blob);
      
      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      window.URL.revokeObjectURL(url);

      setProgress(100);
      setIsComplete(true);
      onDownloadComplete?.(asset);

    } catch (err: any) {
      const errorMessage = err.message || 'Download failed';
      setError(errorMessage);
      onDownloadError?.(asset, errorMessage);
    } finally {
      setIsDownloading(false);
    }
  }, [asset, accessToken, isDownloading, disabled, onDownloadComplete, onDownloadError]);

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setIsComplete(false);
    handleDownload();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Download Button */}
      <Button
        onClick={handleDownload}
        disabled={disabled || isDownloading}
        className="w-full"
        variant={isComplete ? 'outline' : 'default'}
      >
        {isDownloading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Downloading... {progress}%
          </>
        ) : isComplete ? (
          <>
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            Downloaded
          </>
        ) : error ? (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Download
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Download {asset.name}
          </>
        )}
      </Button>

      {/* Progress Bar */}
      {isDownloading && (
        <div className="space-y-1">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{progress}%</span>
            {downloadSize && (
              <span>{formatBytes(downloadSize * progress / 100)} / {formatBytes(downloadSize)}</span>
            )}
          </div>
        </div>
      )}

      {/* Success Message */}
      {isComplete && !isDownloading && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-800">
            Download complete! Check your downloads folder.
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && !isDownloading && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      )}

      {/* File Info */}
      {asset.fileSize && !isDownloading && !isComplete && (
        <p className="text-xs text-gray-500 text-center">
          File size: {formatBytes(asset.fileSize)}
        </p>
      )}
    </div>
  );
}

/**
 * Compact version for download lists
 */
export function DownloadProgressCompact({
  asset,
  accessToken,
  onDownloadComplete,
  onDownloadError,
  disabled = false,
}: {
  asset: DownloadableAsset;
  accessToken: string;
  onDownloadComplete?: (asset: DownloadableAsset) => void;
  onDownloadError?: (asset: DownloadableAsset, error: string) => void;
  disabled?: boolean;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (isDownloading || disabled) return;

    setIsDownloading(true);
    setError(null);

    try {
      const { blob } = await publicDownloadService.downloadFromUrl(
        asset.downloadUrl,
        accessToken,
        { expectedSize: asset.fileSize }
      );
      
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.name;
      link.click();
      
      window.URL.revokeObjectURL(url);
      setIsComplete(true);
      onDownloadComplete?.(asset);
    } catch (err: any) {
      setError(err.message);
      onDownloadError?.(asset, err.message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={handleDownload}
        disabled={disabled || isDownloading}
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isComplete ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : error ? (
          <AlertCircle className="h-4 w-4 text-red-600" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
      
      {asset.fileSize && (
        <Badge variant="outline" className="text-xs">
          {formatBytes(asset.fileSize)}
        </Badge>
      )}
    </div>
  );
}

/**
 * Batch download component for multiple files
 */
export function DownloadAllProgress({
  assets,
  accessToken,
  onComplete,
  disabled = false,
}: {
  assets: DownloadableAsset[];
  accessToken: string;
  onComplete?: () => void;
  disabled?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [completedCount, setCompletedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const handleDownloadAll = async () => {
    setCurrentIndex(0);
    setCompletedCount(0);
    setErrors([]);

    for (let i = 0; i < assets.length; i++) {
      setCurrentIndex(i);
      
      try {
        const { blob } = await publicDownloadService.downloadFromUrl(
          assets[i].downloadUrl,
          accessToken,
          { expectedSize: assets[i].fileSize }
        );
        
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = assets[i].name;
        link.click();
        
        window.URL.revokeObjectURL(url);
        setCompletedCount(i + 1);
        
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err: any) {
        setErrors(prev => [...prev, assets[i].name]);
      }
    }

    setCurrentIndex(-1);
    onComplete?.();
  };

  const isDownloading = currentIndex >= 0;
  const allComplete = completedCount === assets.length && !isDownloading;

  return (
    <div className="space-y-3">
      <Button
        onClick={handleDownloadAll}
        disabled={disabled || isDownloading}
        className="w-full"
      >
        {isDownloading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Downloading {currentIndex + 1} of {assets.length}...
          </>
        ) : allComplete ? (
          <>
            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
            All Downloads Complete
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Download All ({assets.length} files)
          </>
        )}
      </Button>

      {isDownloading && (
        <div className="space-y-1">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(completedCount / assets.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center">
            {completedCount} of {assets.length} files downloaded
          </p>
        </div>
      )}

      {errors.length > 0 && !isDownloading && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            {errors.length} file(s) failed to download. Please try again.
          </p>
        </div>
      )}
    </div>
  );
}
