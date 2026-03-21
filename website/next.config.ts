import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/dashboard-e9x2k',
        destination: '/dashboard-e9x2k/index.html',
      },
    ];
  },
};

export default nextConfig;
