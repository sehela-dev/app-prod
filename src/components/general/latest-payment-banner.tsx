import { Info } from "lucide-react";

interface ILatestPaymentBannerProps {
  orderId?: string | null;
}

export const LatestPaymentBanner = ({ orderId }: ILatestPaymentBannerProps) => (
  <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
    <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
    <p className="text-xs leading-relaxed text-amber-800">
      Only the latest payment session is valid. If you paid an earlier one, contact us with order ID{" "}
      <span className="font-mono font-semibold">{orderId || "-"}</span>.
    </p>
  </div>
);
