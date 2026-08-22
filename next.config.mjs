import path from "node:path";

import { withPayload } from "@payloadcms/next/withPayload";
import { getNextConfigSecurityHeaders } from "./src/lib/security/http-headers.mjs";

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
  outputFileTracingIncludes: {
    "**/*": [
      "./node_modules/next/dist/build/**",
      "./node_modules/@aws-crypto/**",
      "./node_modules/@aws-sdk/**",
      "./node_modules/@smithy/**",
    ],
  },
  webpack: (config, { dev }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@payload-config": path.resolve(process.cwd(), "payload.config.ts"),
    };
    if (!dev && config.cache) {
      config.cache = false;
    }
    return config;
  },
  // Security headers
  async headers() {
    return [
      {
        source: "/mentoring/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/app/mentoring/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/api/mentoring/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/:path*",
        headers: getNextConfigSecurityHeaders(),
      },
    ];
  },
};

export default withPayload(nextConfig);
