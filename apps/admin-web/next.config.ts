import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lumora-assets-dev.s3.af-south-1.amazonaws.com'],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
