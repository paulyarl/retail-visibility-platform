// apps/web/next.config.ts
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // If you import from a local package (e.g. packages/shared), add it here:
  transpilePackages: ["@rvp/shared", "shared"].filter(Boolean),

  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
    turbopack: {
      // Point at the monorepo root (where pnpm-lock.yaml lives)
      root: path.resolve(__dirname, "../.."),
    },
  },
};

export default nextConfig;
