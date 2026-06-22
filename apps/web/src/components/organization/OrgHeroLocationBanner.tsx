"use client";

import { motion } from "framer-motion";
import { Crown, Pencil } from "lucide-react";
import { Button } from "@mantine/core";
import { Badge } from "@/components/ui/Badge";
import type { OrganizationData } from "./types";

interface OrgHeroLocationBannerProps {
  heroLocation?: OrganizationData["locationBreakdown"][0];
  onChangeHero: () => void;
}

export default function OrgHeroLocationBanner({
  heroLocation,
  onChangeHero,
}: OrgHeroLocationBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-900/20 dark:via-yellow-900/20 dark:to-amber-900/20 border-2 border-amber-400 dark:border-amber-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl shadow-lg">
              <Crown className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="warning" className="text-xs font-bold">
                  HERO LOCATION
                </Badge>
                <Badge variant="default" className="text-xs">
                  Master Catalog
                </Badge>
              </div>
              {heroLocation ? (
                <>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {heroLocation.tenantName}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {heroLocation.skuCount.toLocaleString()} products • Source for chain-wide distribution
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    No Hero Location Set
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select your master catalog location to enable bulk sync
                  </p>
                </>
              )}
            </div>
          </div>
          <Button
            variant="gradient"
            style={{ color: "white" }}
            size="lg"
            onClick={onChangeHero}
            className="flex items-center gap-2"
            leftSection={<Pencil className="w-4 h-4" />}
          >
            {heroLocation ? "Change Hero" : "Set Hero Location"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
