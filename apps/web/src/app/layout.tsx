import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// import { Analytics } from "@vercel/analytics/react"; // Disabled - not configured in Vercel
import "./globals.css";
import { ClientRootLayout } from "@/components/ClientRootLayout";

// Prevent static generation for all routes (Mantine requires dynamic rendering)
export const dynamic = 'force-dynamic';

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
  fallback: ["JetBrains Mono", "monospace"],
  preload: false,
});

// PWA Viewport configuration
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1971c2" },
    { media: "(prefers-color-scheme: dark)", color: "#1971c2" },
  ],
};

// PWA Metadata configuration
export const metadata: Metadata = {
  title: {
    default: "VisibleShelf",
    template: "%s | VisibleShelf",
  },
  description: "Product visibility platform for retail - Browse products, manage inventory, and connect with local stores",
  applicationName: "VisibleShelf",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VisibleShelf",
    startupImage: [
      "/icons/icon-512x512.png",
    ],
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  openGraph: {
    type: "website",
    siteName: "VisibleShelf",
    title: "VisibleShelf",
    description: "Product visibility platform for retail",
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "VisibleShelf",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VisibleShelf",
    description: "Product visibility platform for retail",
    images: ["/icons/icon-512x512.png"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/icons/icon-96x96.png",
    apple: [
      { url: "/icons/icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/icons/icon-512x512.png",
        color: "#1971c2",
      },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "VisibleShelf",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh bg-white text-neutral-900`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClientRootLayout>{children}</ClientRootLayout>
        {/* <Analytics /> */}
      </body>
    </html>
  );
}
