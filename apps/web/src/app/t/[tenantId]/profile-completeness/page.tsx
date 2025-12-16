'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ContextBadges } from '@/components/ContextBadges'
import { API_BASE_URL } from '@/lib/api'

interface CompletenessData {
  score: number
  grade: string
  fields: {
    businessName: boolean
    addressLine1: boolean
    city: boolean
    postalCode: boolean
    countryCode: boolean
    phoneNumber: boolean
    email: boolean
    website: boolean
    geocode: boolean
    businessDescription: boolean
    businessHours: boolean
    logo: boolean
    socialLinks: boolean
    seoTags: boolean
  }
}

export default function ProfileCompletenessPage() {
  const params = useParams()
  const tenantId = params.tenantId as string
  const router = useRouter()

  const [completeness, setCompleteness] = useState<CompletenessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Fetch profile data from the public endpoint
        const res = await fetch(`${API_BASE_URL}/public/tenant/${tenantId}/profile`, {
          headers,
          credentials: 'include',
        })

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Profile not found. Please create your business profile first.')
          } else {
            throw new Error('Failed to fetch profile data')
          }
        }
        
        const profileData = await res.json()
        
        // Calculate completeness score based on available fields
        const totalFields = 14
        
        // Track individual field completion
        const fields = {
          businessName: !!profileData.business_name,
          addressLine1: !!profileData.address_line1,
          city: !!profileData.city,
          postalCode: !!profileData.postal_code,
          countryCode: !!profileData.country_code,
          phoneNumber: !!profileData.phone_number,
          email: !!profileData.email,
          website: !!(profileData.website && profileData.website.startsWith('https://')),
          geocode: !!(profileData.latitude !== null && profileData.latitude !== undefined && 
                     profileData.longitude !== null && profileData.longitude !== undefined),
          businessDescription: !!profileData.business_description,
          businessHours: !!(profileData.hours && profileData.hours.timezone),
          logo: !!profileData.logo_url,
          socialLinks: !!(profileData.social_links && Object.keys(profileData.social_links).length > 0),
          seoTags: !!(profileData.seo_tags && profileData.seo_tags.length > 0),
        }
        
        // Count completed fields
        const score = Object.values(fields).filter(Boolean).length
        const completenessScore = Math.round((score / totalFields) * 100)
        
        // Determine grade
        let grade = 'poor'
        if (completenessScore >= 90) grade = 'excellent'
        else if (completenessScore >= 75) grade = 'good'
        else if (completenessScore >= 50) grade = 'fair'
        
        const completenessData = {
          score: completenessScore,
          grade: grade,
          fields: fields
        }
        
        setCompleteness(completenessData)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    if (tenantId) {
      fetchProfile()
    }
  }, [tenantId])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Business Profile Completeness</h1>
          <p className="text-gray-600">Track your profile completion progress</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-yellow-900 font-semibold mb-1">Profile Not Found</h3>
              <p className="text-yellow-800">{error}</p>
              <button
                className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                onClick={() => router.push(`/t/${tenantId}/onboarding`)}
              >
                Create Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'fair': return 'text-orange-600'
      case 'poor': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getGradeBg = (grade: string) => {
    switch (grade) {
      case 'excellent': return 'bg-green-100'
      case 'good': return 'bg-blue-100'
      case 'fair': return 'bg-orange-100'
      case 'poor': return 'bg-red-100'
      default: return 'bg-gray-100'
    }
  }

  const score = completeness?.score || 0

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Context Badges */}
      <ContextBadges 
        tenant={{ id: tenantId, name: '' }}
        contextLabel="Profile"
      />
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Business Profile Completeness</h1>
            <p className="text-gray-600">Complete your profile to improve visibility and trust</p>
          </div>
          <button
            onClick={() => router.push(`/t/${tenantId}/settings/tenant`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Profile
          </button>
        </div>
      </div>

      {/* Score Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center w-48 h-48 mb-6">
            {/* Progress Circle */}
            <svg className="w-48 h-48 transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-gray-200"
              />
              <circle
                cx="96"
                cy="96"
                r="88"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 88}`}
                strokeDashoffset={`${2 * Math.PI * 88 * (1 - score / 100)}`}
                className={score >= 90 ? 'text-green-500' : score >= 75 ? 'text-blue-500' : score >= 50 ? 'text-orange-500' : 'text-red-500'}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold text-gray-900">{score}%</span>
              <span className={`text-sm font-medium uppercase mt-1 ${getGradeColor(completeness?.grade || '')}`}>
                {completeness?.grade}
              </span>
            </div>
          </div>
          <p className="text-gray-600">
            {score >= 90 && 'Excellent! Your profile is nearly complete.'}
            {score >= 75 && score < 90 && 'Good progress! A few more fields to fill.'}
            {score >= 50 && score < 75 && 'Fair. Complete more fields to improve.'}
            {score < 50 && 'Your profile needs attention. Add more information.'}
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Profile Checklist</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <ChecklistItem label="Business Name" weight="Critical" completed={completeness?.fields?.businessName ?? false} />
            <ChecklistItem label="Address" weight="Critical" completed={completeness?.fields?.addressLine1 ?? false} />
            <ChecklistItem label="City" weight="Critical" completed={completeness?.fields?.city ?? false} />
            <ChecklistItem label="Postal Code" weight="Critical" completed={completeness?.fields?.postalCode ?? false} />
            <ChecklistItem label="Country" weight="Critical" completed={completeness?.fields?.countryCode ?? false} />
            <ChecklistItem label="Phone Number" weight="Important" completed={completeness?.fields?.phoneNumber ?? false} />
            <ChecklistItem label="Email" weight="Important" completed={completeness?.fields?.email ?? false} />
            <ChecklistItem label="Website (HTTPS)" weight="Important" completed={completeness?.fields?.website ?? false} />
            <ChecklistItem label="Geocode (Lat/Lng)" weight="Important" completed={completeness?.fields?.geocode ?? false} />
            <ChecklistItem label="Business Description" weight="Important" completed={completeness?.fields?.businessDescription ?? false} />
            <ChecklistItem label="Logo" weight="Optional" completed={completeness?.fields?.logo ?? false} />
            <ChecklistItem label="Business Hours" weight="Optional" completed={completeness?.fields?.businessHours ?? false} />
            <ChecklistItem label="Social Links" weight="Optional" completed={completeness?.fields?.socialLinks ?? false} />
            <ChecklistItem label="SEO Tags" weight="Optional" completed={completeness?.fields?.seoTags ?? false} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ChecklistItem({ label, weight, completed }: { label: string; weight: string; completed: boolean }) {
  const weightColors = {
    Critical: 'text-red-600 bg-red-50',
    Important: 'text-blue-600 bg-blue-50',
    Optional: 'text-gray-600 bg-gray-50',
  }

  return (
    <div className="flex items-center gap-4">
      <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
        completed ? 'bg-green-500 border-green-500' : 'border-gray-300'
      }`}>
        {completed && (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <div className="flex-1">
        <span className={`font-medium ${completed ? 'text-gray-900' : 'text-gray-600'}`}>{label}</span>
      </div>
      <span className={`text-xs px-2 py-1 rounded ${weightColors[weight as keyof typeof weightColors]}`}>
        {weight}
      </span>
    </div>
  )
}
