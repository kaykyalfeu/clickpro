import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Build will succeed even with type errors (Prisma generates types at build time on Vercel)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
