import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// import { Analytics } from "@vercel/analytics/react"; // Disabled - not configured in Vercel
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import { PlatformSettingsProvider } from "@/contexts/PlatformSettingsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import DynamicFavicon from "@/components/DynamicFavicon";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

// Create QueryClient with optimized caching to prevent duplicate API calls
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
      gcTime: 10 * 60 * 1000, // 10 minutes - cache garbage collection
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
          return error.status >= 500; // Only retry server errors
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
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
        <QueryClientProvider client={queryClient}>
          <PlatformSettingsProvider>
            <AuthProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </AuthProvider>
          </PlatformSettingsProvider>
        </QueryClientProvider>
        {/* <Analytics /> */}
      </body>
    </html>
  );
}
