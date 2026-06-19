'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useChatbotOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';

interface BotWidgetSetupPageProps {
  tenantId: string;
}

export default function BotWidgetSetupPage({ tenantId }: BotWidgetSetupPageProps) {
  const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId, { forTenant: true });
  const [copied, setCopied] = useState(false);

  const embedScript = `<script src="${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/bot-widget/bot-widget.js" data-tenant-id="${tenantId}" data-page-context="storefront" defer></script>`;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(embedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (chatbotCaps && !chatbotCaps.enabled) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">🤖</div>
        <h3 className="text-lg font-semibold text-gray-900">Chatbot Not Available</h3>
        <p className="text-sm text-gray-500 mt-1">Your current plan does not include the chatbot feature.</p>
        <Link href={`/t/${tenantId}/settings/subscription`} className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          Upgrade your plan →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Embed Instructions */}
      <Card>
        <CardHeader><CardTitle>Embed Code</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Add this script tag to your storefront HTML, just before the closing <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag:
          </p>
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
              <code>{embedScript}</code>
            </pre>
            <Button
              size="sm"
              className="absolute top-2 right-2"
              variant="secondary"
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Configuration Options</h4>
            <ul className="text-sm text-gray-600 space-y-1 pl-4">
              <li><code className="bg-gray-100 px-1 rounded">data-tenant-id</code> — Your tenant ID (required)</li>
              <li><code className="bg-gray-100 px-1 rounded">data-page-context</code> — Page context: <code>storefront</code>, <code>product</code>, <code>category</code> (optional)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Programmatic API */}
      <Card>
        <CardHeader><CardTitle>Programmatic API</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">You can also initialize the widget programmatically:</p>
          <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
            <code>{`<script>
  BotWidget.init({
    tenantId: '${tenantId}',
    pageContext: 'storefront'
  });
</script>`}</code>
          </pre>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Available Methods</h4>
            <ul className="text-sm text-gray-600 space-y-1 pl-4">
              <li><code className="bg-gray-100 px-1 rounded">BotWidget.init(opts)</code> — Initialize the widget</li>
              <li><code className="bg-gray-100 px-1 rounded">BotWidget.open()</code> — Open the widget panel</li>
              <li><code className="bg-gray-100 px-1 rounded">BotWidget.close()</code> — Close the widget panel</li>
              <li><code className="bg-gray-100 px-1 rounded">BotWidget.destroy()</code> — Remove the widget</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Customization */}
      <Card>
        <CardHeader><CardTitle>Customization</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-3">
            Customize the widget appearance from the <Link href={`/t/${tenantId}/bot/config`} className="text-indigo-600 hover:underline">Configuration page</Link>.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-medium text-gray-700">Position</div>
              <div className="text-gray-500">4 corner positions</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-medium text-gray-700">Color</div>
              <div className="text-gray-500">Custom brand color</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-medium text-gray-700">Avatar</div>
              <div className="text-gray-500">Custom avatar URL</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-medium text-gray-700">Pre-chat form</div>
              <div className="text-gray-500">Email, phone, order</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-medium text-gray-700">After hours</div>
              <div className="text-gray-500">Custom message</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-medium text-gray-700">Auto-open</div>
              <div className="text-gray-500">Configurable delay</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
