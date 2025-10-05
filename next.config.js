/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd13e14gtps4iwl.cloudfront.net',
        port: '',
        pathname: '/players/v2/**',
      },
      {
        protocol: 'https',
        hostname: 'app.playmfl.com',
        port: '',
        pathname: '/players/**',
      },
      {
        protocol: 'https',
        hostname: 'app.playmfl.com',
        port: '',
        pathname: '/img/flags/**',
      },
    ],
  },
  eslint: {
    // Don't fail the build on ESLint errors, just show warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't fail the build on TypeScript errors, just show warnings
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
