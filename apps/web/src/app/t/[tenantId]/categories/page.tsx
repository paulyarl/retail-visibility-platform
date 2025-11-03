'use client'

import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { api, API_BASE_URL } from '@/lib/api'

interface Category {
  id: string
  name: string
  slug: string
  googleCategoryId: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface AlignmentStatus {
  total: number
  mapped: number
  unmapped: number
  mappingCoverage: number
  isCompliant: boolean
  status: string
}

export default function CategoriesPage() {
  const params = useParams()
  const tenantId = params.tenantId as string

  const [categories, setCategories] = useState<Category[]>([])
  const [alignmentStatus, setAlignmentStatus] = useState<AlignmentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selected, setSelected] = useState<Category | null>(null)
  const [formName, setFormName] = useState('')
  const [formSort, setFormSort] = useState<number>(0)
  const [formGoogleId, setFormGoogleId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [isCreate, setIsCreate] = useState(false)

  // Taxonomy search state
  const [taxQuery, setTaxQuery] = useState('')
  const [taxResults, setTaxResults] = useState<Array<{ id: string; name: string; path: string[] }>>([])
  const [taxLoading, setTaxLoading] = useState(false)
  const [showTaxResults, setShowTaxResults] = useState(false)

  // Toasts
  const [toast, setToast] = useState<{ type: 'success'|'error'|'info'; message: string } | null>(null)
  const showToast = (type: 'success'|'error'|'info', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        
        // Fetch categories
        const catRes = await api.get(`${API_BASE_URL}/api/v1/tenants/${tenantId}/categories`)
        if (!catRes.ok) throw new Error('Failed to fetch categories')
        const catData = await catRes.json()
        setCategories(catData.data || [])

        // Fetch alignment status
        const statusRes = await api.get(`${API_BASE_URL}/api/v1/tenants/${tenantId}/categories-alignment-status`)
        if (!statusRes.ok) throw new Error('Failed to fetch alignment status')
        const statusData = await statusRes.json()
        setAlignmentStatus(statusData.data)

        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    if (tenantId) {
      fetchData()
    }
  }, [tenantId])

  function openEdit(cat: Category) {
    setSelected(cat)
    setFormName(cat.name)
    setFormSort(cat.sortOrder)
    setFormGoogleId(cat.googleCategoryId || '')
    setTaxQuery('')
    setTaxResults([])
    setIsCreate(false)
    setIsModalOpen(true)
  }

  function openCreate() {
    setSelected(null)
    setFormName('')
    setFormSort(0)
    setFormGoogleId('')
    setTaxQuery('')
    setTaxResults([])
    setIsCreate(true)
    setIsModalOpen(true)
  }

  async function saveEdit() {
    try {
      setSaving(true)
      if (isCreate || !selected) {
        // Create
        const postRes = await api.post(`${API_BASE_URL}/api/v1/tenants/${tenantId}/categories`, { name: formName, slug: formName.toLowerCase().replace(/\s+/g, '-'), sortOrder: formSort })
        if (!postRes.ok) throw new Error('Failed to create category')
        const created = await postRes.json()
        // Align if provided
        if (formGoogleId) {
          const alignRes = await api.post(`${API_BASE_URL}/api/v1/tenants/${tenantId}/categories/${created.data.id}/align`, { googleCategoryId: formGoogleId })
          if (!alignRes.ok) throw new Error('Failed to align category')
        }
        showToast('success', 'Category created')
      } else {
        // Update core fields
        const putRes = await api.put(`${API_BASE_URL}/api/v1/tenants/${tenantId}/categories/${selected.id}`, { name: formName, sortOrder: formSort })
        if (!putRes.ok) throw new Error('Failed to update category')

        // Align if a googleCategoryId is provided
        if (formGoogleId && formGoogleId !== (selected.googleCategoryId || '')) {
          const alignRes = await api.post(`${API_BASE_URL}/api/v1/tenants/${tenantId}/categories/${selected.id}/align`, { googleCategoryId: formGoogleId })
          if (!alignRes.ok) throw new Error('Failed to align category')
        }
        showToast('success', 'Changes saved')
      }

      // Refresh data
      const [catRes, statusRes] = await Promise.all([
        api.get(`${API_BASE_URL}/api/v1/tenants/${tenantId}/categories`),
        api.get(`${API_BASE_URL}/api/v1/tenants/${tenantId}/categories-alignment-status`)
      ])
      const catData = await catRes.json()
      const statusData = await statusRes.json()
      setCategories(catData.data || [])
      setAlignmentStatus(statusData.data)

      setIsModalOpen(false)
      setSelected(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to save changes')
      showToast('error', e?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCategory(cat: Category) {
    if (!confirm(`Delete category "${cat.name}"? This is a soft delete and may be blocked if it has dependencies.`)) return
    try {
      const res = await api.delete(`${API_BASE_URL}/api/v1/tenants/${tenantId}/categories/${cat.id}`)
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || 'Failed to delete category')
      }
      // Refresh
      const [catRes, statusRes] = await Promise.all([
        api.get(`${API_BASE_URL}/api/v1/tenants/${tenantId}/categories`),
        api.get(`${API_BASE_URL}/api/v1/tenants/${tenantId}/categories-alignment-status`)
      ])
      const catData = await catRes.json()
      const statusData = await statusRes.json()
      setCategories(catData.data || [])
      setAlignmentStatus(statusData.data)
      showToast('success', 'Category deleted')
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete category')
    }
  }

  // Debounced taxonomy search
  useEffect(() => {
    if (!taxQuery || taxQuery.trim().length < 2) { setTaxResults([]); return }
    let active = true
    const t = setTimeout(async () => {
      try {
        setTaxLoading(true)
        const res = await api.get(`${API_BASE_URL}/categories/search?q=${encodeURIComponent(taxQuery)}&limit=8`)
        if (res.ok) {
          const data = await res.json()
          if (active) setTaxResults(data.results || [])
        }
      } finally {
        setTaxLoading(false)
      }
    }, 300)
    return () => { active = false; clearTimeout(t) }
  }, [taxQuery])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Category Management</h1>
        <div className="flex items-center gap-3">
          <p className="text-gray-600">Manage your product categories and align them with Google taxonomy</p>
          {alignmentStatus && (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${alignmentStatus.mappingCoverage === 100 ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}
              title={`Mapped ${alignmentStatus.mapped}/${alignmentStatus.total}`}
            >
              Mapping Coverage: {alignmentStatus.mappingCoverage}%
            </span>
          )}
        </div>
      </div>

      {/* Helpful Reminder */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">💡 Why create categories here?</h4>
            <p className="text-sm text-blue-800">
              Categories help organize your products and improve feed quality for Google Merchant Center. 
              Create categories here, align them to Google's taxonomy, then assign them to your products on the{' '}
              <a href={`/t/${tenantId}/items`} className="underline font-medium hover:text-blue-900">
                Items page
              </a>
              . Well-categorized products perform better in search results and shopping ads.
            </p>
          </div>
        </div>
      </div>

      {/* Alignment Status Card */}
      {alignmentStatus && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Alignment Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Categories</p>
              <p className="text-2xl font-bold text-gray-900">{alignmentStatus.total}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Mapped</p>
              <p className="text-2xl font-bold text-green-600">{alignmentStatus.mapped}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Unmapped</p>
              <p className="text-2xl font-bold text-orange-600">{alignmentStatus.unmapped}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Coverage</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-gray-900">{alignmentStatus.mappingCoverage}%</p>
                {alignmentStatus.isCompliant ? (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Compliant</span>
                ) : (
                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">Needs Work</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Start Guide */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-4">
          🚀 Quick Start: Common Product Categories
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Food & Grocery</h4>
            <ul className="space-y-1 text-sm text-purple-700 dark:text-purple-300">
              <li>• Fresh Produce</li>
              <li>• Dairy & Eggs</li>
              <li>• Meat & Seafood</li>
              <li>• Bakery</li>
              <li>• Beverages</li>
              <li>• Snacks & Candy</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Household & Personal Care</h4>
            <ul className="space-y-1 text-sm text-purple-700 dark:text-purple-300">
              <li>• Cleaning Supplies</li>
              <li>• Paper Products</li>
              <li>• Health & Beauty</li>
              <li>• Personal Care</li>
              <li>• Baby Products</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">General Merchandise</h4>
            <ul className="space-y-1 text-sm text-purple-700 dark:text-purple-300">
              <li>• Apparel & Accessories</li>
              <li>• Electronics</li>
              <li>• Home & Garden</li>
              <li>• Toys & Games</li>
              <li>• Sports & Outdoors</li>
              <li>• Pet Supplies</li>
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
            <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Best Practices
            </h4>
            <ul className="space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
              <li>• <strong>Keep it simple:</strong> Use clear, customer-friendly category names</li>
              <li>• <strong>Map to Google:</strong> Always align categories to Google's taxonomy for better feed quality</li>
              <li>• <strong>Organize logically:</strong> Group similar products together (e.g., all dairy in one category)</li>
              <li>• <strong>Start broad:</strong> Create 5-10 main categories, then add subcategories as needed</li>
              <li>• <strong>Check coverage:</strong> Aim for 100% mapping coverage for optimal performance</li>
            </ul>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-700">
            <h4 className="font-medium text-red-900 dark:text-red-100 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Google Merchant Center Restrictions
            </h4>
            <p className="text-sm text-red-800 dark:text-red-200 mb-2">
              <strong>Important:</strong> Google Shopping prohibits or restricts certain product categories. Do not create categories for:
            </p>
            <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
              <li>• <strong>Weapons:</strong> Guns, ammunition, explosives, knives (with exceptions)</li>
              <li>• <strong>Tobacco & Drugs:</strong> Cigarettes, e-cigarettes, recreational drugs, drug paraphernalia</li>
              <li>• <strong>Adult Content:</strong> Sexually suggestive or explicit products</li>
              <li>• <strong>Healthcare:</strong> Prescription drugs, unapproved supplements (restrictions vary by country)</li>
              <li>• <strong>Counterfeit Goods:</strong> Replicas, knock-offs, unauthorized merchandise</li>
              <li>• <strong>Dangerous Products:</strong> Recalled items, hazardous materials</li>
            </ul>
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              📖 <a href="https://support.google.com/merchants/answer/6149970" target="_blank" rel="noopener noreferrer" className="underline hover:text-red-800 dark:hover:text-red-200">
                View full Google Merchant Center prohibited content policy
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Categories List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Categories</h2>
          <button
            onClick={openCreate}
            className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            + Create Category
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {categories.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No categories found. Create your first category to get started.
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">{cat.name}</h3>
                      <span className="text-sm text-gray-500">({cat.slug})</span>
                      {!cat.isActive && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Inactive</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                      <span>Sort: {cat.sortOrder}</span>
                      {cat.googleCategoryId ? (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Mapped to Google: {cat.googleCategoryId}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-orange-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Not mapped
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(cat)}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteCategory(cat)}
                    className="ml-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">What's Next?</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href={`/t/${tenantId}/items`}
            className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">Assign to Products</h4>
              <p className="text-sm text-gray-600">Go to the Items page to assign these categories to your products.</p>
            </div>
          </a>
          
          <a
            href={`/tenant/${tenantId}`}
            target="_blank"
            className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">Preview Storefront</h4>
              <p className="text-sm text-gray-600">See how your categorized products appear to customers.</p>
            </div>
          </a>
        </div>
      </div>

      {/* Edit Modal */}
      {isModalOpen && (selected || isCreate) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{isCreate ? 'Create Category' : 'Edit Category'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                <input
                  type="number"
                  value={formSort}
                  onChange={(e) => setFormSort(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Google Category</label>
                <div className="relative">
                  <input
                    placeholder="Search taxonomy by name (e.g. Electronics)"
                    value={taxQuery}
                    onChange={(e) => { setTaxQuery(e.target.value); setShowTaxResults(true) }}
                    onFocus={() => setShowTaxResults(true)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {showTaxResults && (taxResults.length > 0 || taxLoading) && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto">
                      {taxLoading && <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>}
                      {taxResults.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => { setFormGoogleId(r.id); setTaxQuery(r.path.join(' > ')); setShowTaxResults(false) }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          <div className="text-sm font-medium text-gray-900">{r.name}</div>
                          <div className="text-xs text-gray-600">{r.path.join(' > ')}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">Selected ID: {formGoogleId || 'none'}</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md shadow-lg text-white ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
