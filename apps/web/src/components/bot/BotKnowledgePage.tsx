'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { botService } from '@/services/BotService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/hooks/use-toast';

interface BotKnowledgePageProps {
  tenantId: string;
}

export default function BotKnowledgePage({ tenantId }: BotKnowledgePageProps) {
  const queryClient = useQueryClient();
  const [refreshingFaq, setRefreshingFaq] = useState(false);
  const [refreshingProduct, setRefreshingProduct] = useState(false);
  const [refreshingBadge, setRefreshingBadge] = useState(false);
  const [refreshingPolicy, setRefreshingPolicy] = useState(false);
  const [refreshingBizInfo, setRefreshingBizInfo] = useState(false);
  const [refreshingHours, setRefreshingHours] = useState(false);
  const [refreshingFulfillment, setRefreshingFulfillment] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['bot', 'embeddings-status', tenantId],
    queryFn: () => botService.getEmbeddingsStatus(tenantId),
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    retry: 0,
  });

  async function handleRefreshFaq() {
    setRefreshingFaq(true);
    try {
      await botService.refreshFaqEmbeddings(tenantId);
      await queryClient.invalidateQueries({ queryKey: ['bot', 'embeddings-status', tenantId] });
      toast({ title: 'FAQ embeddings refreshed' });
    } catch (err: any) {
      toast({ title: 'Failed to refresh FAQ embeddings', description: err.message, variant: 'destructive' });
    } finally {
      setRefreshingFaq(false);
    }
  }

  async function handleRefreshProduct() {
    setRefreshingProduct(true);
    try {
      await botService.refreshProductEmbeddings(tenantId);
      await queryClient.invalidateQueries({ queryKey: ['bot', 'embeddings-status', tenantId] });
      toast({ title: 'Product embeddings refreshed' });
    } catch (err: any) {
      toast({ title: 'Failed to refresh product embeddings', description: err.message, variant: 'destructive' });
    } finally {
      setRefreshingProduct(false);
    }
  }

  async function handleRefreshBadgeRegistry() {
    setRefreshingBadge(true);
    try {
      await botService.refreshKnowledgeEmbeddings(tenantId, 'badge_registry');
      await queryClient.invalidateQueries({ queryKey: ['bot', 'embeddings-status', tenantId] });
      toast({ title: 'Badge registry embeddings refreshed' });
    } catch (err: any) {
      toast({ title: 'Failed to refresh badge registry embeddings', description: err.message, variant: 'destructive' });
    } finally {
      setRefreshingBadge(false);
    }
  }

  async function handleRefreshPolicy() {
    setRefreshingPolicy(true);
    try {
      await botService.refreshKnowledgeEmbeddings(tenantId, 'policy');
      await queryClient.invalidateQueries({ queryKey: ['bot', 'embeddings-status', tenantId] });
      toast({ title: 'Policy embeddings refreshed' });
    } catch (err: any) {
      toast({ title: 'Failed to refresh policy embeddings', description: err.message, variant: 'destructive' });
    } finally {
      setRefreshingPolicy(false);
    }
  }

  async function handleRefreshBusinessInfo() {
    setRefreshingBizInfo(true);
    try {
      await botService.refreshKnowledgeEmbeddings(tenantId, 'business_info');
      await queryClient.invalidateQueries({ queryKey: ['bot', 'embeddings-status', tenantId] });
      toast({ title: 'Business info embeddings refreshed' });
    } catch (err: any) {
      toast({ title: 'Failed to refresh business info embeddings', description: err.message, variant: 'destructive' });
    } finally {
      setRefreshingBizInfo(false);
    }
  }

  async function handleRefreshHours() {
    setRefreshingHours(true);
    try {
      await botService.refreshKnowledgeEmbeddings(tenantId, 'hours');
      await queryClient.invalidateQueries({ queryKey: ['bot', 'embeddings-status', tenantId] });
      toast({ title: 'Business hours embeddings refreshed' });
    } catch (err: any) {
      toast({ title: 'Failed to refresh hours embeddings', description: err.message, variant: 'destructive' });
    } finally {
      setRefreshingHours(false);
    }
  }

  async function handleRefreshFulfillment() {
    setRefreshingFulfillment(true);
    try {
      await botService.refreshKnowledgeEmbeddings(tenantId, 'fulfillment');
      await queryClient.invalidateQueries({ queryKey: ['bot', 'embeddings-status', tenantId] });
      toast({ title: 'Fulfillment embeddings refreshed' });
    } catch (err: any) {
      toast({ title: 'Failed to refresh fulfillment embeddings', description: err.message, variant: 'destructive' });
    } finally {
      setRefreshingFulfillment(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Embedding Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* FAQ Embeddings */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">FAQ Embeddings</h3>
                  <p className="text-sm text-neutral-500">Powers RAG-based FAQ responses</p>
                </div>
                <Badge variant={status?.hasFaqEmbeddings ? 'success' : 'default'}>
                  {status?.hasFaqEmbeddings ? 'Ready' : 'Empty'}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshFaq}
                disabled={refreshingFaq}
              >
                {refreshingFaq ? 'Refreshing...' : 'Refresh FAQ Embeddings'}
              </Button>
            </div>

            {/* Product Embeddings */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Product Embeddings</h3>
                  <p className="text-sm text-neutral-500">Powers product catalog awareness in chat</p>
                </div>
                <Badge variant={status?.hasProductEmbeddings ? 'success' : 'default'}>
                  {status?.hasProductEmbeddings ? 'Ready' : 'Empty'}
                </Badge>
              </div>
              {status?.productTypeBreakdown && status.productTypeBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {status.productTypeBreakdown.map((pt) => (
                    <Badge key={pt.productType} variant="default">
                      {pt.productType}: {pt.count}
                    </Badge>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshProduct}
                disabled={refreshingProduct}
              >
                {refreshingProduct ? 'Refreshing...' : 'Refresh Product Embeddings'}
              </Button>
            </div>

            {/* Badge Registry Embeddings */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Badge Registry Embeddings</h3>
                  <p className="text-sm text-neutral-500">Lets bot explain badge meanings and store highlights</p>
                </div>
                <Badge variant={status?.hasBadgeRegistryEmbeddings ? 'success' : 'default'}>
                  {status?.hasBadgeRegistryEmbeddings ? 'Ready' : 'Empty'}
                </Badge>
              </div>
              {status?.knowledgeEmbeddingCounts
                ?.filter((c) => c.sourceType === 'badge_registry')
                .map((c) => (
                  <Badge key={c.sourceType} variant="default">
                    {c.count} badges embedded
                  </Badge>
                ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshBadgeRegistry}
                disabled={refreshingBadge}
              >
                {refreshingBadge ? 'Refreshing...' : 'Refresh Badge Embeddings'}
              </Button>
            </div>

            {/* Policy Embeddings */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Policy Embeddings</h3>
                  <p className="text-sm text-neutral-500">Lets bot answer return, shipping, and refund questions</p>
                </div>
                <Badge variant={status?.hasPolicyEmbeddings ? 'success' : 'default'}>
                  {status?.hasPolicyEmbeddings ? 'Ready' : 'Empty'}
                </Badge>
              </div>
              {status?.knowledgeEmbeddingCounts
                ?.filter((c) => c.sourceType === 'policy')
                .map((c) => (
                  <Badge key={c.sourceType} variant="default">
                    {c.count} policies embedded
                  </Badge>
                ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshPolicy}
                disabled={refreshingPolicy}
              >
                {refreshingPolicy ? 'Refreshing...' : 'Refresh Policy Embeddings'}
              </Button>
            </div>

            {/* Business Info Embeddings */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Business Info Embeddings</h3>
                  <p className="text-sm text-neutral-500">Lets bot answer store location, contact, and social questions</p>
                </div>
                <Badge variant={status?.hasBusinessInfoEmbeddings ? 'success' : 'default'}>
                  {status?.hasBusinessInfoEmbeddings ? 'Ready' : 'Empty'}
                </Badge>
              </div>
              {status?.knowledgeEmbeddingCounts
                ?.filter((c) => c.sourceType === 'business_info')
                .map((c) => (
                  <Badge key={c.sourceType} variant="default">
                    {c.count} info chunk{c.count !== 1 ? 's' : ''}
                  </Badge>
                ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshBusinessInfo}
                disabled={refreshingBizInfo}
              >
                {refreshingBizInfo ? 'Refreshing...' : 'Refresh Business Info'}
              </Button>
            </div>

            {/* Business Hours Embeddings */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Business Hours Embeddings</h3>
                  <p className="text-sm text-neutral-500">Lets bot answer hours, timezone, and holiday schedule questions</p>
                </div>
                <Badge variant={status?.hasHoursEmbeddings ? 'success' : 'default'}>
                  {status?.hasHoursEmbeddings ? 'Ready' : 'Empty'}
                </Badge>
              </div>
              {status?.knowledgeEmbeddingCounts
                ?.filter((c) => c.sourceType === 'hours')
                .map((c) => (
                  <Badge key={c.sourceType} variant="default">
                    {c.count} hours chunk{c.count !== 1 ? 's' : ''}
                  </Badge>
                ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshHours}
                disabled={refreshingHours}
              >
                {refreshingHours ? 'Refreshing...' : 'Refresh Hours Embeddings'}
              </Button>
            </div>

            {/* Fulfillment Settings Embeddings */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Fulfillment Embeddings</h3>
                  <p className="text-sm text-neutral-500">Lets bot answer pickup, delivery, and shipping questions</p>
                </div>
                <Badge variant={status?.hasFulfillmentEmbeddings ? 'success' : 'default'}>
                  {status?.hasFulfillmentEmbeddings ? 'Ready' : 'Empty'}
                </Badge>
              </div>
              {status?.knowledgeEmbeddingCounts
                ?.filter((c) => c.sourceType === 'fulfillment')
                .map((c) => (
                  <Badge key={c.sourceType} variant="default">
                    {c.count} fulfillment chunk{c.count !== 1 ? 's' : ''}
                  </Badge>
                ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshFulfillment}
                disabled={refreshingFulfillment}
              >
                {refreshingFulfillment ? 'Refreshing...' : 'Refresh Fulfillment Embeddings'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
            <p>
              <strong className="text-neutral-900 dark:text-neutral-100">FAQ Embeddings</strong> are generated from your
              FAQ entries. When a customer asks a question, the bot searches these embeddings to find the most relevant
              FAQ and uses it to generate a response.
            </p>
            <p>
              <strong className="text-neutral-900 dark:text-neutral-100">Product Embeddings</strong> are generated from
              your product catalog. They allow the bot to answer questions about products, prices, availability, and
              features.
            </p>
            <p>
              <strong className="text-neutral-900 dark:text-neutral-100">Badge Registry Embeddings</strong> are generated
              from your store's badge definitions (e.g. Sale, New Arrival, Eco-Friendly). They let the bot explain what
              your badges mean and answer questions like "what do you highlight?" without matching a specific product.
            </p>
            <p>
              <strong className="text-neutral-900 dark:text-neutral-100">Policy Embeddings</strong> are generated from
              your store policies (returns, shipping, refunds, privacy, terms). They let the bot answer policy questions
              semantically instead of relying on keyword matching.
            </p>
            <p>
              <strong className="text-neutral-900 dark:text-neutral-100">Business Info Embeddings</strong> are generated
              from your business profile (name, description, address, phone, email, website, social links). They let the
              bot answer questions like "where are you located?" or "what's your phone number?"
            </p>
            <p>
              <strong className="text-neutral-900 dark:text-neutral-100">Business Hours Embeddings</strong> are generated
              from your weekly schedule and special/holiday hours. They let the bot answer questions like "are you open?"
              or "what are your holiday hours?"
            </p>
            <p>
              <strong className="text-neutral-900 dark:text-neutral-100">Fulfillment Embeddings</strong> are generated
              from your fulfillment settings (pickup, delivery, shipping). They let the bot answer questions like "do you
              offer pickup?", "do you deliver?", or "how much is shipping?"
            </p>
            <p>
              Embeddings refresh automatically when you update badges, policies, business info, hours, or fulfillment
              settings. Use the buttons above to manually refresh after making changes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
