'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, ModalFooter, Button, Input } from '@/components/ui';

interface TaxonomyResult {
  id: string;
  name: string;
  path: string[];
  hasChildren?: boolean;
}

interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CategoryFormData) => Promise<void>;
  category?: {
    id: string;
    name: string;
    slug?: string;
    sortOrder?: number;
    googleCategoryId?: string;
    description?: string;
    iconEmoji?: string;
  } | null;
  isCreate?: boolean;
  title?: string;
  apiBaseUrl?: string;
}

export interface CategoryFormData {
  name: string;
  slug?: string;
  sortOrder: number;
  googleCategoryId: string;
  description?: string;
  iconEmoji?: string;
}

/**
 * Shared Category Edit Modal
 * Used by both admin and tenant category pages
 * Features:
 * - Name, slug, sort order, description, icon emoji fields
 * - Google taxonomy search with autocomplete
 * - Google taxonomy tree browser
 */
export function CategoryEditModal({
  isOpen,
  onClose,
  onSave,
  category,
  isCreate = false,
  title,
  apiBaseUrl = '',
}: CategoryEditModalProps) {
  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formSort, setFormSort] = useState(0);
  const [formGoogleId, setFormGoogleId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIconEmoji, setFormIconEmoji] = useState('📦');
  const [saving, setSaving] = useState(false);

  // Taxonomy search state
  const [taxQuery, setTaxQuery] = useState('');
  const [taxResults, setTaxResults] = useState<TaxonomyResult[]>([]);
  const [taxLoading, setTaxLoading] = useState(false);
  const [showTaxResults, setShowTaxResults] = useState(false);

  // Taxonomy browse state
  const [taxBrowseMode, setTaxBrowseMode] = useState(false);
  const [taxBrowseCategories, setTaxBrowseCategories] = useState<TaxonomyResult[]>([]);
  const [taxBrowsePath, setTaxBrowsePath] = useState<string[]>([]);
  const [taxBrowseLoading, setTaxBrowseLoading] = useState(false);
  
  // Current category path (fetched from API when editing)
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [currentPathLoading, setCurrentPathLoading] = useState(false);

  // Initialize form when category changes
  useEffect(() => {
    if (isOpen) {
      if (category && !isCreate) {
        setFormName(category.name || '');
        setFormSlug(category.slug || '');
        setFormSort(category.sortOrder || 0);
        setFormGoogleId(category.googleCategoryId || '');
        setFormDescription(category.description || '');
        setFormIconEmoji(category.iconEmoji || '📦');
        
        // Fetch current path if category has a Google ID
        if (category.googleCategoryId) {
          setCurrentPathLoading(true);
          // Use NEXT_PUBLIC_API_BASE_URL for public endpoint (not the passed apiBaseUrl which may be empty)
          const publicApiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
          fetch(`${publicApiBase}/public/google-taxonomy/${category.googleCategoryId}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data?.path) {
                const pathStr = Array.isArray(data.path) ? data.path.join(' > ') : data.path;
                setCurrentPath(pathStr);
              } else {
                setCurrentPath(null);
              }
            })
            .catch((err) => {
              console.error('Failed to fetch category path:', err);
              setCurrentPath(null);
            })
            .finally(() => setCurrentPathLoading(false));
        } else {
          setCurrentPath(null);
        }
      } else {
        setFormName('');
        setFormSlug('');
        setFormSort(0);
        setFormGoogleId('');
        setFormDescription('');
        setFormIconEmoji('📦');
        setCurrentPath(null);
      }
      setTaxQuery('');
      setTaxResults([]);
      setTaxBrowseMode(false);
    }
  }, [isOpen, category, isCreate, apiBaseUrl]);

  // Auto-generate slug from name
  useEffect(() => {
    if (isCreate && formName) {
      setFormSlug(formName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [formName, isCreate]);

  // Debounced taxonomy search
  useEffect(() => {
    if (!taxQuery.trim() || taxQuery.length < 2) {
      setTaxResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setTaxLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/taxonomy/search?q=${encodeURIComponent(taxQuery)}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          setTaxResults(data.results || data.data || []);
        }
      } catch (e) {
        console.error('Taxonomy search failed:', e);
      } finally {
        setTaxLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [taxQuery, apiBaseUrl]);

  // Load taxonomy browse categories
  const loadTaxBrowseCategories = useCallback(async (path: string[] = []) => {
    setTaxBrowseLoading(true);
    try {
      const pathParam = path.length > 0 ? `?path=${encodeURIComponent(path.join('/'))}` : '';
      const res = await fetch(`${apiBaseUrl}/api/taxonomy/browse${pathParam}`);
      if (res.ok) {
        const data = await res.json();
        setTaxBrowseCategories(data.categories || data.data || []);
      }
    } catch (e) {
      console.error('Taxonomy browse failed:', e);
    } finally {
      setTaxBrowseLoading(false);
    }
  }, [apiBaseUrl]);

  const navigateToPath = (path: string[]) => {
    setTaxBrowsePath(path);
    loadTaxBrowseCategories(path);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: formName.trim(),
        slug: formSlug.trim() || formName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        sortOrder: formSort,
        googleCategoryId: formGoogleId,
        description: formDescription.trim(),
        iconEmoji: formIconEmoji,
      });
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = title || (isCreate ? 'Create Category' : 'Edit Category');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      description={isCreate ? 'Add a new product category' : `Update ${category?.name || 'category'}`}
    >
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Name *</label>
          <input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Category name"
            className="w-full border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Slug (for create) */}
        {isCreate && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Slug</label>
            <input
              value={formSlug}
              onChange={(e) => setFormSlug(e.target.value)}
              placeholder="category-slug"
              className="w-full border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            />
            <p className="text-xs text-neutral-500 mt-1">Auto-generated from name. Used in URLs.</p>
          </div>
        )}

        {/* Sort Order */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Sort Order</label>
          <input
            type="number"
            value={formSort}
            onChange={(e) => setFormSort(Number(e.target.value))}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Icon Emoji */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Icon Emoji</label>
          <input
            value={formIconEmoji}
            onChange={(e) => setFormIconEmoji(e.target.value)}
            placeholder="📦"
            className="w-20 border border-neutral-300 rounded-md px-3 py-2 text-center text-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Brief description of this category"
            rows={2}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Google Category Alignment */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">Google Category</label>
          
          {/* Current path display (when editing) */}
          {!isCreate && category?.googleCategoryId && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="text-xs text-blue-700 font-medium mb-1">Current Google Category:</div>
              {currentPathLoading ? (
                <div className="text-sm text-blue-600 italic">Loading path...</div>
              ) : currentPath ? (
                <div className="text-sm text-blue-800 font-medium">{currentPath}</div>
              ) : (
                <div className="text-sm text-blue-800 font-mono">{category.googleCategoryId}</div>
              )}
              <div className="text-xs text-blue-500 mt-1 font-mono">ID: {category.googleCategoryId}</div>
            </div>
          )}
          
          <div className="space-y-3">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTaxBrowseMode(false)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  !taxBrowseMode 
                    ? 'bg-primary-100 text-primary-700 border-2 border-primary-500' 
                    : 'bg-neutral-100 text-neutral-600 border border-neutral-300 hover:bg-neutral-200'
                }`}
              >
                🔍 Search
              </button>
              <button
                type="button"
                onClick={() => { 
                  setTaxBrowseMode(true); 
                  if (taxBrowseCategories.length === 0) loadTaxBrowseCategories();
                }}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  taxBrowseMode 
                    ? 'bg-primary-100 text-primary-700 border-2 border-primary-500' 
                    : 'bg-neutral-100 text-neutral-600 border border-neutral-300 hover:bg-neutral-200'
                }`}
              >
                📂 Browse Tree
              </button>
            </div>

            {!taxBrowseMode ? (
              /* Search mode */
              <div className="relative">
                <input
                  placeholder="Search taxonomy by name (e.g. Electronics, Pizza)"
                  value={taxQuery}
                  onChange={(e) => { setTaxQuery(e.target.value); setShowTaxResults(true); }}
                  onFocus={() => setShowTaxResults(true)}
                  className="w-full border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {showTaxResults && (taxResults.length > 0 || taxLoading) && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-neutral-200 rounded-md shadow-lg max-h-64 overflow-auto">
                    {taxLoading && <div className="px-3 py-2 text-sm text-neutral-500">Searching...</div>}
                    {taxResults.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => { 
                          setFormGoogleId(r.id); 
                          setTaxQuery(r.path.join(' > ')); 
                          setShowTaxResults(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-neutral-50"
                      >
                        <div className="text-sm font-medium text-neutral-900">{r.name}</div>
                        <div className="text-xs text-neutral-600">{r.path.join(' > ')}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Browse mode */
              <div className="border border-neutral-200 rounded-md">
                {/* Breadcrumb */}
                <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-200 flex items-center gap-1 flex-wrap text-sm">
                  <button
                    type="button"
                    onClick={() => navigateToPath([])}
                    className="text-primary-600 hover:text-primary-800 font-medium"
                  >
                    Root
                  </button>
                  {taxBrowsePath.map((segment, idx) => (
                    <span key={idx} className="flex items-center gap-1">
                      <span className="text-neutral-400">&gt;</span>
                      <button
                        type="button"
                        onClick={() => navigateToPath(taxBrowsePath.slice(0, idx + 1))}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        {segment}
                      </button>
                    </span>
                  ))}
                </div>
                {/* Category list */}
                <div className="max-h-48 overflow-auto">
                  {taxBrowseLoading ? (
                    <div className="px-3 py-4 text-sm text-neutral-500 text-center">Loading categories...</div>
                  ) : taxBrowseCategories.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-neutral-500 text-center">No subcategories</div>
                  ) : (
                    taxBrowseCategories.map((cat) => (
                      <div key={cat.id} className="flex items-center border-b border-neutral-100 last:border-0">
                        <button
                          type="button"
                          onClick={() => { 
                            setFormGoogleId(cat.id); 
                            setTaxQuery(cat.path.join(' > '));
                          }}
                          className={`flex-1 text-left px-3 py-2 hover:bg-primary-50 ${
                            formGoogleId === cat.id ? 'bg-primary-100' : ''
                          }`}
                        >
                          <div className="text-sm font-medium text-neutral-900">{cat.name}</div>
                          <div className="text-xs text-neutral-500 font-mono">{cat.id}</div>
                        </button>
                        {cat.hasChildren && (
                          <button
                            type="button"
                            onClick={() => navigateToPath([...taxBrowsePath, cat.name])}
                            className="px-3 py-2 text-primary-600 hover:text-primary-800 hover:bg-primary-50"
                          >
                            →
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Selected Google Category Display */}
            {formGoogleId && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="text-xs text-green-700 font-medium mb-1">Selected Google Category:</div>
                {taxQuery ? (
                  <div className="text-sm text-green-800 font-medium">{taxQuery}</div>
                ) : (
                  <div className="text-sm text-green-800 font-mono">{formGoogleId}</div>
                )}
                <div className="text-xs text-green-500 mt-1 font-mono">ID: {formGoogleId}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSave} 
          disabled={!formName.trim() || saving}
        >
          {saving ? 'Saving...' : (isCreate ? 'Create Category' : 'Save Changes')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export default CategoryEditModal;
