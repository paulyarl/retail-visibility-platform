'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

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

export default function FeedValidationPage() {
  const params = useParams()
  const tenantId = params.tenantId as string

  const [validationData, setValidationData] = useState<ValidationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchValidation() {
      try {
        setLoading(true)
        const res = await fetch(`http://localhost:4000/api/${tenantId}/feed/validate`)
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

    if (tenantId) {
      fetchValidation()
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
        <p className="text-gray-600">Review validation issues before pushing your feed to Google Merchant</p>
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
    </div>
  )
}
