import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@agrogenius/shared'],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
