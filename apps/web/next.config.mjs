/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@bst/indicators", "@bst/datasources", "@bst/claude", "@bst/email"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  webpack(config) {
    // Allow our workspace packages to use ESM-style `.js` imports that resolve to `.ts` sources.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
