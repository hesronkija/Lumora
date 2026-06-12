import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lumora-assets-dev.s3.af-south-1.amazonaws.com'],
  },
  async rewrites() {
    // Only proxy API calls when a backend is configured; in demo mode the
    // UI runs entirely on the built-in dataset.
    const api = process.env['NEXT_PUBLIC_API_URL'];
    if (!api) return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${api}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
