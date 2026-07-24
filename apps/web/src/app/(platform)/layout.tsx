import React from "react";
import type { Metadata } from "next";
import AppShell from "@/components/app-shell/AppShell";
import { PlatformSettingsProvider } from "@/contexts/PlatformSettingsContext";

// Prevent static generation for all platform routes (Mantine requires dynamic rendering)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'VisibleShelf - Local Retail Visibility Platform',
  description:
    'Make every local shelf visible online. VisibleShelf connects your inventory to Google Shopping, your storefront, and our business directory.',
  openGraph: {
    title: 'VisibleShelf - Local Retail Visibility Platform',
    description:
      'Make every local shelf visible online. Connect your inventory to Google Shopping, your storefront, and our business directory.',
    type: 'website',
    images: [{ url: '/favicon.ico' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VisibleShelf - Local Retail Visibility Platform',
    description:
      'Make every local shelf visible online. Connect your inventory to Google Shopping, your storefront, and our business directory.',
    images: [{ url: '/favicon.ico' }],
  },
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformSettingsProvider>
      <AppShell>{children}</AppShell>
    </PlatformSettingsProvider>
  );
}
