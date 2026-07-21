'use client';

import React from 'react';
import { Download, Key, Link as LinkIcon, Clock, FileCheck, FileText, HardDrive, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface DigitalAssetMeta {
  format?: string;
  size?: string;
}

interface DigitalWhatYouGetCardProps {
  product: {
    digitalDeliveryMethod?: string | null;
    licenseType?: string | null;
    accessDurationDays?: number | null;
    downloadLimit?: number | null;
    digitalAssets?: any[] | null;
    metadata?: Record<string, any> | null;
  };
  className?: string;
}

type DeliveryMethod = 'direct_download' | 'license_key' | 'external_link' | 'access_grant' | string;

const deliveryConfig: Record<string, { label: string; icon: React.ElementType; accessMessage: string }> = {
  direct_download: {
    label: 'Direct Download',
    icon: Download,
    accessMessage: 'Instant Access',
  },
  license_key: {
    label: 'License Key',
    icon: Key,
    accessMessage: 'Instant Access',
  },
  external_link: {
    label: 'External Link',
    icon: LinkIcon,
    accessMessage: 'Delivered via external link',
  },
  access_grant: {
    label: 'Access Grant',
    icon: Clock,
    accessMessage: 'Access within 24 hours',
  },
};

function formatAccessDuration(days?: number | null): string | null {
  if (days === undefined || days === null) return null;
  if (days <= 0) return 'Lifetime access';
  if (days === 1) return '1 day access';
  return `${days} days access`;
}

function formatDownloadLimit(limit?: number | null): string | null {
  if (limit === undefined || limit === null) return null;
  if (limit <= 0) return 'Unlimited downloads';
  if (limit === 1) return '1 download';
  return `${limit} downloads`;
}

function getFileMeta(product: DigitalWhatYouGetCardProps['product']): DigitalAssetMeta {
  const digitalAssets = product.digitalAssets || [];
  const firstAsset = digitalAssets[0] || {};
  const metadata = product.metadata || {};

  return {
    format: firstAsset.format || metadata.fileFormat || metadata.file_format || null,
    size: firstAsset.size || metadata.fileSize || metadata.file_size || null,
  };
}

export function DigitalWhatYouGetCard({ product, className = '' }: DigitalWhatYouGetCardProps) {
  const method = (product.digitalDeliveryMethod || 'direct_download') as DeliveryMethod;
  const config = deliveryConfig[method] || deliveryConfig.direct_download;
  const DeliveryIcon = config.icon;

  const fileMeta = getFileMeta(product);
  const accessDuration = formatAccessDuration(product.accessDurationDays);
  const downloadLimit = formatDownloadLimit(product.downloadLimit);
  const licenseType = product.licenseType;

  const rows: { icon: React.ElementType; label: string; value: React.ReactNode }[] = [
    { icon: DeliveryIcon, label: 'Delivery', value: config.label },
    { icon: FileCheck, label: 'Access', value: config.accessMessage },
  ];

  if (fileMeta.format) {
    rows.push({ icon: FileText, label: 'Format', value: fileMeta.format });
  }

  if (fileMeta.size) {
    rows.push({ icon: HardDrive, label: 'Size', value: fileMeta.size });
  }

  if (licenseType) {
    rows.push({ icon: Shield, label: 'License', value: licenseType });
  }

  if (accessDuration) {
    rows.push({ icon: Clock, label: 'Duration', value: accessDuration });
  }

  if (downloadLimit) {
    rows.push({ icon: Download, label: 'Downloads', value: downloadLimit });
  }

  return (
    <Card variant="outlined" withBorder className={`${className}`}>
      <CardHeader>
        <CardTitle>What You Get</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-md bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    {row.label}
                  </p>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {row.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default DigitalWhatYouGetCard;
