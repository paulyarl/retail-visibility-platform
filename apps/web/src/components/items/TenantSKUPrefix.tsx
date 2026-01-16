import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { generateTenantKey } from '@/lib/sku-generator';
import { Copy, Check } from 'lucide-react';

/**
 * Display tenant's unique SKU prefix
 * Shows the 4-character key that will be used in all auto-generated SKUs
 */
export default function TenantSKUPrefix() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [copied, setCopied] = useState(false);
  const [tenantKey, setTenantKey] = useState<string>('');

  useEffect(() => {
    if (tenantId) {
      const key = generateTenantKey(tenantId);
      setTenantKey(key);
    }
  }, [tenantId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(tenantKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!tenantKey) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-blue-700">Your SKU Prefix:</span>
        <code className="px-2 py-1 bg-white border border-blue-300 rounded text-sm font-mono font-bold text-blue-900">
          {tenantKey}
        </code>
      </div>
      <button
        onClick={handleCopy}
        className="p-1 hover:bg-blue-100 rounded transition-colors"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Copy className="w-4 h-4 text-blue-600" />
        )}
      </button>
    </div>
  );
}
