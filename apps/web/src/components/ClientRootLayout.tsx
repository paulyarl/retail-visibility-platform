"use client";

import * as React from "react";
import { QueryClientWrapper } from "@/components/QueryClientWrapper";
import dynamic from "next/dynamic";
import { PlatformThemeProvider } from "@/contexts/PlatformThemeProvider";
import { PlatformSettingsProvider } from "@/contexts/PlatformSettingsContext";
import { AuthProvider as CustomAuthProvider } from "@/contexts/AuthContext";
import { CartWidgetProvider } from "@/contexts/CartWidgetContext";
import { ProductLayoutProvider } from "@/contexts/ProductLayoutContext";
import { GlobalAlertProvider } from "@/components/ui/GlobalAlertProvider";
import { UniversalProvider } from "@/providers/UniversalProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import { FloatingCartWidget } from "@/components/cart/FloatingCartWidget";
import { Notifications } from "@mantine/notifications";

interface ClientRootLayoutProps {
  children: React.ReactNode;
}

export function ClientRootLayout({ children }: ClientRootLayoutProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <QueryClientWrapper>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </QueryClientWrapper>
    );
  }

  const ThemeProvider = dynamic(
    () => import("@/components/ThemeProvider").then((mod) => mod.ThemeProvider),
    { ssr: false }
  );

  return (
    <QueryClientWrapper>
      <ThemeProvider>
        <PlatformThemeProvider>
          <PlatformSettingsProvider>
            <CustomAuthProvider>
              <CartWidgetProvider>
                <ProductLayoutProvider>
                  <GlobalAlertProvider>
                    <UniversalProvider>
                      <Notifications position="top-right" />
                      <ErrorBoundary>
                        {children}
                      </ErrorBoundary>
                      <FloatingCartWidget />
                    </UniversalProvider>
                  </GlobalAlertProvider>
                </ProductLayoutProvider>
              </CartWidgetProvider>
            </CustomAuthProvider>
          </PlatformSettingsProvider>
        </PlatformThemeProvider>
      </ThemeProvider>
    </QueryClientWrapper>
  );
}
