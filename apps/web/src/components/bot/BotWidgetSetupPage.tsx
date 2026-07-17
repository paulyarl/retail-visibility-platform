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
  const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId);
  const [copied, setCopied] = useState(false);
  const [copiedExternal, setCopiedExternal] = useState(false);

  const platformOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-platform.com';
  const embedScript = `<script src="${platformOrigin}/bot-widget/bot-widget.js" data-tenant-id="${tenantId}" data-page-context="storefront" defer></script>`;
  const externalEmbedScript = `<script src="${platformOrigin}/bot-widget/bot-widget.js" data-embed-key="YOUR_EMBED_KEY" data-page-context="storefront" defer></script>`;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(embedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyExternal = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(externalEmbedScript);
      setCopiedExternal(true);
      setTimeout(() => setCopiedExternal(false), 2000);
    }
  };

  const hasExternalEmbed = chatbotCaps?.features?.chatbot_external_embed === true;

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
              <li><code className="bg-gray-100 px-1 rounded">data-tenant-id</code> — Your tenant ID (for platform storefront embed)</li>
              <li><code className="bg-gray-100 px-1 rounded">data-embed-key</code> — Your embed key (for external site embed)</li>
              <li><code className="bg-gray-100 px-1 rounded">data-page-context</code> — Page context: <code>storefront</code>, <code>product</code>, <code>category</code> (optional)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* External Embed */}
      <Card>
        <CardHeader>
          <CardTitle>External Site Embed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasExternalEmbed ? (
            <>
              <p className="text-sm text-gray-600">
                Embed the bot widget on external websites (WordPress, custom sites). Use your embed key instead of tenant ID:
              </p>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
                  <code>{externalEmbedScript}</code>
                </pre>
                <Button
                  size="sm"
                  className="absolute top-2 right-2"
                  variant="secondary"
                  onClick={handleCopyExternal}
                >
                  {copiedExternal ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>Note:</strong> Replace <code className="bg-blue-100 px-1 rounded">YOUR_EMBED_KEY</code> with your actual embed key.
                The embed key validates the requesting domain against your allowed domains list.
                Contact platform support to obtain your embed key and configure allowed domains.
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">
                External embedding allows you to place the bot widget on external websites like WordPress.
              </p>
              <Link href={`/t/${tenantId}/settings/subscription`} className="text-sm text-indigo-600 hover:underline">
                Upgrade to Professional+ or purchase this feature →
              </Link>
            </div>
          )}
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
