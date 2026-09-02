import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static resolves its binary with __dirname at runtime; bundling it
  // would point that at the wrong place. Keep it a plain node_modules require.
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;
