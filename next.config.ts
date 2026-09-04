import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emits a self-contained server bundle with only the dependencies actually
  // used, which is what the Docker runtime stage copies. Keeps the image small
  // and means the runner never needs a full node_modules install.
  output: "standalone",
  experimental: {
    serverActions: {
      // Product uploads post up to five photos in one submission. The default
      // 1MB ceiling rejects that before the action ever runs; the per-image
      // limit is enforced in lib/products/upload.ts, which produces a message
      // the store owner can act on.
      bodySizeLimit: "24mb",
    },
  },
  images: {
    // Product images are served through /api/images/[id], which streams from the
    // configured storage provider. Remote patterns are only needed when a CDN or
    // public object-storage bucket is configured via NEXT_PUBLIC_IMAGE_HOST.
    remotePatterns: process.env.NEXT_PUBLIC_IMAGE_HOST
      ? [{ protocol: "https", hostname: process.env.NEXT_PUBLIC_IMAGE_HOST }]
      : [],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
