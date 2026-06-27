"use client";

import Link from "next/link";
import { ShieldAlert, AlertTriangle, ArrowRight } from "lucide-react";
import { AllCapabilitiesState } from "@/services/CapabilityResolutionService";

interface ConstraintAlertBannerProps {
  capabilities: AllCapabilitiesState | null;
  tenantId: string;
}

export default function ConstraintAlertBanner({ capabilities, tenantId }: ConstraintAlertBannerProps) {
  if (!capabilities?.constraintViolations || capabilities.constraintViolations.length === 0) {
    return null;
  }

  const blockViolations = capabilities.constraintViolations.filter(v => v.severity === 'block');
  const warnViolations = capabilities.constraintViolations.filter(v => v.severity === 'warn');

  if (blockViolations.length === 0 && warnViolations.length === 0) return null;

  // Find the settings link for the first block violation's source capability
  const settingsLinkMap: Record<string, string> = {
    storefront: `/t/${tenantId}/settings/tenant`,
    product_types: `/t/${tenantId}/settings/product-types`,
    fulfillment: `/t/${tenantId}/settings/fulfillment`,
    commerce: `/t/${tenantId}/settings/commerce`,
    payment_gateway: `/t/${tenantId}/settings/payment-gateways`,
    product_options: `/t/${tenantId}/settings/product-options`,
    integration_options: `/t/${tenantId}/settings/integrations`,
    storefront_options: `/t/${tenantId}/settings/tenant`,
    quickstart: `/t/${tenantId}/quick-start`,
    faq: `/t/${tenantId}/faq/options`,
    directory_entry: `/t/${tenantId}/settings/directory`,
    crm: `/t/${tenantId}/support`,
    chatbot: `/t/${tenantId}/bot/options`,
    social_commerce_options: `/t/${tenantId}/settings/social-commerce`,
    barcode_scan: `/t/${tenantId}/scan`,
  };

  const firstBlock = blockViolations[0];
  const firstWarn = warnViolations[0];
  const primaryViolation = firstBlock || firstWarn;
  const isBlock = !!firstBlock;
  const settingsLink = primaryViolation
    ? settingsLinkMap[primaryViolation.sourceCapability] || `/t/${tenantId}/settings`
    : `/t/${tenantId}/settings`;

  return (
    <div
      className={`rounded-xl border p-4 mb-4 ${
        isBlock
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${isBlock ? 'text-red-600' : 'text-amber-600'}`}>
          {isBlock
            ? <ShieldAlert className="w-5 h-5" />
            : <AlertTriangle className="w-5 h-5" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${isBlock ? 'text-red-900' : 'text-amber-900'}`}>
            {isBlock
              ? `${blockViolations.length} capability ${blockViolations.length === 1 ? 'conflict' : 'conflicts'} need attention`
              : `${warnViolations.length} capability ${warnViolations.length === 1 ? 'recommendation' : 'recommendations'}`
            }
          </h3>
          <p className={`text-xs mt-1 ${isBlock ? 'text-red-700' : 'text-amber-700'}`}>
            {primaryViolation?.message}
          </p>
          {primaryViolation?.resolutionHint && (
            <p className={`text-xs mt-0.5 ${isBlock ? 'text-red-600' : 'text-amber-600'} opacity-80`}>
              {primaryViolation.resolutionHint}
            </p>
          )}
          {blockViolations.length > 1 && (
            <p className="text-xs text-red-600 mt-1">
              +{blockViolations.length - 1} more {blockViolations.length - 1 === 1 ? 'conflict' : 'conflicts'}
            </p>
          )}
        </div>
        <Link
          href={settingsLink}
          className={`inline-flex items-center gap-1 text-xs font-medium flex-shrink-0 ${
            isBlock
              ? 'text-red-700 hover:text-red-800'
              : 'text-amber-700 hover:text-amber-800'
          }`}
        >
          Resolve
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
