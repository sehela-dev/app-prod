import AuthMemberGuard from "@/layout/authguard-member-layout";
import { OrderPaymentView } from "@/view/profile/orders/payment";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Payment — Sehela Space",
  description: "Complete your product order payment",
};

export default function Page() {
  return (
    <AuthMemberGuard>
      <OrderPaymentView />
    </AuthMemberGuard>
  );
}
