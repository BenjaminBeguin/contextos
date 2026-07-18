/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@memmo/shared"],
  webpack: (config) => {
    // The shared package uses NodeNext-style ".js" extensions in its TS source
    // (required by the API). Teach webpack to resolve those to ".ts"/".tsx".
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
