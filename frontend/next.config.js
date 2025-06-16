const withTM = require("next-transpile-modules")([
  "chainsig.js",
  "@cosmjs/proto-signing",
  "cosmjs-types",
  "@near-js/keystores",
  "@near-js/crypto",
  "@near-js/utils",
  "@near-js/types",
]);

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@tomo-inc/tomo-evm-kit",
    "@tomo-wallet/uikit-lite",
    "@tomo-inc/shared-type",
  ],
  output: "standalone",
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        net: false,
        fs: false,
        tls: false,
        crypto: false,
        stream: require.resolve("stream-browserify"),
        url: require.resolve("url"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        assert: require.resolve("assert"),
        os: require.resolve("os-browserify"),
        path: require.resolve("path-browserify"),
      };
    }

    // Add extension resolution
    config.resolve.extensions = [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ...config.resolve.extensions,
    ];

    // Handle CSS modules
    config.module.rules.push({
      test: /\.css$/,
      use: ["style-loader", "css-loader"],
    });

    return config;
  },
};

module.exports = withTM(nextConfig);
