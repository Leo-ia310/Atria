import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@atria/contracts"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  async rewrites() {
    if (!process.env.INTERNAL_API_URL) return [];
    return [
      {
        source: "/api-proxy/:path*",
        destination: `${process.env.INTERNAL_API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
