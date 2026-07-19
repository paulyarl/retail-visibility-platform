"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  MapPin,
  Bot,
  Share2,
  Layers,
  Sparkles,
  Link2,
  QrCode,
  Wrench,
  Image,
  Clock,
  Map,
  ChevronDown,
  ChevronUp,
  Filter,
  Tag,
} from "lucide-react";
import { AllCapabilitiesState } from "@/services/CapabilityResolutionService";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface CapabilityShowcaseProps {
  capabilities: AllCapabilitiesState | null;
  tenantId: string;
  canUpgrade: boolean;
  /** When true, capability rows render without clickable navigation links */
  readOnly?: boolean;
}

type CapabilityStatus = 'enabled' | 'merchant-gated' | 'tier-gated';

interface ConstraintWarning {
  message: string;
  severity: 'block' | 'warn' | 'info';
  resolutionHint?: string;
}

interface CapabilityRow {
  key: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  status: CapabilityStatus;
  detail: string;
  settingsLink: string;
  constraintWarning?: ConstraintWarning;
}

export default function CapabilityShowcase({
  capabilities,
  readOnly,
  tenantId,
  canUpgrade,
}: CapabilityShowcaseProps) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const INITIAL_COUNT = 5;
  const rows: CapabilityRow[] = useMemo(() => {
    if (!capabilities) return [];

    const getStatus = (tierEnabled: boolean, merchantGated: boolean): CapabilityStatus => {
      if (!tierEnabled) return 'tier-gated';
      if (merchantGated) return 'merchant-gated';
      return 'enabled';
    };

    const cap = capabilities;

    // Helper: find constraint violations for a capability (as source or target)
    const getConstraintWarning = (capabilityKey: string): ConstraintWarning | undefined => {
      const violations = cap.constraintViolations?.filter(
        v => v.sourceCapability === capabilityKey || v.targetCapability === capabilityKey
      );
      if (!violations || violations.length === 0) return undefined;
      // Prioritize block severity
      const block = violations.find(v => v.severity === 'block');
      const chosen = block || violations[0];
      return {
        message: chosen.message,
        severity: chosen.severity,
        resolutionHint: chosen.resolutionHint,
      };
    };

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

    // --- Product Types ---
    const pt = cap.productType;
    const ptTier = pt?.enabled ?? false;
    const ptMerchantGated = ptTier && (pt?.effectiveTypes.length ?? 0) === 0;

    // --- Product Options (creation features) ---
    const po = cap.productOptions;
    const poTier = po?.enabled ?? false;
    const poMerchantGated = poTier && (
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
      (so?.allowedCategoryTypes.length ?? 0) > ((so?.canUseCategoryStore ? 1 : 0) + (so?.canUseCategoryProduct ? 1 : 0)) ||
      (so?.allowedRecommendTypes.length ?? 0) > ((so?.canUseRecommendStore ? 1 : 0) + (so?.canUseRecommendProducts ? 1 : 0)) ||
      (so?.recentlyViewedEnabled && !so?.canUseRecentlyViewed) ||
      (so?.allowedInfoTypes.length ?? 0) > ((so?.canUseSocialMedia ? 1 : 0) + (so?.canUseContact ? 1 : 0)) ||
      (so?.allowedAdvancedTypes.length ?? 0) > ((so?.canUseEnhancedSEO ? 1 : 0) + (so?.canUseStorefrontActions ? 1 : 0))
    );

    // --- Storefront QR ---
    const sqr = cap.storefrontQr;
    const sqrTier = sqr?.enabled ?? false;
    const sqrMerchantGated = sqrTier && !sqr?.canUseQRCodes;

    // --- Storefront Gallery ---
    const sgal = cap.storefrontGallery;
    const sgalTier = sgal?.enabled ?? false;
    const sgalMerchantGated = sgalTier && !sgal?.canUseGallery;

    // --- Storefront Hours ---
    const sh = cap.storefrontHours;
    const shTier = sh?.enabled ?? false;
    const shMerchantGated = shTier && !sh?.canShowHoursDisplay;
    const shDetailParts: string[] = [];
    if (sh?.canShowHoursDisplay) shDetailParts.push('Display');
    if (sh?.canUseAnimatedHours) shDetailParts.push('Animated');
    if (sh?.canShowHoursStatus) shDetailParts.push('Status');

    // --- Storefront Maps ---
    const sm = cap.storefrontMaps;
    const smTier = sm?.enabled ?? false;
    const smMerchantGated = smTier && !sm?.canUseInteractiveMaps;
    const smDetailParts: string[] = [];
    if (sm?.canUseInteractiveMaps) smDetailParts.push('Interactive');
    if (sm?.canShowMapDisplay) smDetailParts.push('Map Display');
    if (sm?.canShowLocationDisplay) smDetailParts.push('Location');

    // --- FAQ Options ---
    // FAQ only has a master toggle merchant pref (faq_enabled), no per-feature merchant prefs.
    // So there is no per-feature merchant gating — badge is either Enabled or Off.
    const faq = cap.faqOptions;
    const faqTier = faq?.enabled ?? false;
    const faqMerchantGated = false;

    // --- Directory Entry ---
    const de = cap.directoryEntryOptions;
    const deTier = de?.enabled ?? false;
    const deAllowedCount = (de?.allowedLayouts.length ?? 0) + (de?.hoursEnabled ? 1 : 0) + (de?.mapEnabled ? 1 : 0) + (de?.contactEnabled ? 1 : 0) + (de?.galleryEnabled ? 1 : 0) + (de?.qrEnabled ? 1 : 0) + (de?.socialEnabled ? 1 : 0) + (de?.seoEnabled ? 1 : 0) + (de?.canShowExternalLink ? 1 : 0);
    const deEffectiveCount = (de?.hoursEnabled ? 1 : 0) + (de?.mapEnabled ? 1 : 0) + (de?.contactEnabled ? 1 : 0) + (de?.galleryEnabled ? 1 : 0) + (de?.qrEnabled ? 1 : 0) + (de?.socialEnabled ? 1 : 0) + (de?.seoEnabled ? 1 : 0) + (de?.externalLinkEnabled ? 1 : 0);
    const deMerchantGated = deTier && deEffectiveCount < deAllowedCount;
    const deDetailParts: string[] = [];
    if (de?.hoursEnabled) deDetailParts.push('Hours');
    if (de?.mapEnabled) deDetailParts.push('Map');
    if (de?.contactEnabled) deDetailParts.push('Contact');
    if (de?.galleryEnabled) deDetailParts.push('Gallery');
    if (de?.qrEnabled) deDetailParts.push('QR');
    if (de?.socialEnabled) deDetailParts.push('Social');
    if (de?.seoEnabled) deDetailParts.push('SEO');
    if (de?.externalLinkEnabled) deDetailParts.push('External Link');

    // --- CRM Options ---
    // CRM only has a master toggle merchant pref (crm_enabled), no per-feature merchant prefs.
    // So there is no per-feature merchant gating — badge is either Enabled or Off.
    const crm = cap.crmOptions;
    const crmTier = crm?.enabled ?? false;
    const crmMerchantGated = false;
    const crmDetailParts: string[] = [];
    if (crm?.allowedInquiryTypes.length) crmDetailParts.push('Inquiries');
    if (crm?.allowedContactTypes.length) crmDetailParts.push('Contacts');
    if (crm?.allowedTicketTypes.length) crmDetailParts.push('Tickets');
    if (crm?.allowedMessageTypes.length) crmDetailParts.push('Messages');
    if (crm?.allowedCustomerTicketTypes.length) crmDetailParts.push('Customer Portal');
    if (crm?.allowedDashboardTypes.length) crmDetailParts.push('Dashboard');

    // --- Chatbot Options ---
    // Chatbot has per-feature merchant prefs (chatbot_static_enabled, etc.).
    // Effective flags (staticEnabled, dynamicEnabled, etc.) already incorporate merchant prefs.
    // Compare group-level allowed vs effective to detect merchant gating.
    const cb = cap.chatbotOptions;
    const cbTier = cb?.enabled ?? false;
    const cbAllowedCount = (cb?.allowedResponseEngines.length > 0 ? 2 : 0) + (cb?.allowedSkillTypes.length > 0 ? 1 : 0) + (cb?.allowedKbTypes.length > 0 ? 1 : 0) + (cb?.allowedWidgetTypes.length > 0 ? 1 : 0);
    const cbEffectiveCount = (cb?.staticEnabled ? 1 : 0) + (cb?.dynamicEnabled ? 1 : 0) + (cb?.skillsEnabled ? 1 : 0) + (cb?.kbEnabled ? 1 : 0) + (cb?.widgetEnabled ? 1 : 0);
    const cbMerchantGated = cbTier && cbEffectiveCount < cbAllowedCount;
    const cbDetailParts: string[] = [];
    if (cb?.allowedResponseEngines.length) { cbDetailParts.push('Static FAQ'); cbDetailParts.push('Dynamic AI'); }
    if (cb?.allowedSkillTypes.length) cbDetailParts.push('Skills');
    if (cb?.allowedKbTypes.length) cbDetailParts.push('Knowledge Base');
    if (cb?.allowedWidgetTypes.length) cbDetailParts.push('Widget');

    // --- Social Commerce Options ---
    const scc = cap.socialCommerceOptions;
    const sccTier = scc?.enabled ?? false;
    const sccMerchantGated = sccTier && (
      (scc?.allowedMetaTypes.length ?? 0) > 0 && !scc?.canUseMetaCatalog && !scc?.canUseMetaShop && !scc?.canUseMetaPixel && !scc?.metaEnabled ||
      (scc?.allowedTikTokTypes.length ?? 0) > 0 && !scc?.canUseTikTokCatalog && !scc?.canUseTikTokShop && !scc?.canUseTikTokPixel && !scc?.tiktokEnabled ||
      (scc?.allowedExperienceTypes.length ?? 0) > 0 && !scc?.canUseShareButtons && !scc?.canUseSocialProof && !scc?.canUseAbandonedCart
    );
    const sccDetailParts: string[] = [];
    if ((scc?.allowedMetaTypes.length ?? 0) > 0) sccDetailParts.push('Meta');
    if ((scc?.allowedTikTokTypes.length ?? 0) > 0) sccDetailParts.push('TikTok');
    if (scc?.canUseShareButtons) sccDetailParts.push('Share');
    if (scc?.canUseSocialProof) sccDetailParts.push('Social Proof');
    if (scc?.canUseAbandonedCart) sccDetailParts.push('Abandoned Cart');

    // --- Directory Promotion ---
    const dp = cap.directoryPromotion;
    const dpTier = dp?.enabled ?? false;
    const dpMerchantGated = false;
    const dpDetailParts: string[] = [];
    if (dp?.allowedTiers.includes('basic')) dpDetailParts.push('Basic');
    if (dp?.allowedTiers.includes('premium')) dpDetailParts.push('Premium');
    if (dp?.allowedTiers.includes('featured')) dpDetailParts.push('Featured');

    // --- Platform Services ---
    const ps = cap.platformServices;
    const psEnabled = ps?.enabled ?? false;
    const psDetailParts: string[] = [];
    if (ps?.canUseLogoDesign) psDetailParts.push('Logo Design');
    if (ps?.canUseBannerDesign) psDetailParts.push('Banner Design');
    if (ps?.canUseStoreSetup) psDetailParts.push('Store Setup');
    if (ps?.canUseProfileSetup) psDetailParts.push('Profile Setup');
    if (ps?.canUseSeoOptimization) psDetailParts.push('SEO');
    if (ps?.canUseSocialMediaKit) psDetailParts.push('Social Media Kit');

    // --- Wholesale Matching ---
    const wm = cap.wholesaleMatching;
    const wmTier = wm?.enabled ?? false;
    const wmMerchantGated = false;
    const wmDetailParts: string[] = [];
    if (wm?.canCheckSupplierMatch) wmDetailParts.push('Supplier Match');
    if (wm?.canSearchFaire) wmDetailParts.push('Faire Search');
    if (wm?.canBuildAffiliateLink) wmDetailParts.push('Affiliate Links');
    if (wm?.canViewBrandPartners) wmDetailParts.push('Brand Partners');

    // --- Funnel Options ---
    const fn = cap.funnel;
    const fnTier = fn?.enabled ?? false;
    const fnBuilderEnabled = fn?.builderEnabled ?? false;
    const fnDetailParts: string[] = [];
    if (fn?.canUseOrderBump) fnDetailParts.push('Order Bump');
    if (fn?.canUseUpsell) fnDetailParts.push('Upsell');
    if (fn?.canUseDownsell) fnDetailParts.push('Downsell');
    if (fn?.canUseOto) fnDetailParts.push('OTO');

    // --- Coupon Options ---
    const cp = cap.couponOptions;
    const cpTier = cp?.enabled ?? false;
    const cpMerchantGated = false;
    const cpDetailParts: string[] = [];
    if (cp?.canUsePercentOff) cpDetailParts.push('Percent Off');
    if (cp?.canUseFixedAmount) cpDetailParts.push('Fixed Amount');
    if (cp?.canUseFreeShipping) cpDetailParts.push('Free Shipping');
    if (cp?.canUseBogo) cpDetailParts.push('BOGO');
    if (cp?.canTargetProducts) cpDetailParts.push('Targeted');
    if (cp?.canSetLimits) cpDetailParts.push('Limits');
    if (cp?.canViewAnalytics) cpDetailParts.push('Analytics');
    if (cp?.canUseQrSharing) cpDetailParts.push('QR Sharing');
    if (cp?.canUseSpotlight) cpDetailParts.push('Spotlight');

    return [
      {
        key: "commerce",
        label: "Commerce",
        icon: <ShoppingCart className="w-4 h-4" />,
        enabled: cTier || !cMerchantGated,
        status: getStatus(cTier, cMerchantGated),
        detail: c?.effectivePaymentType === "none" ? "Disabled" : `Payments: ${c?.effectivePaymentType ?? c?.paymentType}`,
        settingsLink: `/t/${tenantId}/settings/commerce`,
        constraintWarning: getConstraintWarning('commerce'),
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
        constraintWarning: getConstraintWarning('payment_gateway'),
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
        constraintWarning: getConstraintWarning('storefront'),
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
        constraintWarning: getConstraintWarning('fulfillment'),
      },
      {
        key: "barcodeScan",
        label: "Barcode Scan",
        icon: <Barcode className="w-4 h-4" />,
        enabled: bcTier && (bc?.effectiveModes.length ?? 0) > 0,
        status: getStatus(bcTier, bcMerchantGated),
        detail: bc?.effectiveModes.length ? `Modes: ${bc.effectiveModes.join(', ')}` : "Not available",
        settingsLink: `/t/${tenantId}/scan`,
        constraintWarning: getConstraintWarning('barcode_scan'),
      },
      {
        key: "productTypes",
        label: "Product Types",
        icon: <Package className="w-4 h-4" />,
        enabled: ptTier && (pt?.effectiveTypes.length ?? 0) > 0,
        status: getStatus(ptTier, ptMerchantGated),
        detail:
          (pt?.effectiveTypes.length ?? 0) > 0
            ? pt!.effectiveTypes.join(", ")
            : pt?.allowedTypes.length
              ? `${pt!.allowedTypes.join(", ")} (merchant off)`
              : "Standard",
        settingsLink: `/t/${tenantId}/settings/product-types`,
        constraintWarning: getConstraintWarning('product_types'),
      },
      {
        key: "productOptions",
        label: "Creation Features",
        icon: <Layers className="w-4 h-4" />,
        enabled: poTier,
        status: getStatus(poTier, poMerchantGated),
        detail: poTier
          ? [
              ...(po?.effectiveShowsVariants ? ["Variants"] : []),
              ...(po?.effectiveShowsGallery ? ["Gallery"] : []),
              ...(po?.effectiveShowsVideo ? ["Video"] : []),
              ...(po?.effectiveShowsSupplierCatalog ? ["Supplier Catalog"] : []),
            ].join(", ") || "Basic"
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/product-options`,
        constraintWarning: getConstraintWarning('product_options'),
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
        constraintWarning: getConstraintWarning('integration_options'),
      },
      {
        key: "storefrontOptions",
        label: "Storefront Options",
        icon: <Settings className="w-4 h-4" />,
        enabled: soTier && soMerchantGated === false,
        status: getStatus(soTier, soMerchantGated),
        detail: soTier && !soMerchantGated ? "Customizable" : soTier ? "Partially disabled" : "Default",
        settingsLink: `/t/${tenantId}/settings/tenant`,
        constraintWarning: getConstraintWarning('storefront_options'),
      },
      {
        key: "magazineGallery",
        label: "Magazine Gallery",
        icon: <Image className="w-4 h-4" />,
        enabled: sgal?.canUseMagazineGallery ?? false,
        status: getStatus(sgal?.canUseMagazineGallery ?? false, sgal?.galleryDisplayMode === 'magazine' && !sgal?.canUseMagazineGallery),
        detail: sgal?.canUseMagazineGallery
          ? (sgal?.galleryDisplayMode === 'magazine' ? "Magazine mode active" : "Available — enable in settings")
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/storefront-gallery`,
      },
      {
        key: "storefrontQr",
        label: "QR Codes",
        icon: <QrCode className="w-4 h-4" />,
        enabled: sqrTier && (sqr?.canUseQRCodes ?? false),
        status: getStatus(sqrTier, sqrMerchantGated),
        detail: sqrTier
          ? (sqr?.qrStyledEnabled ? "Styled QR enabled" : sqr?.qrClassicEnabled ? "Classic QR" : "Available")
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/storefront-qr`,
        constraintWarning: getConstraintWarning('storefront_qr'),
      },
      {
        key: "storefrontGallery",
        label: "Image Gallery",
        icon: <Image className="w-4 h-4" />,
        enabled: sgalTier && (sgal?.canUseGallery ?? false),
        status: getStatus(sgalTier, sgalMerchantGated),
        detail: sgalTier
          ? (sgal?.canUseMagazineGallery ? "Magazine mode" : sgal?.galleryCarouselEnabled ? "Carousel mode" : "Available")
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/storefront-gallery`,
        constraintWarning: getConstraintWarning('storefront_gallery'),
      },
      {
        key: "storefrontHours",
        label: "Business Hours",
        icon: <Clock className="w-4 h-4" />,
        enabled: shTier && (sh?.canShowHoursDisplay ?? false),
        status: getStatus(shTier, shMerchantGated),
        detail: shTier
          ? (shDetailParts.length > 0 ? shDetailParts.join(', ') : 'Available')
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/storefront-hours`,
        constraintWarning: getConstraintWarning('storefront_hours'),
      },
      {
        key: "storefrontMaps",
        label: "Storefront Maps",
        icon: <Map className="w-4 h-4" />,
        enabled: smTier && (sm?.canUseInteractiveMaps ?? false),
        status: getStatus(smTier, smMerchantGated),
        detail: smTier
          ? (smDetailParts.length > 0 ? smDetailParts.join(', ') : 'Available')
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/storefront-maps`,
        constraintWarning: getConstraintWarning('storefront_maps'),
      },
      {
        key: "quickstartOptions",
        label: "Quick Start",
        icon: <Rocket className="w-4 h-4" />,
        enabled: qoTier && qoMerchantGated === false,
        status: getStatus(qoTier, qoMerchantGated),
        detail: qoTier && !qoMerchantGated ? "Active" : qoTier ? "Partially disabled" : "Not available",
        settingsLink: `/t/${tenantId}/quick-start`,
        constraintWarning: getConstraintWarning('quickstart'),
      },
      {
        key: "faqOptions",
        label: "FAQ",
        icon: <HelpCircle className="w-4 h-4" />,
        enabled: faqTier,
        status: getStatus(faqTier, faqMerchantGated),
        detail: faqTier
          ? `${[
            faq?.storefrontEnabled && 'Storefront',
            faq?.productEnabled && 'Product',
            faq?.templatesEnabled && 'Templates',
            faq?.allowedManagementTypes.length && 'Management',
            faq?.allowedPreviewTypes.length && 'Preview',
            faq?.allowedDisplayTypes.length && 'Display',
            faq?.allowedKbTypes.length && 'KB',
          ].filter(Boolean).join(', ') || 'Basic'} FAQs`
          : "Not available",
        settingsLink: `/t/${tenantId}/faq/options`,
        constraintWarning: getConstraintWarning('faq'),
      },
      {
        key: "directoryEntry",
        label: "Directory Entry",
        icon: <MapPin className="w-4 h-4" />,
        enabled: deTier && (de?.allowedLayouts.length ?? 0) > 0,
        status: getStatus(deTier, deMerchantGated),
        detail: deTier
          ? `${de?.effectiveLayout ?? 'classic'} layout${deDetailParts.length > 0 ? ` · ${deDetailParts.join(', ')}` : ''}`
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/directory`,
        constraintWarning: getConstraintWarning('directory_entry'),
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
        constraintWarning: getConstraintWarning('crm'),
      },
      {
        key: "chatbotOptions",
        label: "Chatbot",
        icon: <Bot className="w-4 h-4" />,
        enabled: cbTier,
        status: getStatus(cbTier, cbMerchantGated),
        detail: cbTier
          ? (cbDetailParts.length > 0 ? cbDetailParts.join(', ') : 'AI Assistant')
          : "Not available",
        settingsLink: `/t/${tenantId}/bot/options`,
        constraintWarning: getConstraintWarning('chatbot'),
      },
      {
        key: "socialCommerceOptions",
        label: "Social Commerce",
        icon: <Share2 className="w-4 h-4" />,
        enabled: sccTier,
        status: getStatus(sccTier, sccMerchantGated),
        detail: sccTier
          ? (sccDetailParts.length > 0 ? sccDetailParts.join(', ') : 'Social Commerce')
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/social-commerce`,
        constraintWarning: getConstraintWarning('social_commerce_options'),
      },
      {
        key: "directoryPromotion",
        label: "Directory Promotion",
        icon: <Sparkles className="w-4 h-4" />,
        enabled: dpTier && (dp?.allowedTiers.length ?? 0) > 0,
        status: getStatus(dpTier, dpMerchantGated),
        detail: dpTier
          ? (dpDetailParts.length > 0 ? `${dpDetailParts.join(', ')} tiers` : 'Available')
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/promotion`,
        constraintWarning: getConstraintWarning('directory_promotion'),
      },
      {
        key: "wholesaleMatching",
        label: "Wholesale Matching",
        icon: <Link2 className="w-4 h-4" />,
        enabled: wmTier,
        status: getStatus(wmTier, wmMerchantGated),
        detail: wmTier
          ? (wmDetailParts.length > 0 ? wmDetailParts.join(', ') : 'Available')
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/wholesale`,
        constraintWarning: getConstraintWarning('wholesale_matching'),
      },
      {
        key: "platformServices",
        label: "Platform Services",
        icon: <Wrench className="w-4 h-4" />,
        enabled: psEnabled,
        status: psEnabled ? "enabled" : "tier-gated",
        detail: psEnabled
          ? (psDetailParts.length > 0 ? psDetailParts.join(', ') : 'Available')
          : "No services purchased",
        settingsLink: `/t/${tenantId}/settings/feature-store`,
      },
      {
        key: "funnel",
        label: "Sales Funnels",
        icon: <Filter className="w-4 h-4" />,
        enabled: fnTier && fnBuilderEnabled,
        status: fnTier && fnBuilderEnabled ? "enabled" : "tier-gated",
        detail: fnTier && fnBuilderEnabled
          ? (fnDetailParts.length > 0 ? fnDetailParts.join(', ') : 'Builder ready')
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/funnels`,
        constraintWarning: getConstraintWarning('funnel'),
      },
      {
        key: "couponOptions",
        label: "Coupons",
        icon: <Tag className="w-4 h-4" />,
        enabled: cpTier,
        status: getStatus(cpTier, cpMerchantGated),
        detail: cpTier
          ? (cpDetailParts.length > 0 ? cpDetailParts.join(', ') : 'Available')
          : "Not available",
        settingsLink: `/t/${tenantId}/settings/coupon-options`,
        constraintWarning: getConstraintWarning('coupon_options'),
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
        {rows.slice(0, INITIAL_COUNT).map((row, index) => (
          <motion.div
            key={row.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + index * 0.03 }}
          >
            <div
              className={`group flex items-center gap-3 p-2.5 rounded-xl ${readOnly ? '' : 'transition-colors cursor-pointer '}${row.status === 'enabled'
                ? "hover:bg-gray-50"
                : row.status === 'merchant-gated'
                  ? "opacity-80 hover:opacity-100 hover:bg-amber-50/50"
                  : "opacity-60 hover:opacity-80 hover:bg-gray-50"
                }`}
              onClick={readOnly ? undefined : () => router.push(row.settingsLink)}
              role={readOnly ? undefined : 'link'}
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
                  {row.constraintWarning && (
                    row.constraintWarning.severity === 'block'
                      ? <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{row.detail}</p>
                {row.constraintWarning && (
                  <p className={`text-xs truncate ${row.constraintWarning.severity === 'block' ? 'text-red-600' : 'text-amber-600'}`}>
                    {row.constraintWarning.message}
                  </p>
                )}
              </div>

              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
            </div>
          </motion.div>
        ))}

        {showAll && rows.slice(INITIAL_COUNT).map((row, index) => (
          <motion.div
            key={row.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <div
              className={`group flex items-center gap-3 p-2.5 rounded-xl ${readOnly ? '' : 'transition-colors cursor-pointer '}${row.status === 'enabled'
                ? "hover:bg-gray-50"
                : row.status === 'merchant-gated'
                  ? "opacity-80 hover:opacity-100 hover:bg-amber-50/50"
                  : "opacity-60 hover:opacity-80 hover:bg-gray-50"
                }`}
              onClick={readOnly ? undefined : () => router.push(row.settingsLink)}
              role={readOnly ? undefined : 'link'}
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
                  {row.constraintWarning && (
                    row.constraintWarning.severity === 'block'
                      ? <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{row.detail}</p>
                {row.constraintWarning && (
                  <p className={`text-xs truncate ${row.constraintWarning.severity === 'block' ? 'text-red-600' : 'text-amber-600'}`}>
                    {row.constraintWarning.message}
                  </p>
                )}
              </div>

              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
            </div>
          </motion.div>
        ))}
      </div>

      {rows.length > INITIAL_COUNT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
        >
          {showAll ? (
            <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>Show {rows.length - INITIAL_COUNT} more <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      )}
    </motion.div>
  );
}
