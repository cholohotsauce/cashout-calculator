import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/cashout-calculator",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
