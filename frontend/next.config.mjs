/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@tomo-inc/tomo-evm-kit",
    "@tomo-wallet/uikit-lite",
    "@tomo-inc/shared-type",
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
