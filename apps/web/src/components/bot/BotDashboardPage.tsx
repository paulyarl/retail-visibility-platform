'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import BotTenantWidget from '@/components/bot/BotTenantWidget';
import BotSetupGuide from '@/components/bot/BotSetupGuide';
import { useChatbotOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';

interface BotDashboardPageProps {
  tenantId: string;
}

export default function BotDashboardPage({ tenantId }: BotDashboardPageProps) {
  const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId);

  return (
    <div className="space-y-6">
      {/* Free tier notice */}
      {chatbotCaps && chatbotCaps.enabled && !chatbotCaps.dynamicEnabled && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-medium text-blue-900">Static Mode</h3>
              <p className="text-sm text-blue-700">Your bot is running in static FAQ mode. Upgrade to enable AI-powered responses.</p>
            </div>
          </div>
          <Link href={`/t/${tenantId}/settings/subscription`}>
            <Button size="sm">Upgrade</Button>
          </Link>
        </div>
      )}

      {/* Getting Started Guide for new merchants */}
      <BotSetupGuide tenantId={tenantId} />

      {/* Main Widget */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <BotTenantWidget tenantId={tenantId} />
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLinkCard
          href={`/t/${tenantId}/bot/skills`}
          icon="⚡"
          title="Skills"
          description="Manage bot skills and capabilities"
        />
        <QuickLinkCard
          href={`/t/${tenantId}/bot/analytics`}
          icon="📊"
          title="Analytics"
          description="View detailed performance metrics"
        />
        <QuickLinkCard
          href={`/t/${tenantId}/bot/widget`}
          icon="🧩"
          title="Widget Setup"
          description="Embed the chatbot on your storefront"
        />
      </div>
    </div>
  );
}

function QuickLinkCard({ href, icon, title, description }: { href: string; icon: string; title: string; description: string }) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="font-medium text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
