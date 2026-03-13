import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "VisibleShelf",
  description: "Product visibility platform for retail",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh bg-white text-neutral-900`} suppressHydrationWarning>
      <body>
        <ClientRootLayout>{children}</ClientRootLayout>
        {/* <Analytics /> */}
      </body>
    </html>
  );
}
