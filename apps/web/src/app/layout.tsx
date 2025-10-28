import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// import { Analytics } from "@vercel/analytics/react"; // Disabled - not configured in Vercel
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PlatformSettingsProvider } from "@/contexts/PlatformSettingsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import DynamicFavicon from "@/components/DynamicFavicon";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Retail Visibility MVP",
  description: "Inventory visibility for local retailers (Admin + Storefront)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <DynamicFavicon />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh bg-white text-neutral-900`}
      >
        <PlatformSettingsProvider>
          <AuthProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
          </AuthProvider>
        </PlatformSettingsProvider>
        {/* <Analytics /> */}
      </body>
    </html>
  );
}
