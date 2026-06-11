"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  CreditCard,
  Store,
  Truck,
  Barcode,
  Package,
  Globe,
  Settings,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowRight,
  Rocket,
  Users,
} from "lucide-react";
import { AllCapabilitiesState } from "@/services/CapabilityResolutionService";

interface CapabilityShowcaseProps {
  capabilities: AllCapabilitiesState | null;
  tenantId: string;
  canUpgrade: boolean;
}

type CapabilityStatus = 'enabled' | 'merchant-gated' | 'tier-gated';

interface CapabilityRow {
  key: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  status: CapabilityStatus;
  detail: string;
  settingsLink: string;
}

export default function CapabilityShowcase({
  capabilities,
  tenantId,
  canUpgrade,
}: CapabilityShowcaseProps) {
  const rows: CapabilityRow[] = useMemo(() => {
    if (!capabilities) return [];

    const getStatus = (tierEnabled: boolean, merchantGated: boolean): CapabilityStatus => {
      if (!tierEnabled) return 'tier-gated';
      if (merchantGated) return 'merchant-gated';
      return 'enabled';
    };

    const cap = capabilities;

    // --- Commerce ---
    const c = cap.commerce;
    const cTier = c?.enabled ?? false;
    const cMerchantGated = cTier && (c?.effectivePaymentType !== c?.paymentType || c?.effectiveCartVisible !== c?.cartVisible);

    // --- Payment Gateway ---
    const pg = cap.paymentGateway;
    const pgTier = pg?.enabled ?? false;
    const pgMerchantGated = pgTier && (pg?.effectiveGateways.length ?? 0) < (pg?.allowedGateways.length ?? 0);

    // --- Storefront ---
    const sf = cap.storefront;
    const sfTier = (sf?.type !== 'none') && (sf?.allowedTypes.length ?? 0) > 0;
    const sfMerchantGated = sfTier && (sf?.effectiveType === 'none' || sf?.effectiveType !== sf?.type);

    // --- Fulfillment ---
    const fl = cap.fulfillment;
    const flTier = fl?.enabled ?? false;
    const flMerchantGated = flTier && (
      fl?.effectiveShowsPickup !== fl?.showsPickup ||
      fl?.effectiveShowsDelivery !== fl?.showsDelivery ||
      fl?.effectiveShowsShipping !== fl?.showsShipping
    );

    // --- Barcode ---
    const bc = cap.barcodeScan;
    const bcTier = bc?.enabled ?? false;
    const bcMerchantGated = bcTier && (bc?.effectiveModes.length ?? 0) < (bc?.allowedModes.length ?? 0);

    // --- Product Options ---
    const po = cap.productOptions;
    const poTier = po?.enabled ?? false;
    const poMerchantGated = poTier && (
      (po?.effectiveTypes.length ?? 0) < (po?.allowedTypes.length ?? 0) ||
      po?.effectiveShowsVariants !== po?.showsVariants ||
      po?.effectiveShowsGallery !== po?.showsGallery ||
      po?.effectiveShowsVideo !== po?.showsVideo
    );

    // --- Integration Options ---
    const io = cap.integrationOptions;
    const ioTier = io?.enabled ?? false;
    const ioMerchantGated = ioTier && (io?.effectiveTypes.length ?? 0) < (io?.allowedTypes.length ?? 0);

    // --- Featured Options ---
    const fo = cap.featuredOptions;
    const foTier = fo?.enabled ?? false;
    const foMerchantGated = foTier && (fo?.effectiveTypes.length ?? 0) < (fo?.allowedTypes.length ?? 0);

    // --- Quickstart Options ---
    const qo = cap.quickstartOptions;
    const qoTier = qo?.enabled ?? false;
    const qoMerchantGated = qoTier && (
      (qo?.allowedProductTypes.includes('wizard') && !qo?.canUseWizard) ||
      (qo?.allowedProductTypes.includes('image_gen') && !qo?.canGenerateImages) ||
      (qo?.allowedCategoryTypes.includes('category_generator') && !qo?.canUseCategoryGenerator) ||
      (qo?.allowedAITypes.includes('ai_openai') && !qo?.canUseOpenAI) ||
      (qo?.allowedAITypes.includes('ai_gemini') && !qo?.canUseGemini) ||
      (qo?.allowedAITypes.includes('wizard_ai') && !qo?.canUseAIWizard) ||
      (qo?.allowedAITypes.includes('image_hd') && !qo?.canUseHDImages)
    );

    // --- Storefront Options ---
    const so = cap.storefrontOptions;
    const soTier = so?.enabled ?? false;
    const soMerchantGated = soTier && (
      (so?.allowedHoursTypes.length ?? 0) > (so?.canUseAnimatedHours || so?.canShowHoursStatus ? (so?.canUseAnimatedHours && so?.canShowHoursStatus ? 2 : 1) : 0) ||
      (so?.allowedCategoryTypes.length ?? 0) > ((so?.canUseCategoryStore ? 1 : 0) + (so?.canUseCategoryProduct ? 1 : 0)) ||
      (so?.allowedRecommendTypes.length ?? 0) > ((so?.canUseRecommendStore ? 1 : 0) + (so?.canUseRecommendProducts ? 1 : 0)) ||
      (so?.recentlyViewedEnabled && !so?.canUseRecentlyViewed) ||
      (so?.allowedInfoTypes.length ?? 0) > ((so?.canUseSocialMedia ? 1 : 0) + (so?.canUseContact ? 1 : 0) + (so?.canUseInteractiveMaps ? 1 : 0)) ||
      (so?.allowedQRResolutions.length ?? 0) > (so?.canUseQRCodes ? so?.allowedQRResolutions.length : 0) ||
      (so?.allowedGalleryTypes.length ?? 0) > ((so?.allowedGalleryTypes.filter(t => (so?.merchantPreferences?.[t as keyof typeof so.merchantPreferences] ?? false)).length)) ||
      (so?.allowedAdvancedTypes.length ?? 0) > ((so?.canUseEnhancedSEO ? 1 : 0) + (so?.canUseStorefrontActions ? 1 : 0))
    );

    // --- FAQ Options (no merchant prefs in state yet) ---
    const faq = cap.faqOptions;
    const faqTier = faq?.enabled ?? false;
    const faqMerchantGated = false;

    // --- CRM Options ---
    const crm = cap.crmOptions;
    const crmTier = crm?.crmAvailable ?? false;
    const crmMerchantGated = false;
    const crmDetailParts: string[] = [];
    if (crm?.allowedInquiryTypes.length) crmDetailParts.push('Inquiries');
    if (crm?.contactsEnabled) crmDetailParts.push('Contacts');
    if (crm?.ticketFeaturesEnabled) crmDetailParts.push('Tickets');
    if (crm?.customerTicketsEnabled) crmDetailParts.push('Customer Portal');
    if (crm?.dashboardEnabled) crmDetailParts.push('Dashboard');

    return [
      {
        key: "commerce",
        label: "Commerce",
        icon: <ShoppingCart className="w-4 h-4" />,
        enabled: cTier || !cMerchantGated,
        status: getStatus(cTier, cMerchantGated),
        detail: c?.effectivePaymentType === "none" ? "Disabled" : `Payments: ${c?.effectivePaymentType ?? c?.paymentType}`,
        settingsLink: `/t/${tenantId}/settings/commerce`,
      },
      {
        key: "paymentGateway",
        label: "Payment Gateways",
        icon: <CreditCard className="w-4 h-4" />,
        enabled: pgTier && (pg?.effectiveGateways.length ?? 0) > 0,
        status: getStatus(pgTier, pgMerchantGated),
        detail:
          (pg?.effectiveGateways ?? []).length > 0
            ? pg!.effectiveGateways.join(", ")
            : (pg?.allowedGateways ?? []).length > 0
              ? `${pg!.allowedGateways.join(", ")} (merchant off)`
              : "None connected",
        settingsLink: `/t/${tenantId}/settings/payment-gateways`,
      },
      {
        key: "storefront",
        label: "Storefront",
        icon: <Store className="w-4 h-4" />,
        enabled: sf?.effectiveType !== 'none',
        status: getStatus(sfTier, sfMerchantGated),
        detail: sf?.effectiveType && sf.effectiveType !== 'none'
          ? `Type: ${sf.effectiveType}`
          : sf?.type && sf.type !== 'none'
            ? `Type: ${sf.type} (merchant off)`
            : "Not configured",
        settingsLink: `/t/${tenantId}/settings/tenant`,
      },
      {
        key: "fulfillment",
        label: "Fulfillment",
        icon: <Truck className="w-4 h-4" />,
        enabled: flTier && (fl?.effectiveShowsPickup || fl?.effectiveShowsDelivery || fl?.effectiveShowsShipping),
        status: getStatus(flTier, flMerchantGated),
        detail: fl?.effectiveShowsPickup || fl?.effectiveShowsDelivery || fl?.effectiveShowsShipping
          ? [
              fl?.effectiveShowsPickup && 'Pickup',
              fl?.effectiveShowsDelivery && 'Delivery',
              fl?.effectiveShowsShipping && 'Shipping',
            ].filter(Boolean).join(', ') || 'Shipping / Pickup'
          : 'Not configured',
        settingsLink: `/t/${tenantId}/settings/fulfillment`,
      },
      {
        key: "barcodeScan",
        label: "Barcode Scan",
        icon: <Barcode className="w-4 h-4" />,
        enabled: bcTier && (bc?.effectiveModes.length ?? 0) > 0,
        status: getStatus(bcTier, bcMerchantGated),
        detail: bc?.effectiveModes.length ? `Modes: ${bc.effectiveModes.join(', ')}` : "Not available",
        settingsLink: `/t/${tenantId}/scan`,
      },
      {
        key: "productOptions",
        label: "Product Types",
        icon: <Package className="w-4 h-4" />,
        enabled: poTier && (po?.effectiveTypes.length ?? 0) > 0,
        status: getStatus(poTier, poMerchantGated),
        detail:
          (po?.effectiveTypes ?? []).length > 0
            ? po!.effectiveTypes.join(", ")
            : (po?.allowedTypes ?? []).length > 0
              ? `${po!.allowedTypes.join(", ")} (merchant off)`
              : "Standard",
        settingsLink: `/t/${tenantId}/items/create`,
      },
      {
        key: "integrationOptions",
        label: "Integrations",
        icon: <Globe className="w-4 h-4" />,
        enabled: ioTier && (io?.effectiveTypes.length ?? 0) > 0,
        status: getStatus(ioTier, ioMerchantGated),
        detail: (io?.effectiveTypes ?? []).length > 0
          ? "Connected"
          : (io?.allowedTypes ?? []).length > 0
            ? `${io!.allowedTypes.join(", ")} (merchant off)`
            : "Not configured",
        settingsLink: `/t/${tenantId}/settings/integrations`,
      },
      {
        key: "storefrontOptions",
        label: "Storefront Options",
        icon: <Settings className="w-4 h-4" />,
        enabled: soTier && soMerchantGated === false,
        status: getStatus(soTier, soMerchantGated),
        detail: soTier && !soMerchantGated ? "Customizable" : soTier ? "Partially disabled" : "Default",
        settingsLink: `/t/${tenantId}/settings/tenant`,
      },
      {
        key: "quickstartOptions",
        label: "Quick Start",
        icon: <Rocket className="w-4 h-4" />,
        enabled: qoTier && qoMerchantGated === false,
        status: getStatus(qoTier, qoMerchantGated),
        detail: qoTier && !qoMerchantGated ? "Active" : qoTier ? "Partially disabled" : "Not available",
        settingsLink: `/t/${tenantId}/quick-start`,
      },
      {
        key: "faqOptions",
        label: "FAQ",
        icon: <HelpCircle className="w-4 h-4" />,
        enabled: faqTier,
        status: getStatus(faqTier, faqMerchantGated),
        detail: faq?.faqAvailable
          ? `${[
            faq?.storefrontEnabled && 'Storefront',
            faq?.productEnabled && 'Product',
            faq?.templatesEnabled && 'Templates',
          ].filter(Boolean).join(', ') || 'Basic'} FAQs`
          : "Not available",
        settingsLink: `/t/${tenantId}/faq/options`,
      },
      {
        key: "crmOptions",
        label: "CRM",
        icon: <Users className="w-4 h-4" />,
        enabled: crmTier,
        status: getStatus(crmTier, crmMerchantGated),
        detail: crmTier
          ? (crmDetailParts.length > 0 ? crmDetailParts.join(', ') : 'Support Hub')
          : "Not available",
        settingsLink: `/t/${tenantId}/support`,
      },
    ];
  }, [capabilities, tenantId]);

  const enabledCount = rows.filter((r) => r.enabled).length;
  const totalCount = rows.length;

  if (!capabilities) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Your Capabilities</h3>
          <p className="text-xs text-gray-500">
            {enabledCount} of {totalCount} active
          </p>
        </div>
        {canUpgrade && (
          <Link
            href={`/t/${tenantId}/settings/subscription`}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <Lock className="w-3 h-3" />
            Unlock more
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <motion.div
            key={row.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + index * 0.03 }}
          >
            <Link
              href={row.settingsLink}
              className={`group flex items-center gap-3 p-2.5 rounded-xl transition-colors ${row.status === 'enabled'
                ? "hover:bg-gray-50"
                : row.status === 'merchant-gated'
                  ? "opacity-80 hover:opacity-100 hover:bg-amber-50/50"
                  : "opacity-60 hover:opacity-80 hover:bg-gray-50"
                }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  row.status === 'enabled'
                    ? "bg-indigo-50 text-indigo-600"
                    : row.status === 'merchant-gated'
                      ? "bg-amber-50 text-amber-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
              >
                {row.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {row.label}
                  </span>
                  {row.status === 'enabled' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : row.status === 'merchant-gated' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-gray-300" />
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{row.detail}</p>
              </div>

              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
