// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // If you import from a local package (e.g. packages/shared), add it here:
  transpilePackages: ["@rvp/shared", "shared"].filter(Boolean),

  // Disable source maps in production to fix 404 errors
  productionBrowserSourceMaps: false,

  // Disable all static optimization and prerendering
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
    // Disable static optimization completely
    disableOptimizedLoading: true,
  },

  // Configure Turbopack root directory to silence warning
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },

  // Force all pages to be dynamic - remove static generation entirely
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },

  // Prevent any static generation
  trailingSlash: false,
  poweredByHeader: false,

  // Disable 404 page generation to avoid prerendering issues
  generateEtags: false,
  compress: false,

  // Suppress noisy Sentry/OpenTelemetry warnings in development
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      // Suppress client-side warnings
      config.infrastructureLogging = {
        level: 'error',
      };
    }
    
    // Filter out specific warnings
    config.ignoreWarnings = [
      // Ignore Sentry OpenTelemetry warnings
      /import-in-the-middle/,
      /require-in-the-middle/,
      // Ignore source map warnings
      /Failed to parse source map/,
      /Invalid source map/,
      /sourceMapURL could not be parsed/,
    ];

    return config;
  },

  // Proxy API requests to the external API server
  async rewrites() {
    const apiBaseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://visibleshelf.store'  // Production API URL
      : 'http://localhost:4000';     // Development API URL

    return [
      // Exclude source maps from proxy
      {
        source: '/:path*.map',
        destination: '/:path*.map'
      },
      // Exclude admin/tier-system routes so they can be handled by Next.js API routes
      {
        source: '/api/admin/tier-system/:path*',
        destination: '/api/admin/tier-system/:path*', // Pass through to Next.js
      },
      // Proxy public routes (no auth required)
      {
        source: '/public/:path*',
        destination: `${apiBaseUrl}/public/:path*`,
      },
      // Proxy all other API requests to the external API server
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },

  // Add CSP headers to allow API calls in development
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'development' 
              ? "" // Disable CSP entirely in development
              : "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' https: ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https: https://maps.googleapis.com https://maps.gstatic.com; font-src 'self' data: https://fonts.gstatic.com; frame-src 'self' https://www.google.com https://maps.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:; block-all-mixed-content;"
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https:; worker-src 'self' blob:;"
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'nbwsiobosqawrugnqddo.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.vercel.app',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
        pathname: '/uploads/**',
      },
      // Allow any external logo URLs (for business logos)
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '**',
        pathname: '/**',
      },
    ],
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
};


// Make sure adding Sentry options is the last code to run before exporting
export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
