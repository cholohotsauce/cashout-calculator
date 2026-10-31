import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg is a Node.js driver; keep it out of the bundle and load it at runtime.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
