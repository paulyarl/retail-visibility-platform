// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "next-pwa";

const isSentryEnabled = !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) && process.env.SENTRY_DISABLE_BUILD_PLUGIN !== 'true';
const isPwaEnabled = process.env.ENABLE_PWA === 'true';

const withPWA = isPwaEnabled ? withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.(?:js|css)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-resources",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
        },
      },
    },
    {
      urlPattern: /\/api\/directory\//i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-directory",
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 5, // 5 minutes
        },
      },
    },
    {
      urlPattern: /\/api\/public\//i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-public",
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 5, // 5 minutes
        },
      },
    },
  ],
}) : (cfg: any) => cfg;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // If you import from a local package (e.g. packages/shared), add it here:
  transpilePackages: ["@rvp/shared", "shared"].filter(Boolean),

  // Disable source maps in production to fix 404 errors
  productionBrowserSourceMaps: false,

  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
    // Enable Turbopack filesystem cache for builds (for future switch from --webpack)
    turbopackFileSystemCacheForBuild: true,
  },

  // Configure Turbopack root directory to silence multiple-lockfile warning
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },

  trailingSlash: false,
  poweredByHeader: false,

  // Skip type checking during builds to reduce memory usage.
  // Run `tsc --noEmit` separately in CI for quality gates.
  typescript: {
    ignoreBuildErrors: process.env.NEXT_SKIP_TYPE_CHECK === 'true',
  },

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
      // Ignore Cloudflare cookie warnings (harmless cross-domain issue)
      /Cookie.*__cf_bm.*rejected for invalid domain/,
    ];

    return config;
  },

  // Proxy API requests to the external API server
  async rewrites() {
    const apiBaseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://aps.visibleshelf.store'  // Production API URL
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
              : "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' https: ws: wss: https://api.stripe.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://js.stripe.com https://checkout.stripe.com https://web.squarecdn.com https://sandbox.web.squarecdn.com blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://web.squarecdn.com https://sandbox.web.squarecdn.com; img-src 'self' data: blob: https: https://maps.googleapis.com https://maps.gstatic.com https://js.stripe.com; font-src 'self' data: https://fonts.gstatic.com https://cash-f.squarecdn.com; frame-src 'self' https://www.google.com https://maps.google.com https://js.stripe.com https://checkout.stripe.com https://web.squarecdn.com https://sandbox.web.squarecdn.com; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:; block-all-mixed-content;"
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
// First wrap with PWA, then with Sentry (only if configured)
const wrapped = withPWA(nextConfig);
export default isSentryEnabled ? withSentryConfig(wrapped, sentryWebpackPluginOptions) : wrapped;
