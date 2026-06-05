import path from "node:path";

import { withPayload } from "@payloadcms/next/withPayload";

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  webpack: (config, { dev }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@payload-config": path.resolve(process.cwd(), "payload.config.ts"),
    };
    if (!dev && config.cache) {
      config.cache = false;
    }
    if (!dev && config.optimization?.splitChunks) {
      Object.assign(config.optimization.splitChunks, {
        chunks: "all",
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        minSize: 20000,
        maxSize: 244000,
      });
    }
    return config;
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withPayload(nextConfig);
