'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import {
  HelpCircle,
  Store,
  Package,
  FileText,
  Plus,
  Search,
  Trash2,
  Edit3,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Upload,
  BarChart3,
  MessageSquare,
  Settings2,
  Tag,
  Archive,
  Eye,
  GripVertical,
} from 'lucide-react';
import Link from 'next/link';
import { faqService, FaqItem, FaqCategory } from '@/services/FaqService';
import { tenantStorefrontService, StorefrontProduct } from '@/services/TenantStorefrontService';
import { useFaqOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import FaqDialog from './FaqDialog';
import CategoryManager from './CategoryManager';
import FaqImportWizard from './FaqImportWizard';
import FaqBotPreview from './FaqBotPreview';
import FaqGapReport from './FaqGapReport';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FaqHubProps {
  tenantId: string;
}

type TabKey = 'storefront' | 'product' | 'templates' | 'import' | 'bot_preview' | 'gap_report';

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
    case 'draft':
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Draft</Badge>;
    case 'archived':
      return <Badge className="bg-neutral-100 text-neutral-600 hover:bg-neutral-100">Archived</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

export default function FaqHub({ tenantId }: FaqHubProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('storefront');
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [categories, setCategories] = useState<FaqCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [dialogScope, setDialogScope] = useState<'storefront' | 'product'>('storefront');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const askConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmState({ open: true, title, description, onConfirm });
  };

  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const { data: faqCap, loading: capLoading } = useFaqOptionsCapability(tenantId, { forTenant: true });

  // Merchant gate settings (tier-filtered merchant preferences)
  const [merchantSettings, setMerchantSettings] = useState<Record<string, boolean>>({});
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    faqService.getOptions(tenantId)
      .then(({ settings }) => setMerchantSettings(settings))
      .catch(() => setMerchantSettings({}))
      .finally(() => setSettingsLoading(false));
  }, [tenantId]);

  const canManageFaq = merchantSettings.faq_enabled ?? true;

  const tabDefs: { key: TabKey; label: string; icon: React.ReactNode; gate: boolean }[] = [
    { key: 'storefront', label: 'Storefront', icon: <Store className="w-4 h-4" />, gate: merchantSettings.faq_storefront_enabled ?? true },
    { key: 'product', label: 'Product', icon: <Package className="w-4 h-4" />, gate: merchantSettings.faq_product_enabled ?? true },
    { key: 'templates', label: 'Templates', icon: <FileText className="w-4 h-4" />, gate: merchantSettings.faq_templates_enabled ?? true },
    { key: 'import', label: 'Import', icon: <Upload className="w-4 h-4" />, gate: merchantSettings.faq_management_import ?? true },
    { key: 'bot_preview', label: 'Bot Preview', icon: <MessageSquare className="w-4 h-4" />, gate: merchantSettings.faq_chatbot_knowledge_base ?? false },
    { key: 'gap_report', label: 'Gap Report', icon: <BarChart3 className="w-4 h-4" />, gate: merchantSettings.faq_chatbot_knowledge_base ?? false },
  ];

  const visibleTabs = tabDefs.filter((t) => t.gate);

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const scopeFilter = activeTab === 'storefront' || activeTab === 'product' ? activeTab : undefined;
      const [faqList, catList] = await Promise.all([
        scopeFilter ? faqService.listFAQs(tenantId, { scope: scopeFilter }) : faqService.listFAQs(tenantId),
        faqService.listCategories(tenantId),
      ]);
      setFaqs(faqList);
      setCategories(catList);
    } catch (err: any) {
      setError(err?.message || 'Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  }, [tenantId, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredFaqs = faqs.filter((f) => {
    const matchesSearch =
      !searchQuery ||
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || f.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    setSelectedIds(new Set());
    setShowCategoryManager(false);
  }, [activeTab]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredFaqs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFaqs.map((f) => f.id)));
    }
  };

  const handleBulkDelete = async () => {
    askConfirm(
      'Delete selected FAQs',
      `Are you sure you want to delete ${selectedIds.size} selected FAQ${selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.`,
      async () => {
        setBulkActionLoading(true);
        try {
          const ids = Array.from(selectedIds);
          const deleted = await faqService.bulkDelete(tenantId, ids);
          setSelectedIds(new Set());
          fetchData();
        } catch (err: any) {
          setError(err?.message || 'Bulk delete failed');
        } finally {
          setBulkActionLoading(false);
        }
      }
    );
  };

  const handleBulkStatus = async (status: 'active' | 'draft' | 'archived') => {
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await faqService.bulkUpdateStatus(tenantId, ids, status);
      setSelectedIds(new Set());
      fetchData();
    } catch (err: any) {
      setError(err?.message || 'Bulk status update failed');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkCategory = async (categoryId: string) => {
    setBulkActionLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => faqService.updateFAQ(tenantId, id, { category_id: categoryId }))
      );
      setSelectedIds(new Set());
      fetchData();
    } catch (err: any) {
      setError(err?.message || 'Bulk category update failed');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const openCreate = (scope: 'storefront' | 'product') => {
    setEditingFaq(null);
    setDialogScope(scope);
    setDialogOpen(true);
  };

  const openEdit = (faq: FaqItem) => {
    setEditingFaq(faq);
    setDialogScope(faq.scope as 'storefront' | 'product');
    setDialogOpen(true);
  };

  const handleDelete = async (faq: FaqItem) => {
    askConfirm(
      'Delete FAQ',
      `Are you sure you want to delete "${faq.question}"? This action cannot be undone.`,
      async () => {
        try {
          await faqService.deleteFAQ(tenantId, faq.id);
          fetchData();
        } catch (err: any) {
          setError(err?.message || 'Delete failed');
        }
      }
    );
  };

  const handleStatusToggle = async (faq: FaqItem) => {
    const next = faq.status === 'active' ? 'draft' : 'active';
    try {
      await faqService.updateFAQ(tenantId, faq.id, { status: next });
      fetchData();
    } catch (err: any) {
      setError(err?.message || 'Status update failed');
    }
  };

  const handleDrop = async (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const reordered = [...filteredFaqs];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setDragIdx(null);
    setDragOverIdx(null);
    try {
      await faqService.reorderFAQs(
        tenantId,
        reordered.map((faq, i) => ({ id: faq.id, display_order: i }))
      );
      fetchData();
    } catch (err: any) {
      setError(err?.message || 'Reorder failed');
    }
  };

  const renderActionPane = () => {
    if (!canManageFaq) return null;

    switch (activeTab) {
      case 'storefront':
      case 'product':
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => openCreate(activeTab)}>
              <Plus className="w-3.5 h-3.5" />
              Add FAQ
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowCategoryManager((v) => !v)}>
              <Tag className="w-3.5 h-3.5" />
              {showCategoryManager ? 'Hide Categories' : 'Manage Categories'}
            </Button>
            {selectedIds.size > 0 && (
              <>
                <div className="h-6 w-px bg-neutral-200 mx-1" />
                <span className="text-sm text-neutral-500">{selectedIds.size} selected</span>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleBulkStatus('active')} disabled={bulkActionLoading}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Activate
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleBulkStatus('archived')} disabled={bulkActionLoading}>
                  <Archive className="w-3.5 h-3.5" /> Archive
                </Button>
                <select
                  className="h-8 px-2 rounded-md border border-neutral-200 bg-white text-xs"
                  onChange={(e) => e.target.value && handleBulkCategory(e.target.value)}
                  disabled={bulkActionLoading}
                  value=""
                >
                  <option value="">Move to category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleBulkDelete} disabled={bulkActionLoading}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </>
            )}
          </div>
        );
      case 'templates':
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">Browse and apply pre-built FAQ templates</span>
          </div>
        );
      case 'import':
        return (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload CSV
            </Button>
            <span className="text-sm text-neutral-500">Import FAQs from a CSV file</span>
          </div>
        );
      case 'bot_preview':
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">Test how your bot answers customer questions</span>
          </div>
        );
      case 'gap_report':
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">Review unanswered customer queries</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-blue-600" />
            FAQ Hub
          </h1>
          <p className="text-neutral-500 mt-1">
            Manage frequently asked questions for your storefront and products
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/t/${tenantId}/faq/options`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Options
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <div className="flex gap-1 flex-wrap">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Action Pane */}
      {canManageFaq && renderActionPane()}

      {/* Category Manager */}
      {showCategoryManager && (
        <CategoryManager tenantId={tenantId} categories={categories} onChange={fetchData} />
      )}

      {/* Search + Category Pills (Storefront / Product only) */}
      {(activeTab === 'storefront' || activeTab === 'product') && (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {loading || capLoading ? (
        <SkeletonList />
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-600">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : activeTab === 'templates' ? (
        <FaqTemplatesTab tenantId={tenantId} canManage={canManageFaq} />
      ) : activeTab === 'import' ? (
        <FaqImportWizard tenantId={tenantId} categories={categories} onComplete={fetchData} onCancel={() => setActiveTab('storefront')} />
      ) : activeTab === 'bot_preview' ? (
        <FaqBotPreview tenantId={tenantId} />
      ) : activeTab === 'gap_report' ? (
        <FaqGapReport tenantId={tenantId} onCreateFaq={(q) => { setDialogScope('storefront'); setEditingFaq(null); setDialogOpen(true); }} />
      ) : activeTab === 'product' ? (
        <FaqProductTab
          tenantId={tenantId}
          faqs={filteredFaqs}
          canManage={canManageFaq}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onEdit={openEdit}
          onDelete={handleDelete}
          onStatusToggle={handleStatusToggle}
          onRefresh={fetchData}
          onAddProductFaq={() => openCreate('product')}
        />
      ) : filteredFaqs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <HelpCircle className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">
              {searchQuery ? 'No FAQs match your search' : 'No FAQs yet. Add your first FAQ to get started.'}
            </p>
            {canManageFaq && (
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => openCreate('storefront')}>
                <Plus className="w-3.5 h-3.5" /> Add FAQ
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Bulk select header */}
          {canManageFaq && filteredFaqs.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                checked={selectedIds.size === filteredFaqs.length && filteredFaqs.length > 0}
                onChange={selectAll}
                className="rounded border-neutral-300"
              />
              <span className="text-xs text-neutral-500">Select all</span>
            </div>
          )}
          {filteredFaqs.map((faq, idx) => (
            <div
              key={faq.id}
              draggable={canManageFaq}
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
              onDragEnter={() => setDragOverIdx(idx)}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              className={dragOverIdx === idx && dragIdx !== null && dragIdx !== idx ? 'ring-2 ring-blue-400 rounded-lg' : ''}
            >
              <FaqCard
                faq={faq}
                canManage={canManageFaq}
                selected={selectedIds.has(faq.id)}
                onToggleSelect={() => toggleSelect(faq.id)}
                onEdit={() => openEdit(faq)}
                onDelete={() => handleDelete(faq)}
                onStatusToggle={() => handleStatusToggle(faq)}
                draggable={canManageFaq}
              />
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <FaqDialog
        tenantId={tenantId}
        categories={categories}
        faq={editingFaq}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={fetchData}
        defaultScope={dialogScope}
      />

      {/* Confirm Dialog */}
      <AlertDialog open={confirmState.open} onOpenChange={(v) => !v && setConfirmState((s) => ({ ...s, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmState.onConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FaqCard({
  faq,
  canManage,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  onStatusToggle,
  draggable,
}: {
  faq: FaqItem;
  canManage: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusToggle: () => void;
  draggable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {draggable && (
            <div className="mt-1 cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-500">
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          {canManage && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="mt-1 rounded border-neutral-300"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {getStatusBadge(faq.status)}
              {faq.category && (
                <Badge variant="outline" className="text-xs">
                  {faq.category.name}
                </Badge>
              )}
              {faq.scope === 'product' && (
                <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
                  Product
                </Badge>
              )}
              {faq.tags?.map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
                  {tag}
                </span>
              ))}
            </div>
            <h3 className="font-medium text-neutral-900">{faq.question}</h3>
            {expanded && (
              <div className="mt-3 text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 pt-3 whitespace-pre-wrap">
                {faq.answer}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-400"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {canManage && (
              <>
                <button
                  onClick={onStatusToggle}
                  className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-400"
                  title={faq.status === 'active' ? 'Deactivate' : 'Activate'}
                >
                  {faq.status === 'active' ? <Eye className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-400"
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-md hover:bg-red-50 text-red-400"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-neutral-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton variant="text" width="60px" />
            <Skeleton variant="text" width="80px" />
          </div>
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="40%" />
        </div>
      ))}
    </div>
  );
}

function FaqTemplatesTab({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyTemplate, setApplyTemplate] = useState<any | null>(null);
  const [selectedPairs, setSelectedPairs] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    faqService
      .listTemplates(tenantId)
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, [tenantId]);

  const openApplyDialog = (template: any) => {
    setApplyTemplate(template);
    const allIndices = (template.pairs || []).map((_: any, i: number) => i);
    setSelectedPairs(new Set(allIndices));
  };

  const togglePair = (index: number) => {
    setSelectedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleApply = async () => {
    if (!applyTemplate) return;
    setApplying(true);
    try {
      const result = await faqService.applyTemplate(
        tenantId,
        applyTemplate.id,
        Array.from(selectedPairs)
      );
      setApplyTemplate(null);
      setSelectedPairs(new Set());
    } catch (err: any) {
      console.error('Failed to apply template:', err);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">No templates available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{template.name}</CardTitle>
              {template.description && (
                <p className="text-sm text-neutral-500">{template.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-sm text-neutral-600 mb-4">
                {template.pairs?.length || 0} Q&A pairs
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={!canManage}
                onClick={() => openApplyDialog(template)}
              >
                Apply Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pair Selection Dialog */}
      {applyTemplate && (
        <Dialog open={!!applyTemplate} onOpenChange={(v: boolean) => !v && setApplyTemplate(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Apply: {applyTemplate.name}
              </DialogTitle>
            </DialogHeader>

            <p className="text-sm text-neutral-500 mb-3">
              Select which Q&A pairs to create as draft FAQs. Duplicates will be skipped.
            </p>

            <div className="space-y-2">
              {(applyTemplate.pairs || []).map((pair: any, index: number) => (
                <label
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPairs.has(index)
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPairs.has(index)}
                    onChange={() => togglePair(index)}
                    className="mt-0.5 rounded border-neutral-300"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{pair.question}</p>
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{pair.answer}</p>
                  </div>
                </label>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setApplyTemplate(null)} disabled={applying}>
                Cancel
              </Button>
              <Button onClick={handleApply} disabled={applying || selectedPairs.size === 0} className="gap-2">
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {applying ? 'Applying...' : `Apply ${selectedPairs.size} pair${selectedPairs.size !== 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function FaqProductTab({
  tenantId,
  faqs,
  canManage,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  onStatusToggle,
  onRefresh,
  onAddProductFaq,
}: {
  tenantId: string;
  faqs: FaqItem[];
  canManage: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onEdit: (faq: FaqItem) => void;
  onDelete: (faq: FaqItem) => void;
  onStatusToggle: (faq: FaqItem) => void;
  onRefresh: () => void;
  onAddProductFaq: (productId?: string) => void;
}) {
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [products, setProducts] = useState<StorefrontProduct[]>([]);

  useEffect(() => {
    tenantStorefrontService
      .getStorefrontProducts(tenantId, { limit: 100, sortBy: 'name', sortOrder: 'asc' })
      .then((res) => setProducts(res.items || []))
      .catch(() => setProducts([]));
  }, [tenantId]);

  const productFiltered = selectedProduct
    ? faqs.filter((f) => f.product_links?.some((p: any) => p.product_id === selectedProduct))
    : faqs;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-neutral-700">Product:</label>
        <select
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
          className="h-9 px-3 rounded-md border border-neutral-200 bg-white text-sm min-w-[200px]"
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {canManage && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onAddProductFaq(selectedProduct || undefined)}>
            <Plus className="w-3.5 h-3.5" /> Add Product FAQ
          </Button>
        )}
      </div>

      {productFiltered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">
              {selectedProduct ? 'No FAQs for this product yet.' : 'No product FAQs yet. Select a product to get started.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {canManage && productFiltered.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                checked={productFiltered.length > 0 && productFiltered.every((f) => selectedIds.has(f.id))}
                onChange={() => {
                  if (productFiltered.every((f) => selectedIds.has(f.id))) {
                    productFiltered.forEach((f) => onToggleSelect(f.id));
                  } else {
                    productFiltered.forEach((f) => { if (!selectedIds.has(f.id)) onToggleSelect(f.id); });
                  }
                }}
                className="rounded border-neutral-300"
              />
              <span className="text-xs text-neutral-500">Select all</span>
            </div>
          )}
          {productFiltered.map((faq) => (
            <FaqCard
              key={faq.id}
              faq={faq}
              canManage={canManage}
              selected={selectedIds.has(faq.id)}
              onToggleSelect={() => onToggleSelect(faq.id)}
              onEdit={() => onEdit(faq)}
              onDelete={() => onDelete(faq)}
              onStatusToggle={() => onStatusToggle(faq)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FaqImportPlaceholder() {
  return (
    <Card>
      <CardContent className="py-16 text-center space-y-4">
        <Upload className="w-12 h-12 text-neutral-300 mx-auto" />
        <div>
          <h3 className="text-lg font-medium text-neutral-900">Import FAQs</h3>
          <p className="text-neutral-500 mt-1 max-w-md mx-auto">
            Upload a CSV file to bulk import FAQs. Map columns, preview rows, and import in one go.
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Upload className="w-3.5 h-3.5" /> Upload CSV
        </Button>
      </CardContent>
    </Card>
  );
}

function FaqBotPreviewPlaceholder() {
  return (
    <Card>
      <CardContent className="py-16 text-center space-y-4">
        <MessageSquare className="w-12 h-12 text-neutral-300 mx-auto" />
        <div>
          <h3 className="text-lg font-medium text-neutral-900">Bot Preview</h3>
          <p className="text-neutral-500 mt-1 max-w-md mx-auto">
            Test how your chatbot answers questions using your FAQ knowledge base. See matched results and confidence scores.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function FaqGapReportPlaceholder() {
  return (
    <Card>
      <CardContent className="py-16 text-center space-y-4">
        <BarChart3 className="w-12 h-12 text-neutral-300 mx-auto" />
        <div>
          <h3 className="text-lg font-medium text-neutral-900">Gap Report</h3>
          <p className="text-neutral-500 mt-1 max-w-md mx-auto">
            Review unanswered customer queries surfaced from bot interactions. Create new FAQs to close coverage gaps.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
