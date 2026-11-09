import { CompleteProfilePageView } from "@/view/auth/complete-profile";
import { Suspense } from "react";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Complete Profile — Sehela Space",
  description: "Complete Profile at Sehela Space",
  robots: { index: false, follow: false },
};

// Static shell: token/email live in the query string and are read client-side,
// so prerendering once keeps bots/scanners off the function bill.
export default function Home() {
  return (
    <Suspense fallback={null}>
      <CompleteProfilePageView />
    </Suspense>
  );
}