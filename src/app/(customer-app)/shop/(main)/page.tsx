// import { ShopPageView } from "@/view/shop";
import { ShopUnderDevelopmentView } from "@/view/shop/under-development";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop — Sehela Space",
  description: "Shop at Sehela Space",
};


export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      }
    >
      {/* <ShopPageView /> */}
      <ShopUnderDevelopmentView />
    </Suspense>
  );
}