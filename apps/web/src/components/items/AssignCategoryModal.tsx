'use client'

import { useState, useEffect } from 'react'
import { api, API_BASE_URL } from '@/lib/api'

type Category = {
  id: string
  name: string
  slug: string
  googleCategoryId: string | null
}

type TaxonomyResult = {
  id: string
  name: string
  path: string[]
}

export default function AssignCategoryModal({
  tenantId,
  itemId,
  itemName,
  currentCategory,
  onClose,
  onSave,
}: {
  tenantId: string
  itemId: string
  itemName: string
  currentCategory?: string
  onClose: () => void
  onSave: () => void
}) {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [catSearch, setCatSearch] = useState('')
  const [mappedOnly, setMappedOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(30)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [taxQuery, setTaxQuery] = useState('')
  const [taxResults, setTaxResults] = useState<TaxonomyResult[]>([])
  const [taxLoading, setTaxLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCategories() {
      try {
        const url = `${API_BASE_URL}/api/v1/tenants/${tenantId}/categories`;
        const res = await api.get(url)
        const data = await res.json()
        console.log('[AssignCategoryModal] Categories response:', data)
        if (data.success && Array.isArray(data.data)) {
          setCategories(data.data)
        } else {
          console.warn('[AssignCategoryModal] Unexpected response format:', data)
        }
      } catch (e) {
        console.error('[AssignCategoryModal] Failed to fetch categories:', e)
      }
    }
    if (tenantId) {
      fetchCategories()
    }
  }, [tenantId])

  // Load recent categories from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('recent_category_ids')
      if (raw) setRecentIds(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    if (!taxQuery || taxQuery.trim().length < 2) {
      setTaxResults([])
      return
    }
    let active = true
    const t = setTimeout(async () => {
      try {
        setTaxLoading(true)
        const res = await api.get(`categories/search?q=${encodeURIComponent(taxQuery)}&limit=8`)
        if (res.ok) {
          const data = await res.json()
          if (active) setTaxResults(data.results || [])
        }
      } finally {
        setTaxLoading(false)
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [taxQuery])

  async function handleSave() {
    if (!selectedCategoryId) {
      setError('Please select a category')
      return
    }
    try {
      setSaving(true)
      setError(null)
      const url = `${API_BASE_URL}/api/v1/tenants/${tenantId}/items/${itemId}/category`
      const res = await api.patch(url, { tenantCategoryId: selectedCategoryId })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to assign category')
      }
      // persist recent category
      try {
        const next = [selectedCategoryId, ...recentIds.filter(id => id !== selectedCategoryId)].slice(0, 8)
        setRecentIds(next)
        localStorage.setItem('recent_category_ids', JSON.stringify(next))
      } catch {}
      onSave()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Failed to assign category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h3 className="text-lg font-semibold">Assign Category</h3>
            <p className="text-sm text-gray-600 mt-1">{itemName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Tenant Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select from Your Categories</label>
            {/* Controls */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={catSearch}
                  onChange={(e) => { setCatSearch(e.target.value); setVisibleCount(30) }}
                  placeholder="Search by name or slug"
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
                  <input type="checkbox" checked={mappedOnly} onChange={(e) => { setMappedOnly(e.target.checked); setVisibleCount(30) }} />
                  Mapped only
                </label>
              </div>
            )}
            {categories.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-yellow-900 mb-1">No Categories Found</h4>
                    <p className="text-sm text-yellow-800 mb-3">You need to create at least one category before you can assign items to it.</p>
                    <a
                      href={`/t/${tenantId}/categories`}
                      target="_blank"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Your First Category
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto border border-gray-200 rounded-md p-2">
                {/* Recent */}
                {recentIds.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500 px-1 mb-1">Recent</div>
                    {categories.filter(c => recentIds.includes(c.id)).map((cat) => (
                      <button
                        key={`recent-${cat.id}`}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={[
                          'w-full text-left px-3 py-2 rounded-md transition-colors mb-1',
                          selectedCategoryId === cat.id ? 'bg-blue-50 border-2 border-blue-500' : 'bg-white border border-gray-200 hover:bg-gray-50',
                        ].join(' ')}
                      >
                        <div className="font-medium text-gray-900">{cat.name}</div>
                        <div className="text-xs text-gray-600">Slug: {cat.slug}</div>
                        {cat.googleCategoryId && (
                          <div className="text-xs text-green-600 mt-1">✓ Mapped to Google: {cat.googleCategoryId}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {/* Filtered list */}
                {categories
                  .filter((cat) => {
                    if (mappedOnly && !cat.googleCategoryId) return false
                    const q = catSearch.trim().toLowerCase()
                    if (!q) return true
                    return (
                      cat.name.toLowerCase().includes(q) ||
                      cat.slug.toLowerCase().includes(q)
                    )
                  })
                  .slice(0, visibleCount)
                  .map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={[
                      'w-full text-left px-3 py-2 rounded-md transition-colors',
                      selectedCategoryId === cat.id ? 'bg-blue-50 border-2 border-blue-500' : 'bg-white border border-gray-200 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    <div className="font-medium text-gray-900">{cat.name}</div>
                    <div className="text-xs text-gray-600">Slug: {cat.slug}</div>
                    {cat.googleCategoryId && (
                      <div className="text-xs text-green-600 mt-1">✓ Mapped to Google: {cat.googleCategoryId}</div>
                    )}
                  </button>
                ))}
                {/* Show More */}
                {categories.filter((cat) => {
                  if (mappedOnly && !cat.googleCategoryId) return false
                  const q = catSearch.trim().toLowerCase()
                  if (!q) return true
                  return cat.name.toLowerCase().includes(q) || cat.slug.toLowerCase().includes(q)
                }).length > visibleCount && (
                  <div className="flex justify-center mt-2">
                    <button
                      onClick={() => setVisibleCount((c) => c + 30)}
                      className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                    >
                      Show more
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Taxonomy Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Or Search Google Taxonomy</label>
            <input
              placeholder="Type to search (e.g. Electronics)"
              value={taxQuery}
              onChange={(e) => setTaxQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {taxLoading && <p className="text-sm text-gray-500 mt-2">Searching...</p>}
            {taxResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-md max-h-48 overflow-auto">
                {taxResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setTaxQuery(r.path.join(' > '))
                      setTaxResults([])
                      // Note: this doesn't auto-create a tenant category; user must pick from existing or create manually
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <div className="text-sm font-medium text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-600">{r.path.join(' > ')}</div>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-xs text-gray-700">
                <strong>💡 Tip:</strong> Don't see the right category for this product? Visit the{' '}
                <a
                  href={`/t/${tenantId}/categories`}
                  target="_blank"
                  className="text-blue-600 hover:text-blue-700 underline font-medium"
                >
                  Categories page
                </a>
                {' '}to create and align a new category first, then return here to assign it.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={saving || !selectedCategoryId}
          >
            {saving ? 'Saving...' : 'Assign Category'}
          </button>
        </div>
      </div>
    </div>
  )
}
