"use client";
import { usePathname } from "next/navigation";

import { MainHeaderComponent, MainBottomNav } from "@/components/layout";
import { OngoingPaymentBanner } from "@/components/general/ongoing-payment-banner";

const ONGOING_PAYMENT_BANNER_PATHS = new Set(["/book", "/shop", "/profile"]);

export default function MainLayout({ children, showNav }: Readonly<{ children: React.ReactNode; showNav?: boolean }>) {
  const pathname = usePathname();
  const showOngoingPaymentBanner = ONGOING_PAYMENT_BANNER_PATHS.has(pathname);

  return (
    <div className="h-dvh flex flex-col sm:bg-brand-100 w-[100vw]">
      <div className="sm:mx-auto w-full max-w-dvw sm:max-w-[550px] bg-brand-50 h-dvh flex flex-col">
        {/* Header (fixed height, non-scrolling) */}
        <MainHeaderComponent />

        {/* Ongoing payment strip — directly under the header, outside the scroll area */}
        {showOngoingPaymentBanner && <OngoingPaymentBanner />}

        {/* Content (only this scrolls) */}
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
        {/* Footer / mobile menu (fixed height, non-scrolling) */}
        {showNav && <MainBottomNav />}
      </div>
    </div>
  );
}
