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
  CheckCircle2,
  XCircle,
  Lock,
  ArrowRight,
} from "lucide-react";
import { AllCapabilitiesState } from "@/services/CapabilityResolutionService";

interface CapabilityShowcaseProps {
  capabilities: AllCapabilitiesState | null;
  tenantId: string;
  canUpgrade: boolean;
}

interface CapabilityRow {
  key: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
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

    return [
      {
        key: "commerce",
        label: "Commerce",
        icon: <ShoppingCart className="w-4 h-4" />,
        enabled: capabilities.commerce?.enabled ?? false,
        detail:
          capabilities.commerce?.paymentType === "none"
            ? "Disabled"
            : `Payments: ${capabilities.commerce?.paymentType}`,
        settingsLink: `/t/${tenantId}/settings/commerce`,
      },
      {
        key: "paymentGateway",
        label: "Payment Gateways",
        icon: <CreditCard className="w-4 h-4" />,
        enabled: capabilities.paymentGateway?.enabled ?? false,
        detail:
          (capabilities.paymentGateway?.allowedGateways ?? []).length > 0
            ? capabilities.paymentGateway!.allowedGateways.join(", ")
            : "None connected",
        settingsLink: `/t/${tenantId}/settings/payment-gateways`,
      },
      {
        key: "storefront",
        label: "Storefront",
        icon: <Store className="w-4 h-4" />,
        enabled: capabilities.storefront?.enabled ?? false,
        detail: capabilities.storefront?.type
          ? `Type: ${capabilities.storefront.type}`
          : "Not configured",
        settingsLink: `/t/${tenantId}/settings/tenant`,
      },
      {
        key: "fulfillment",
        label: "Fulfillment",
        icon: <Truck className="w-4 h-4" />,
        enabled: capabilities.fulfillment?.enabled ?? false,
        detail: capabilities.fulfillment?.showsPickup
          ? "Pickup enabled"
          : "Shipping / Pickup",
        settingsLink: `/t/${tenantId}/settings/fulfillment`,
      },
      {
        key: "barcodeScan",
        label: "Barcode Scan",
        icon: <Barcode className="w-4 h-4" />,
        enabled: capabilities.barcodeScan?.enabled ?? false,
        detail: capabilities.barcodeScan?.enabled ? "Active" : "Not available",
        settingsLink: `/t/${tenantId}/scan`,
      },
      {
        key: "productOptions",
        label: "Product Types",
        icon: <Package className="w-4 h-4" />,
        enabled: capabilities.productOptions?.enabled ?? false,
        detail:
          (capabilities.productOptions?.allowedTypes ?? []).length > 0
            ? capabilities.productOptions!.allowedTypes.join(", ")
            : "Standard",
        settingsLink: `/t/${tenantId}/items/create`,
      },
      {
        key: "integrationOptions",
        label: "Integrations",
        icon: <Globe className="w-4 h-4" />,
        enabled: capabilities.integrationOptions?.enabled ?? false,
        detail: capabilities.integrationOptions?.enabled
          ? "Connected"
          : "Not configured",
        settingsLink: `/t/${tenantId}/settings/integrations`,
      },
      {
        key: "storefrontOptions",
        label: "Storefront Options",
        icon: <Settings className="w-4 h-4" />,
        enabled: capabilities.storefrontOptions?.enabled ?? false,
        detail: capabilities.storefrontOptions?.enabled
          ? "Customizable"
          : "Default",
        settingsLink: `/t/${tenantId}/settings/tenant`,
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
              className={`group flex items-center gap-3 p-2.5 rounded-xl transition-colors ${row.enabled
                  ? "hover:bg-gray-50"
                  : "opacity-60 hover:opacity-80 hover:bg-gray-50"
                }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${row.enabled
                    ? "bg-indigo-50 text-indigo-600"
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
                  {row.enabled ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
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
