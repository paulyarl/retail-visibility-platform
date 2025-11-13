"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Skeleton } from '@/components/ui';
import EditBusinessProfileModal from './EditBusinessProfileModal';
import { BusinessProfile, calculateSEOReadiness, isSEOReady, formatPhoneNumber, countries } from '@/lib/validation/businessProfile';

interface BusinessProfileCardProps {
  profile: BusinessProfile | null;
  loading?: boolean;
  onUpdate?: (profile: BusinessProfile) => void;
  tenantName?: string;
}

export default function BusinessProfileCard({ profile, loading, onUpdate, tenantName }: BusinessProfileCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Business Profile</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>Your store information for SEO and customer visibility</CardDescription>
            </div>
            <Badge variant="warning">Not Set Up</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-neutral-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-sm font-medium text-neutral-900 mb-2">No business profile</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Add your business information to improve SEO and customer trust
            </p>
            <Button onClick={() => setIsEditModalOpen(true)}>
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Business Profile
            </Button>
          </div>
        </CardContent>
        <EditBusinessProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          profile={tenantName ? { business_name: tenantName } as Partial<BusinessProfile> : null}
          onSave={onUpdate}
        />
      </Card>
    );
  }

  const seoScore = calculateSEOReadiness(profile);
  const seoReady = isSEOReady(profile);
  const country = countries.find(c => c.code === profile.country_code);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>Your store information for SEO and customer visibility</CardDescription>
            </div>
            <Badge variant={seoReady ? "success" : "warning"}>
              {seoReady ? "SEO Ready" : "Incomplete"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Business Logo */}
          {profile.logo_url && (
            <div className="flex items-center justify-center pb-4 border-b border-neutral-200">
              <img
                src={profile.logo_url}
                alt="Business Logo"
                className="max-h-24 max-w-full object-contain"
              />
            </div>
          )}

          {/* Business Information */}
          <div className="space-y-4">
            {/* Business Name */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-500">Business Name</p>
                <p className="text-base font-semibold text-neutral-900 mt-1">{profile.business_name}</p>
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-500">Address</p>
                <div className="text-base text-neutral-900 mt-1">
                  <p>{profile.address_line1}</p>
                  {profile.address_line2 && <p>{profile.address_line2}</p>}
                  <p>
                    {profile.city}
                    {profile.state && `, ${profile.state}`} {profile.postal_code}
                  </p>
                  <p className="flex items-center gap-1">
                    {country?.flag} {country?.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-500">Phone</p>
                <p className="text-base text-neutral-900 mt-1 font-mono">{formatPhoneNumber(profile.phone_number)}</p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-500">Email</p>
                <p className="text-base text-neutral-900 mt-1">{profile.email}</p>
              </div>
            </div>

            {/* Website */}
            {profile.website && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-500">Website</p>
                  <a 
                    href={profile.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-base text-primary-600 hover:text-primary-700 mt-1 inline-flex items-center gap-1"
                  >
                    {profile.website}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            )}

            {/* Contact Person */}
            {profile.contact_person && (
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-500">Contact Person</p>
                  <p className="text-base text-neutral-900 mt-1">{profile.contact_person}</p>
                </div>
              </div>
            )}
          </div>

          {/* SEO Readiness */}
          <div className="pt-6 border-t border-neutral-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">SEO Readiness</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {seoReady 
                    ? 'Your profile is optimized for search engines' 
                    : 'Complete all fields to improve visibility'}
                </p>
              </div>
              <span className="text-2xl font-bold text-neutral-900">{seoScore}%</span>
            </div>
            
            {/* Progress Bar */}
            <div className="relative h-2 bg-neutral-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${seoScore}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  seoScore >= 85 ? 'bg-success' : 
                  seoScore >= 50 ? 'bg-warning' : 
                  'bg-error'
                }`}
              />
            </div>

            {!seoReady && (
              <p className="text-xs text-neutral-500 mt-2 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Add website and social links to reach 100%
              </p>
            )}
          </div>

          {/* Edit Button */}
          <div className="pt-4">
            <Button variant="secondary" onClick={() => setIsEditModalOpen(true)} className="w-full">
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Business Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditBusinessProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile}
        onSave={onUpdate}
      />
    </>
  );
}
