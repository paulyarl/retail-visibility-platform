'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { api, API_BASE_URL } from '@/lib/api'
import { ContextBadges } from '@/components/ContextBadges'
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink, 
  FolderTree, 
  Image as ImageIcon, 
  Tag, 
  DollarSign,
  Package,
  Barcode,
  ChevronDown,
  ChevronRight,
  Edit,
  ArrowRight,
  RefreshCw
} from 'lucide-react'

interface ValidationError {
  id: string
  field: string
  message: string
  sku?: string
  name?: string
}

interface ValidationWarning {
  id: string
  field: string
  message: string
  sku?: string
  name?: string
}

interface ValidationData {
  total: number
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

interface CoverageData {
  total: number
  mapped: number
  unmapped: number
  coverage: number
}

interface SetupStatus {
  isReady: boolean
  hasGoogleAccount: boolean
  hasMerchantLink: boolean
  hasOAuthTokens: boolean
  message: string
}

// Human-readable error messages and fix instructions
const ERROR_INFO: Record<string, { label: string; description: string; fixAction: string; icon: React.ReactNode }> = {
  sku_required: {
    label: 'Missing SKU',
    description: 'Product requires a unique SKU identifier',
    fixAction: 'Add a SKU to this product',
    icon: <Barcode className="w-4 h-4" />,
  },
  name_required: {
    label: 'Missing Name',
    description: 'Product requires a name/title',
    fixAction: 'Add a product name',
    icon: <Tag className="w-4 h-4" />,
  },
  price_invalid: {
    label: 'Invalid Price',
    description: 'Product price must be greater than $0',
    fixAction: 'Set a valid price',
    icon: <DollarSign className="w-4 h-4" />,
  },
  category_required: {
    label: 'Missing Category',
    description: 'Product must be assigned to a category',
    fixAction: 'Assign a category',
    icon: <FolderTree className="w-4 h-4" />,
  },
  category_unmapped: {
    label: 'Unmapped Category',
    description: 'Category needs to be mapped to Google taxonomy',
    fixAction: 'Map category to Google',
    icon: <FolderTree className="w-4 h-4" />,
  },
  image_recommended: {
    label: 'Missing Image',
    description: 'Products with images perform better',
    fixAction: 'Add a product image',
    icon: <ImageIcon className="w-4 h-4" />,
  },
  availability_recommended: {
    label: 'Missing Availability',
    description: 'Set stock availability status',
    fixAction: 'Set availability',
    icon: <Package className="w-4 h-4" />,
  },
  condition_recommended: {
    label: 'Missing Condition',
    description: 'Specify product condition (new/used/refurbished)',
    fixAction: 'Set condition',
    icon: <Tag className="w-4 h-4" />,
  },
  identifiers_recommended: {
    label: 'Missing Identifiers',
    description: 'Add GTIN/UPC or Brand+MPN for better visibility',
    fixAction: 'Add product identifiers',
    icon: <Barcode className="w-4 h-4" />,
  },
}

// Group errors by type
function groupByMessage<T extends { message: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const existing = groups.get(item.message) || []
    existing.push(item)
    groups.set(item.message, existing)
  }
  return groups
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function FeedValidationPage() {
  const params = useParams()
  const tenantId = params.tenantId as string

  const [validationData, setValidationData] = useState<ValidationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pushing, setPushing] = useState(false)
  const [alignmentModal, setAlignmentModal] = useState<{
    open: boolean,
    missingCategoryCount: number,
    unmappedCount: number,
    missingExamples: Array<{ id: string, sku: string | null }> ,
    unmappedExamples: Array<{ id: string, sku: string | null, categoryPath: string[] }>
  }>({ open: false, missingCategoryCount: 0, unmappedCount: 0, missingExamples: [], unmappedExamples: [] })
  const [toast, setToast] = useState<{ open: boolean, message: string }>(() => ({ open: false, message: '' }))
  const [coverage, setCoverage] = useState<CoverageData | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)

  // Group errors and warnings by type for better UX - must be before any early returns
  const groupedErrors = useMemo(() => groupByMessage(validationData?.errors || []), [validationData?.errors])
  const groupedWarnings = useMemo(() => groupByMessage(validationData?.warnings || []), [validationData?.warnings])

  const [refreshing, setRefreshing] = useState(false)

  async function fetchValidation() {
    try {
      setLoading(true)
      const res = await api.get(`${API_BASE_URL}/api/tenant/${tenantId}/feed/validate`)
      if (!res.ok) throw new Error('Failed to fetch validation data')
      const data = await res.json()
      setValidationData(data.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function fetchCoverage() {
    try {
      const r = await api.get(`${API_BASE_URL}/api/tenant/${tenantId}/categories/coverage`)
      if (!r.ok) return
      const d = await r.json()
      setCoverage(d?.data || null)
    } catch {}
  }

  async function fetchSetupStatus() {
    try {
      const r = await api.get(`${API_BASE_URL}/api/feed-jobs/setup-status/${tenantId}`)
      if (!r.ok) return
      const d = await r.json()
      setSetupStatus(d?.data || null)
    } catch {}
  }

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([fetchValidation(), fetchCoverage()])
    setRefreshing(false)
  }

  useEffect(() => {
    if (tenantId) {
      // Fetch all data in parallel for faster initial load
      Promise.all([
        fetchValidation(),
        fetchCoverage(), // Gated by FF_FEED_COVERAGE on backend
        fetchSetupStatus() // Check Google Merchant setup status
      ])
    }
  }, [tenantId])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-3">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
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

  const errorCount = validationData?.errors.length || 0
  const warningCount = validationData?.warnings.length || 0
  const isReady = errorCount === 0

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Context Badges */}
      <ContextBadges 
        tenant={{ id: tenantId, name: '' }}
        contextLabel="Feed Validation"
      />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Feed Validation Report</h1>
        <div className="flex items-center gap-3">
          <p className="text-gray-600">Review validation issues before pushing your feed to Google Merchant</p>
          {coverage && (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${coverage.coverage === 100 ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}
              title={`Mapped ${coverage.mapped}/${coverage.total}`}
            >
              Mapping Coverage: {coverage.coverage}%
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2 border border-gray-300"
            onClick={handleRefresh}
            disabled={refreshing || loading}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={async () => {
              try {
                setLoading(true)
                const res = await api.post(`${API_BASE_URL}/api/tenant/${tenantId}/feed/precheck`)
                const data = await res.json()
                // Convert precheck result to validation-like display
                const errors: ValidationError[] = []
                for (const m of (data?.data?.missingCategory || [])) {
                  errors.push({ id: m.id, field: 'categoryPath', message: 'category_required' })
                }
                for (const u of (data?.data?.unmapped || [])) {
                  errors.push({ id: u.id, field: 'googleCategoryId', message: 'category_unmapped' })
                }
                setValidationData({ total: data?.data?.total || 0, errors, warnings: [] })
                setError(null)
                // refresh coverage
                try { const r = await api.get(`${API_BASE_URL}/api/tenant/${tenantId}/categories/coverage`); const d = await r.json(); setCoverage(d?.data || null) } catch {}
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to run precheck')
              } finally {
                setLoading(false)
              }
            }}
          >
            Run Precheck
          </button>
          <button
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60"
            disabled={pushing || (setupStatus !== null && !setupStatus.isReady)}
            title={setupStatus && !setupStatus.isReady ? 'Complete Google Merchant Center setup first' : undefined}
            onClick={async () => {
              if (!tenantId) return
              setPushing(true)
              try {
                const res = await api.post(`${API_BASE_URL}/api/feed-jobs`, { tenantId })
                if (res.status === 422) {
                  const data = await res.json()
                  const det = data?.details || {}
                  setAlignmentModal({
                    open: true,
                    missingCategoryCount: det?.missingCategoryCount || 0,
                    unmappedCount: det?.unmappedCount || 0,
                    missingExamples: det?.examples?.missingCategory || [],
                    unmappedExamples: det?.examples?.unmapped || [],
                  })
                  return
                }
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({}))
                  const errorMsg = errorData?.message || errorData?.error || 'Failed to create feed job'
                  const details = errorData?.details
                  if (details && Array.isArray(details)) {
                    // Zod validation errors
                    const messages = details.map((d: any) => d.message || d.path?.join('.') || 'Unknown error').join(', ')
                    throw new Error(`Validation error: ${messages}`)
                  }
                  throw new Error(errorMsg)
                }
                await res.json()
                setToast({ open: true, message: 'Feed job queued successfully' })
                // Auto-dismiss after 3s
                setTimeout(() => setToast({ open: false, message: '' }), 3000)
                // also refresh coverage
                // TEMP: Disabled due to Prisma JsonBody error
                // try { const r = await api.get(`${API_BASE_URL}/api/${tenantId}/categories/coverage`); const d = await r.json(); setCoverage(d?.data || null) } catch {}
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to push feed')
              } finally {
                setPushing(false)
              }
            }}
          >
            {pushing ? 'Pushing…' : 'Push Feed'}
          </button>
        </div>
      </div>

      {/* Google Merchant Setup Banner */}
      {setupStatus && !setupStatus.isReady && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-amber-900">Google Merchant Center not connected</p>
                <p className="text-sm text-amber-700">Complete setup to push your feed to Google Shopping</p>
              </div>
            </div>
            <Link
              href={`/t/${tenantId}/settings/integrations/google`}
              className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 flex items-center gap-2 shrink-0"
            >
              Set Up Google <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Validation Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Items</p>
            <p className="text-2xl font-bold text-gray-900">{validationData?.total || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Errors (Blocking)</p>
            <p className="text-2xl font-bold text-red-600">{errorCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Warnings (Recommended)</p>
            <p className="text-2xl font-bold text-orange-600">{warningCount}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          {isReady ? (
            <div className="flex items-center gap-2 text-green-700">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Feed is ready to push!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-700">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Fix {errorCount} error{errorCount !== 1 ? 's' : ''} before pushing</span>
            </div>
          )}
        </div>
      </div>

      {/* Errors Section - Grouped by Type */}
      {errorCount > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-red-200 mb-6">
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <h2 className="text-lg font-semibold text-red-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Errors ({errorCount})
            </h2>
            <p className="text-sm text-red-700">These must be fixed before your feed can be pushed</p>
          </div>
          <div className="divide-y divide-red-100">
            {Array.from(groupedErrors.entries()).map(([message, items]) => {
              const info = ERROR_INFO[message] || { label: message, description: '', fixAction: 'Fix this issue', icon: <AlertCircle className="w-4 h-4" /> }
              const isExpanded = expandedGroups.has(`error-${message}`)
              const isCategoryIssue = message === 'category_required' || message === 'category_unmapped'
              
              return (
                <div key={message} className="border-b border-red-100 last:border-b-0">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(`error-${message}`)}
                    className="w-full px-6 py-4 flex items-center gap-3 hover:bg-red-50/50 transition-colors"
                  >
                    <div className="text-red-500 flex-shrink-0">{info.icon}</div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{info.label}</span>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                          {items.length} item{items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{info.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCategoryIssue && (
                        <Link
                          href={`/t/${tenantId}/categories`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 flex items-center gap-1"
                        >
                          <FolderTree className="w-3 h-3" />
                          Manage Categories <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                    </div>
                  </button>
                  
                  {/* Expanded Items */}
                  {isExpanded && (
                    <div className="bg-red-50/30 px-6 py-3 space-y-2">
                      <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                        <span>Affected products (opens in new tab):</span>
                        <Link
                          href={`/t/${tenantId}/items`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          View all items <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      {items.slice(0, 10).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-red-100">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900 truncate block">
                              {item.name || item.sku || item.id}
                            </span>
                            <span className="text-xs text-gray-500">ID: {item.id}</span>
                          </div>
                          <Link
                            href={`/t/${tenantId}/items/${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-3 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 flex items-center gap-1 flex-shrink-0"
                          >
                            <Edit className="w-3 h-3" />
                            Fix <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      ))}
                      {items.length > 10 && (
                        <p className="text-xs text-gray-500 text-center py-2">
                          + {items.length - 10} more items
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Warnings Section - Grouped by Type */}
      {warningCount > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-orange-200 mb-6">
          <div className="px-6 py-4 bg-orange-50 border-b border-orange-200">
            <h2 className="text-lg font-semibold text-orange-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Warnings ({warningCount})
            </h2>
            <p className="text-sm text-orange-700">Recommended fixes to improve feed quality</p>
          </div>
          <div className="divide-y divide-orange-100">
            {Array.from(groupedWarnings.entries()).map(([message, items]) => {
              const info = ERROR_INFO[message] || { label: message, description: '', fixAction: 'Fix this issue', icon: <AlertTriangle className="w-4 h-4" /> }
              const isExpanded = expandedGroups.has(`warning-${message}`)
              
              return (
                <div key={message} className="border-b border-orange-100 last:border-b-0">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(`warning-${message}`)}
                    className="w-full px-6 py-4 flex items-center gap-3 hover:bg-orange-50/50 transition-colors"
                  >
                    <div className="text-orange-500 flex-shrink-0">{info.icon}</div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{info.label}</span>
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                          {items.length} item{items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{info.description}</p>
                    </div>
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                  </button>
                  
                  {/* Expanded Items */}
                  {isExpanded && (
                    <div className="bg-orange-50/30 px-6 py-3 space-y-2">
                      <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
                        <span>Affected products (opens in new tab):</span>
                        <Link
                          href={`/t/${tenantId}/items`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          View all items <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      {items.slice(0, 10).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-orange-100">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900 truncate block">
                              {item.name || item.sku || item.id}
                            </span>
                            <span className="text-xs text-gray-500">ID: {item.id}</span>
                          </div>
                          <Link
                            href={`/t/${tenantId}/items/${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-3 px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 flex items-center gap-1 flex-shrink-0"
                          >
                            <Edit className="w-3 h-3" />
                            Improve <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      ))}
                      {items.length > 10 && (
                        <p className="text-xs text-gray-500 text-center py-2">
                          + {items.length - 10} more items
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All Clear */}
      {errorCount === 0 && warningCount === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <h3 className="text-xl font-semibold text-green-900 mb-2">All Clear!</h3>
          <p className="text-green-700">Your feed has no validation issues. You're ready to push to Google Merchant.</p>
        </div>
      )}

      {/* Alignment Required Modal */}
      {alignmentModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl border border-gray-200">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Alignment Required</h3>
              <p className="text-sm text-gray-600">Some products are missing categories or use categories not aligned to Google taxonomy.</p>
            </div>
            <div className="p-6 space-y-6 max-h-[60vh] overflow-auto">
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800 font-medium">Missing Categories: {alignmentModal.missingCategoryCount}</p>
                {alignmentModal.missingExamples.length > 0 && (
                  <ul className="mt-2 text-sm text-red-700 list-disc pl-5">
                    {alignmentModal.missingExamples.slice(0,10).map((ex, i) => (
                      <li key={i}>SKU: {ex.sku ?? '—'} • Item: {ex.id}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-md p-4">
                <p className="text-orange-800 font-medium">Unmapped Categories: {alignmentModal.unmappedCount}</p>
                {alignmentModal.unmappedExamples.length > 0 && (
                  <ul className="mt-2 text-sm text-orange-700 list-disc pl-5">
                    {alignmentModal.unmappedExamples.slice(0,10).map((ex, i) => (
                      <li key={i}>SKU: {ex.sku ?? '—'} • Item: {ex.id} • Path: {Array.isArray(ex.categoryPath) ? ex.categoryPath.join(' > ') : '—'}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <a href={`/t/${tenantId}/categories`} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">Review in Categories</a>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={async () => {
                  try {
                    setLoading(true)
                    const res = await api.post(`${API_BASE_URL}/api/tenant/${tenantId}/feed/precheck`)
                    const data = await res.json()
                    const errors: ValidationError[] = []
                    for (const m of (data?.data?.missingCategory || [])) errors.push({ id: m.id, field: 'categoryPath', message: 'category_required' })
                    for (const u of (data?.data?.unmapped || [])) errors.push({ id: u.id, field: 'googleCategoryId', message: 'category_unmapped' })
                    setValidationData({ total: data?.data?.total || 0, errors, warnings: [] })
                    setAlignmentModal({ ...alignmentModal, open: false })
                    // refresh coverage
                    // TEMP: Disabled due to Prisma JsonBody error
                // try { const r = await api.get(`${API_BASE_URL}/api/${tenantId}/categories/coverage`); const d = await r.json(); setCoverage(d?.data || null) } catch {}
                  } catch (e) {
                    // keep modal open but surface error inline
                    alert('Failed to run precheck')
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                Run Precheck
              </button>
              <button className="px-4 py-2 border rounded-md" onClick={() => setAlignmentModal({ ...alignmentModal, open: false })}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.open && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-green-600 text-white px-4 py-3 rounded-md shadow-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 10-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            <span className="text-sm font-medium">{toast.message}</span>
            <button className="ml-2 text-white/80 hover:text-white text-xs" onClick={() => setToast({ open: false, message: '' })}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  )
}
