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
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import { UniversalProvider } from "@/providers/UniversalProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import GlobalErrorHandler from "@/components/GlobalErrorHandler";
import { FloatingCartWidget } from "@/components/cart/FloatingCartWidget";
import { CommandPalette } from "@/components/app-shell/CommandPalette";
import { Notifications } from "@mantine/notifications";
import { Toaster } from "@/components/ui/Toaster";
import type { ServerResolvedAuth } from "@/components/tenant/ServerResolvedContextProvider";

const ThemeProvider = dynamic(
  () => import("@/components/ThemeProvider").then((mod) => mod.ThemeProvider),
  { ssr: false }
);

interface ClientRootLayoutProps {
  children: React.ReactNode;
  initialUser?: ServerResolvedAuth['user'] | null;
}

export function ClientRootLayout({ children, initialUser }: ClientRootLayoutProps) {
  return (
    <QueryClientWrapper>
      <ThemeProvider>
        <PlatformThemeProvider>
          <CustomAuthProvider initialUser={initialUser}>
            <PlatformSettingsProvider>
              <CartWidgetProvider>
                <ProductLayoutProvider>
                  <GlobalAlertProvider>
                    <CustomerAuthProvider>
                      <UniversalProvider>
                        <Notifications position="top-right" />
                        <Toaster />
                        <GlobalErrorHandler />
                        <div key="error-boundary-wrapper">
                          <ErrorBoundary>
                            {children}
                          </ErrorBoundary>
                        </div>
                        <FloatingCartWidget />
                        <CommandPalette />
                      </UniversalProvider>
                    </CustomerAuthProvider>
                  </GlobalAlertProvider>
                </ProductLayoutProvider>
              </CartWidgetProvider>
            </PlatformSettingsProvider>
            </CustomAuthProvider>
          </PlatformThemeProvider>
      </ThemeProvider>
    </QueryClientWrapper>
  );
}
