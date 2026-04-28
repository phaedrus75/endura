import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Single large static admin HTML; avoid edge/browser serving an old copy after git deploys.
        source: '/dashboard-e9x2k/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
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
