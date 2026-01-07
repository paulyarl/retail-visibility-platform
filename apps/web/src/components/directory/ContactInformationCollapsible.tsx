"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Mail, MapPin, Phone } from "lucide-react";

interface ContactInformationCollapsibleProps {
    
        tenant?: {
            phone?: string;
            email?: string;
            address?: string;
        },
    fullAddress: any;
    initialExpanded?: boolean;

}

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function ContactInformationCollapsible({
    tenant,fullAddress, initialExpanded = false
}: ContactInformationCollapsibleProps) {
    const [isExpanded, setIsExpanded] = useState(initialExpanded);

    // Count available contact methods
    const contactCount = [
        tenant?.phone,
        tenant?.email,
        tenant?.address,
        fullAddress?.fullAddress
    ].filter(Boolean).length;

    return (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            {/* Collapsible Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                        Contact Us
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
                    {fullAddress && (
                                       <div className="flex items-start gap-2 mb-3">
                                         <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                         <p className="text-sm text-gray-700">{fullAddress}</p>
                                       </div>
                                     )}
                                     {tenant?.phone && (
                                       <div className="flex items-center gap-2 mb-3">
                                         <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                         <a href={`tel:${tenant.phone}`} className="text-sm text-blue-600 hover:text-blue-700">
                                           {tenant.phone}
                                         </a>
                                       </div>
                                     )}
                                     {tenant?.email && (
                                       <div className="flex items-center gap-2 mb-3">
                                         <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                         <a 
                                           href={`mailto:${tenant.email}`} 
                                           className="text-sm text-blue-600 hover:text-blue-700"
                                           suppressHydrationWarning
                                         >
                                           {tenant.email}
                                         </a>
                                       </div>
                                     )}
                </div>
            )}
        </div>
    );
}
