'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, API_BASE_URL } from '@/lib/api'

interface ValidationError {
  id: string
  field: string
  message: string
}

interface ValidationWarning {
  id: string
  field: string
  message: string
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

  useEffect(() => {
    async function fetchValidation() {
      try {
        setLoading(true)
        const res = await api.get(`${API_BASE_URL}/api/${tenantId}/feed/validate`)
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
        const r = await api.get(`${API_BASE_URL}/api/${tenantId}/categories/coverage`)
        if (!r.ok) return
        const d = await r.json()
        setCoverage(d?.data || null)
      } catch {}
    }

    if (tenantId) {
      fetchValidation()
      fetchCoverage() // Gated by FF_FEED_COVERAGE on backend
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
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
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={async () => {
              try {
                setLoading(true)
                const res = await api.post(`${API_BASE_URL}/api/${tenantId}/feed/precheck`)
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
                try { const r = await api.get(`${API_BASE_URL}/api/${tenantId}/categories/coverage`); const d = await r.json(); setCoverage(d?.data || null) } catch {}
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
            disabled={pushing}
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
                if (!res.ok) throw new Error('Failed to create feed job')
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

      {/* Errors Section */}
      {errorCount > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-red-200 mb-6">
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <h2 className="text-lg font-semibold text-red-900">Errors ({errorCount})</h2>
            <p className="text-sm text-red-700">These must be fixed before your feed can be pushed</p>
          </div>
          <div className="divide-y divide-red-100">
            {validationData?.errors.map((err, idx) => (
              <div key={idx} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{err.field}</p>
                    <p className="text-sm text-gray-600 mt-1">{err.message}</p>
                    <p className="text-xs text-gray-500 mt-1">Item ID: {err.id}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings Section */}
      {warningCount > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-orange-200">
          <div className="px-6 py-4 bg-orange-50 border-b border-orange-200">
            <h2 className="text-lg font-semibold text-orange-900">Warnings ({warningCount})</h2>
            <p className="text-sm text-orange-700">Recommended fixes to improve feed quality</p>
          </div>
          <div className="divide-y divide-orange-100">
            {validationData?.warnings.map((warn, idx) => (
              <div key={idx} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{warn.field}</p>
                    <p className="text-sm text-gray-600 mt-1">{warn.message}</p>
                    <p className="text-xs text-gray-500 mt-1">Item ID: {warn.id}</p>
                  </div>
                </div>
              </div>
            ))}
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
                    const res = await api.post(`${API_BASE_URL}/api/${tenantId}/feed/precheck`)
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
