import type { NextConfig } from "next";

// GitHub Pages serves the app under /cashout-calculator; Vercel (which sets VERCEL=1
// during its builds) serves it at the domain root.
const basePath = process.env.VERCEL ? "" : "/cashout-calculator";

const nextConfig: NextConfig = {
  output: "export",
  ...(basePath && { basePath }),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
