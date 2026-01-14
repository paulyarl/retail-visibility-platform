import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// import { Analytics } from "@vercel/analytics/react"; // Disabled - not configured in Vercel
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PlatformSettingsProvider } from "@/contexts/PlatformSettingsContext";
import { AuthProvider as CustomAuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { CartWidgetProvider } from "@/contexts/CartWidgetContext";
import DynamicFavicon from "@/components/DynamicFavicon";
import { QueryClientWrapper } from "@/components/QueryClientWrapper";
import { GlobalAlertProvider } from "@/components/ui/GlobalAlertProvider";
import { FloatingCartWidget } from "@/components/cart/FloatingCartWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
  preload: false, // Disable preload to avoid connection issues
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  fallback: ["Monaco", "Menlo", "Consolas", "Liberation Mono", "Courier New", "monospace"],
  preload: false, // Disable preload to avoid connection issues
});

export const metadata: Metadata = {
  title: "Visible Shelf",
  description: "Retail visibility platform empowering local businesses with AI-powered inventory management, automated product enrichment, Google Business Profile sync, customizable digital storefronts, and a public directory connecting customers to local merchants—all designed to increase discoverability and drive sales.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <DynamicFavicon />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh bg-white text-neutral-900`}
        suppressHydrationWarning
      >
        <QueryClientWrapper>
          <PlatformSettingsProvider>
            <CustomAuthProvider>
              <CartProvider>
                <CartWidgetProvider>
                  <GlobalAlertProvider>
                    <ErrorBoundary>
                      {children}
                    </ErrorBoundary>
                    <FloatingCartWidget />
                  </GlobalAlertProvider>
                </CartWidgetProvider>
              </CartProvider>
            </CustomAuthProvider>
          </PlatformSettingsProvider>
        </QueryClientWrapper>
        {/* <Analytics /> */}
      </body>
    </html>
  );
}
