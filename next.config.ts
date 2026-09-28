import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    // Revisiting a tab within 30s reuses the rendered page; actions still refresh it.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
