'use client';

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SafeImage } from '@/components/SafeImage';
import { computeStoreStatus } from '@/lib/hours-utils';

interface ProductBusinessInfoCollapsibleProps {
    product: {
        tenantId: string;
    };
    tenant: {
        id: string;
        name: string;
        metadata?: {
            businessName?: string;
            phone?: string;
            email?: string;
            website?: string;
            address?: string;
            logo_url?: string;
            social_links?: {
                facebook?: string;
                instagram?: string;
                twitter?: string;
                linkedin?: string;
            };
        };
    };
    storeStatus?: any;
}

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function ProductBusinessInfoCollapsible({
    product,
    tenant,
    storeStatus,
}: ProductBusinessInfoCollapsibleProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const metadata = tenant.metadata as any;
    const businessName = metadata?.businessName || tenant.name;

    // Count available information items
    const infoCount = [
        metadata?.phone,
        metadata?.email,
        metadata?.website,
        metadata?.address,
        metadata?.social_links?.facebook ||
        metadata?.social_links?.instagram ||
        metadata?.social_links?.twitter ||
        metadata?.social_links?.linkedin,
        metadata?.address // for map
    ].filter(Boolean).length;

    return (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden mb-6">
            {/* Collapsible Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                        About {businessName}
                    </h2>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-3 py-1 rounded-full">
                        {infoCount} detail{infoCount !== 1 ? 's' : ''}
                    </span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
                )}
            </button>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-neutral-200 dark:border-neutral-700">
                    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6 space-y-6">

                        {/* Business Logo */}
                        {metadata?.logo_url && (
                            <div className="flex justify-center">
                                <SafeImage
                                    src={metadata.logo_url}
                                    alt={businessName}
                                    width={120}
                                    height={60}
                                    className="h-15 w-auto object-contain"
                                    priority
                                />
                            </div>
                        )}

                        {/* Business Description */}
                        {metadata?.business_description && (
                            <div className="text-center">
                                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                                    {metadata.business_description}
                                </p>
                            </div>
                        )}

                        {/* Contact Information Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Phone */}
                            {metadata?.phone && (
                                <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                                    <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Phone</p>
                                        <a href={`tel:${metadata.phone}`} className="text-lg text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                                            {metadata.phone}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Email */}
                            {metadata?.email && (
                                <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                                    <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Email</p>
                                        <a href={`mailto:${metadata.email}`} className="text-lg text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 break-words">
                                            {metadata.email}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Website */}
                            {metadata?.website && (
                                <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                                    <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Website</p>
                                        <a href={metadata.website} target="_blank" rel="noopener noreferrer" className="text-lg text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 break-words">
                                            {metadata.website}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Address */}
                            {metadata?.address && (
                                <div className="flex items-start gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                                    <svg className="h-6 w-6 text-neutral-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Address</p>
                                        <p className="text-lg text-neutral-700 dark:text-neutral-300">{metadata.address}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Social Links */}
                        {(metadata?.social_links as any)?.facebook ||
                         (metadata?.social_links as any)?.instagram ||
                         (metadata?.social_links as any)?.twitter ||
                         (metadata?.social_links as any)?.linkedin ? (
                            <div>
                                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Follow Us</h3>
                                <div className="flex flex-wrap gap-4">
                                    {(metadata?.social_links as any)?.facebook && (
                                        <a
                                            href={(metadata?.social_links as any)?.facebook}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                            title="Facebook"
                                        >
                                            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                            </svg>
                                            <span className="text-sm font-medium">Facebook</span>
                                        </a>
                                    )}
                                    {(metadata?.social_links as any)?.instagram && (
                                        <a
                                            href={(metadata?.social_links as any)?.instagram}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300 transition-colors"
                                            title="Instagram"
                                        >
                                            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                            </svg>
                                            <span className="text-sm font-medium">Instagram</span>
                                        </a>
                                    )}
                                    {(metadata?.social_links as any)?.twitter && (
                                        <a
                                            href={(metadata?.social_links as any)?.twitter}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-blue-400 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200 transition-colors"
                                            title="Twitter/X"
                                        >
                                            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                                            </svg>
                                            <span className="text-sm font-medium">Twitter</span>
                                        </a>
                                    )}
                                    {(metadata?.social_links as any)?.linkedin && (
                                        <a
                                            href={(metadata?.social_links as any)?.linkedin}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-blue-700 hover:text-blue-800 dark:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                            title="LinkedIn"
                                        >
                                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                            </svg>
                                            <span className="text-sm font-medium">LinkedIn</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {/* Interactive Map */}
                        {metadata?.address && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Find Us</h3>
                                    {storeStatus && (
                                        <span className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-full ${
                                            // Check if special hours are active (label contains parentheses with note)
                                            storeStatus.label.includes('(') && storeStatus.label.includes(')')
                                              ? 'bg-amber-50 border border-amber-200'
                                              : storeStatus.isOpen
                                                ? 'bg-green-50 border border-green-200'
                                                : 'bg-red-50 border border-red-200'
                                        }`}>
                                            <span className={`inline-block w-2 h-2 rounded-full ${
                                              storeStatus.label.includes('(') && storeStatus.label.includes(')')
                                                ? 'bg-amber-500'
                                                : storeStatus.isOpen ? 'bg-green-500' : 'bg-red-500'
                                            }`}></span>
                                            <span className={
                                              storeStatus.label.includes('(') && storeStatus.label.includes(')')
                                                ? 'text-amber-700 font-semibold'
                                                : storeStatus.isOpen ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'
                                            }>
                                              {storeStatus.label}
                                            </span>
                                        </span>
                                    )}
                                </div>
                                <div className="w-full h-64 sm:h-80 rounded-lg overflow-hidden border border-neutral-200">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        style={{ border: 0 }}
                                        loading="lazy"
                                        allowFullScreen
                                        referrerPolicy="no-referrer-when-downgrade"
                                        src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&q=${encodeURIComponent(metadata.address)}`}
                                        title="Store Location"
                                    />
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(metadata.address)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                        </svg>
                                        Get Directions
                                    </a>
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(metadata.address)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors text-sm font-medium"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        View on Google Maps
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
