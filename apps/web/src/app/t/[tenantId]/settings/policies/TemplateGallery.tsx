'use client';

import { useState, useEffect, useMemo } from 'react';
import { policyTemplateService, PolicyTemplate, TemplateGroup } from '@/services/PolicyTemplateService';
import TemplatePreviewModal from './TemplatePreviewModal';

interface TemplateGalleryProps {
  tenantId: string;
  effectiveStorefrontType?: string;
  policyTypeFilter?: string;
  onApplied?: (policyType: string) => void;
}

const STOREFRONT_TABS = ['all', 'online', 'retail', 'service', 'social'];
const TAB_LABELS: Record<string, string> = {
  all: 'Universal',
  online: 'Online',
  retail: 'Retail',
  service: 'Service',
  social: 'Social',
};

export default function TemplateGallery({
  tenantId,
  effectiveStorefrontType,
  policyTypeFilter,
  onApplied,
}: TemplateGalleryProps) {
  const [groups, setGroups] = useState<TemplateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStorefrontTab, setActiveStorefrontTab] = useState<string>('all');
  const [previewTemplate, setPreviewTemplate] = useState<PolicyTemplate | null>(null);
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (effectiveStorefrontType && effectiveStorefrontType !== 'all') {
      setActiveStorefrontTab(effectiveStorefrontType);
    }
  }, [effectiveStorefrontType]);

  useEffect(() => {
    fetchTemplates();
  }, [tenantId]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await policyTemplateService.getTemplatesGrouped(tenantId);
      setGroups(data);
      policyTemplateService.getRecommendedTemplates(tenantId).then(recs => {
        setRecommendedIds(new Set(recs.map(r => r.template?.id).filter(Boolean) as string[]));
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const allTemplates = useMemo(() => {
    return groups.flatMap(g => g.templates);
  }, [groups]);

  const filteredTemplates = useMemo(() => {
    let templates = activeStorefrontTab === 'all'
      ? allTemplates.filter(t => t.storefrontType === 'all')
      : allTemplates.filter(t => t.storefrontType === activeStorefrontTab || t.storefrontType === 'all');

    if (policyTypeFilter) {
      templates = templates.filter(t => t.policyType === policyTypeFilter);
    }

    return templates.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [allTemplates, activeStorefrontTab, policyTypeFilter]);

  const templatesByPolicyType = useMemo(() => {
    const map: Record<string, PolicyTemplate[]> = {};
    for (const t of filteredTemplates) {
      if (!map[t.policyType]) map[t.policyType] = [];
      map[t.policyType].push(t);
    }
    return map;
  }, [filteredTemplates]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of allTemplates) {
      if (t.storefrontType === 'all') {
        counts['all'] = (counts['all'] || 0) + 1;
      }
      counts[t.storefrontType] = (counts[t.storefrontType] || 0) + 1;
    }
    return counts;
  }, [allTemplates]);

  const recommendedGroup = groups.find(g => g.recommended);
  const recommendedStorefrontType = recommendedGroup?.storefrontType;

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-neutral-200 rounded"></div>
        <div className="h-48 bg-neutral-200 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Storefront type tabs */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
        {STOREFRONT_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveStorefrontTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeStorefrontTab === tab
                ? 'bg-blue-500 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            {TAB_LABELS[tab]} ({tabCounts[tab] || 0})
            {tab === recommendedStorefrontType && tab !== 'all' && (
              <span className="ml-1.5 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                Recommended
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Templates grouped by policy type */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-12 text-neutral-500 text-sm">
          No templates available for this storefront type{policyTypeFilter ? ' and policy type' : ''}.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(templatesByPolicyType).map(([policyType, templates]) => (
            <div key={policyType}>
              <h3 className="text-sm font-semibold text-neutral-700 mb-2 capitalize">
                {policyType.replace(/_/g, ' ')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onPreview={() => setPreviewTemplate(template)}
                    isRecommended={recommendedIds.has(template.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          tenantId={tenantId}
          onClose={() => setPreviewTemplate(null)}
          onApplied={(policyType) => {
            setPreviewTemplate(null);
            onApplied?.(policyType);
          }}
        />
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onPreview,
  isRecommended,
}: {
  template: PolicyTemplate;
  onPreview: () => void;
  isRecommended?: boolean;
}) {
  return (
    <div className="border border-neutral-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer" onClick={onPreview}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-neutral-900 text-sm">{template.title}</h4>
        <div className="flex gap-1 shrink-0">
          {isRecommended && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
              AI-Suggested
            </span>
          )}
          {template.jurisdiction !== 'GLOBAL' && (
            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
              {template.jurisdiction}
            </span>
          )}
        </div>
      </div>
      {template.description && (
        <p className="text-xs text-neutral-600 line-clamp-2 mb-3">{template.description}</p>
      )}
      <div className="flex flex-wrap gap-1 mb-3">
        {template.complianceTags.slice(0, 3).map(tag => (
          <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
            {tag}
          </span>
        ))}
        {template.complianceTags.length > 3 && (
          <span className="text-xs text-neutral-400">+{template.complianceTags.length - 3} more</span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-400">
          {template.platform !== 'generic' && `${template.platform} · `}
          v{template.version}
        </span>
        <span className="text-xs text-blue-600 font-medium">Preview →</span>
      </div>
      {template.fulfillmentMode !== 'all' && (
        <div className="mt-2">
          <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded capitalize">
            {template.fulfillmentMode}
          </span>
        </div>
      )}
    </div>
  );
}
