'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

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

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        
        // Fetch categories
        const catRes = await fetch(`http://localhost:4000/api/v1/tenants/${tenantId}/categories`)
        if (!catRes.ok) throw new Error('Failed to fetch categories')
        const catData = await catRes.json()
        setCategories(catData.data || [])

        // Fetch alignment status
        const statusRes = await fetch(`http://localhost:4000/api/v1/tenants/${tenantId}/categories-alignment-status`)
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
        <p className="text-gray-600">Manage your product categories and align them with Google taxonomy</p>
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

      {/* Categories List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Categories</h2>
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
                  <button className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
