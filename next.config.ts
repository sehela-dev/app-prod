import type { NextConfig } from "next";

// Accept both the current and the old documented env names so a Vercel env
// added as NEXT_PUBLIC_MIDTRANS_CLIENT_KEY still reaches snap.js.
const devMidtransClientKey =
  process.env.NEXT_DEV_MIDTRANS_CLIENT_KEY ?? process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
const prodMidtransClientKey =
  process.env.NEXT_MIDTRANS_CLIENT_KEY ??
  process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ??
  process.env.MIDTRANS_CLIENT_KEY;

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // Main/Production environment
    MAIN_AUTH_API_URL: process.env.NEXT_MAIN_AUTH_API_URL,
    MAIN_API_URL: process.env.NEXT_MAIN_API_URL,
    MAIN_SECRET_KEY: process.env.NEXT_MAIN_SECRET_KEY,
    MAIN_SECRET_AUTH_KEY: process.env.NEXT_MAIN_AUTH_SECRET_KEY,

    // Development environment
    DEV_AUTH_API_URL: process.env.NEXT_DEV_AUTH_API_URL,
    API_URL: process.env.NEXT_DEV_API_URL,
    DEV_SECRET_KEY: process.env.NEXT_DEV_SECRET_KEY,
    DEV_SECRET_AUTH_KEY: process.env.NEXT_DEV_AUTH_SECRET_KEY,
    ENV: process.env.ENV,

    // Midtrans client key — public by design (used by snap.js in the browser).
    // Must match the BE's MIDTRANS_ENVIRONMENT (dev → sandbox, prod → production).
    MIDTRANS_CLIENT_KEY: process.env.ENV === "dev" ? devMidtransClientKey : prodMidtransClientKey,

    // FE-12 stays behind this flag until D-16 (sandbox) is signed off.
    ENABLE_PAYMENT_CHANGE: process.env.NEXT_PUBLIC_ENABLE_PAYMENT_CHANGE,

    // FE-19 native VA/QRIS page is hard-off in code (prod is Snap-only).

    // Member discount rollout: dev defaults on; prod set the env flag explicitly
    // after the BE-04/05/06/07 smoke passes.
    ENABLE_MEMBER_VOUCHER_PACKAGE: process.env.NEXT_PUBLIC_ENABLE_MEMBER_VOUCHER_PACKAGE,
    ENABLE_MEMBER_VOUCHER_LIFECYCLE: process.env.NEXT_PUBLIC_ENABLE_MEMBER_VOUCHER_LIFECYCLE,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // Matches any hostname
      },
      {
        protocol: "http",
        hostname: "**", // Optional: also allows non-secure images
      },
    ],
  },
};

export default nextConfig;
