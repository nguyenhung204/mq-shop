import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal .next/standalone output with only the files needed
  // to run `node server.js`, making the Docker runtime image much smaller.
  output: "standalone",
  async redirects() {
    return [
      {
        // BE referralLink often uses /register?ref=…; app register is under my-account.
        source: "/register",
        destination: "/my-account/register",
        permanent: false,
      },
      {
        source: "/admin/finance",
        destination: "/admin/payouts",
        permanent: false,
      },
      {
        source: "/admin/fx-rates",
        destination: "/admin/finance/configs",
        permanent: false,
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 70, 75, 80, 82],
    // Next 16 blocks optimizer fetches to private IPs (SSRF). Local MinIO is localhost:9010.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9010",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "9010",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "9000",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
