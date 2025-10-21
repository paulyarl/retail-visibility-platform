// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // If you import from a local package (e.g. packages/shared), add it here:
  transpilePackages: ["@rvp/shared", "shared"].filter(Boolean),
  eslint: {
    ignoreDuringBuilds: true,
  },

  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
