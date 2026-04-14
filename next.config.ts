import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; tell Next not to bundle it.
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Keep the experimental block minimal; add flags only as we need them.
  },
};

export default nextConfig;
