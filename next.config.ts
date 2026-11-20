import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Report-only for now (nothing is blocked). It already lists what the media library needs, so enforcing it in
// Phase 8 won't break uploads: images are shown through Next.js's own optimizer (same origin), and the browser
// uploads files straight to api.cloudinary.com. Inline scripts are allowed here; Phase 8 replaces that with nonces.
const reportOnlyCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self'",
  "connect-src 'self' https://api.cloudinary.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const headers =
      process.env.NODE_ENV === "production"
        ? [...securityHeaders, { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp }]
        : securityHeaders;
    return [{ source: "/:path*", headers }];
  },
  images: {
    // Only OUR Cloudinary cloud's uploaded images may be optimized: never other people's Cloudinary accounts.
    remotePatterns: cloudName
      ? [{ protocol: "https", hostname: "res.cloudinary.com", pathname: `/${cloudName}/image/upload/**` }]
      : [],
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
