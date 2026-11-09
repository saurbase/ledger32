import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Load the Postgres driver from node_modules at runtime instead of bundling
  // it (it has optional native bindings the bundler can't resolve).
  serverExternalPackages: ["pg"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
