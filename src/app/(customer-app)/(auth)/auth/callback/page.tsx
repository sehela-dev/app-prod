import { AuthCallBackPage } from "@/view/auth/callback";
import { Suspense } from "react";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authenticating — Sehela Space",
  description: "Authenticating at Sehela Space",
  robots: { index: false, follow: false },
};

// Static shell: tokens arrive in the hash/query and are handled client-side.
export default function Home() {
  return (
    <Suspense fallback={null}>
      <AuthCallBackPage />
    </Suspense>
  );
}