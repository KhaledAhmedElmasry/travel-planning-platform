import type { NextConfig } from "next";

// Same origin (Milestone 2): the browser only talks to this Next.js app. Requests to /api/* and
// /uploads/* are forwarded to the NestJS backend, so the auth cookies (httpOnly, Secure,
// SameSite=Strict) work without CORS, and server-rendered pages receive the access cookie too.
// BACKEND_URL is read when the app starts (see frontend/.env.example).
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:3000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BACKEND_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
