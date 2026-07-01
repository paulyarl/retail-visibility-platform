"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { Button } from "@mantine/core";

interface OrgCommerceCardProps {
  organizationId: string;
  readOnly?: boolean;
}

export default function OrgCommerceCard({ organizationId, readOnly }: OrgCommerceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Commerce Settings</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure payment options and order settings for all locations
              </p>
            </div>
          </div>
          <Link href={readOnly ? "#" : `/settings/organization/commerce?organizationId=${organizationId}`}>
            <Button variant="light" size="sm" rightSection={<ArrowRight className="w-4 h-4" />} disabled={readOnly}>
              Configure
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
