"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ContactInformationCollapsibleProps {
    tenant: {
        metadata?: {
            phone?: string;
            email?: string;
            address?: string;
        };
    };
}

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function ContactInformationCollapsible({
    tenant,
}: ContactInformationCollapsibleProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Count available contact methods
    const contactCount = [
        tenant.metadata?.phone,
        tenant.metadata?.email,
        tenant.metadata?.address
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
                        Contact Information
                    </h2>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-700 px-3 py-1 rounded-full">
                        {contactCount} contact method{contactCount !== 1 ? 's' : ''}
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
                    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Phone */}
                            {tenant.metadata?.phone && (
                                <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                                    <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Phone</p>
                                        <a href={`tel:${tenant.metadata.phone}`} className="text-lg text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                                            {tenant.metadata.phone}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Email */}
                            {tenant.metadata?.email && (
                                <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
                                    <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Email</p>
                                        <a href={`mailto:${tenant.metadata.email}`} className="text-lg text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 break-words">
                                            {tenant.metadata.email}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Address */}
                            {tenant.metadata?.address && (
                                <div className="flex items-start gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700 md:col-span-2">
                                    <svg className="h-6 w-6 text-neutral-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Address</p>
                                        <p className="text-lg text-neutral-700 dark:text-neutral-300">{tenant.metadata.address}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
