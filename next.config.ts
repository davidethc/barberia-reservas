import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Playwright suite runs its own server next to `npm run dev`; a separate build
  // folder keeps the two from fighting over `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
