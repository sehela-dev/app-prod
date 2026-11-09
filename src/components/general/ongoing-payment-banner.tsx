"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock3 } from "lucide-react";

import { useAuthMember } from "@/context/member.ctx";
import { useGetPaymentHistory } from "@/hooks/api/queries/customer/payments";
import { formatCurrency } from "@/lib/helper";
import { getPurchaseKind } from "@/lib/purchase-kind";

const PENDING_STATUSES = new Set(["pending", "initiated"]);
const RESUMABLE_TYPES = new Set(["package_purchase", "booking", "order"]);
const PENDING_WINDOW_MS = 20 * 60 * 1000;

const KIND_LABEL: Record<string, string> = {
  credit: "credit package",
  class: "class booking",
  product: "product order",
};

export const OngoingPaymentBanner = () => {
  const router = useRouter();
  const { isAuthenticated } = useAuthMember();
  const { data, isLoading } = useGetPaymentHistory(1, 100, isAuthenticated);

  const pending = useMemo(() => {
    const rows = data?.data ?? [];
    const now = Date.now();
    return (
      rows
        .filter((row) => PENDING_STATUSES.has(String(row.status ?? "").toLowerCase()))
        .filter((row) => RESUMABLE_TYPES.has(String(row.payable_type ?? "")))
        .filter((row) => {
          const created = Date.parse(String(row.created_at ?? ""));
          return !Number.isFinite(created) || now - created <= PENDING_WINDOW_MS;
        })
        .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0] ?? null
    );
  }, [data]);

  if (!isAuthenticated || isLoading || !pending) return null;

  const ref = pending.order_id || pending.payment_id;
  if (!ref) return null;
  const kind = KIND_LABEL[getPurchaseKind(pending.payable_type)];
  const title = pending.package_name || pending.session_name || pending.class_name || "your order";
  const amount = Number(pending.gross_amount_idr ?? 0);

  // Resume directly on the existing payment surface, not the generic history/detail redirect.
  let resumePath = `/profile/purchase-history/${encodeURIComponent(String(ref))}`;
  if (pending.payable_type === "order" && pending.payable_id) {
    resumePath = `/profile/orders/${encodeURIComponent(String(pending.payable_id))}/payment`;
  } else if (pending.payable_type === "booking" && pending.payable_id) {
    resumePath = `/profile/my-sessions/${encodeURIComponent(String(pending.payable_id))}`;
  } else if (pending.payable_type === "package_purchase" && pending.package_id) {
    const qs = new URLSearchParams({
      ...(pending.order_id ? { order_id: String(pending.order_id) } : {}),
      ...(pending.snap_redirect_url ? { snap_redirect_url: String(pending.snap_redirect_url) } : {}),
    });
    resumePath = `/topup-credit/${encodeURIComponent(String(pending.package_id))}/payment${qs.toString() ? `?${qs.toString()}` : ""}`;
  }

  return (
    <button
      type="button"
      onClick={() => router.push(resumePath)}
      className="flex w-full shrink-0 items-center gap-2.5 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-left transition-colors hover:bg-amber-100"
    >
      <Clock3 size={16} className="shrink-0 text-amber-600" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-bold text-amber-900">You have a payment in progress</span>
        <span className="text-xs leading-relaxed text-amber-800">
          Finish your {kind ?? "payment"} payment{amount > 0 ? ` of ${formatCurrency(amount)}` : ""} for {title} before
          creating a new order.
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 self-center text-xs font-bold text-amber-900">
        Continue <ChevronRight size={14} />
      </span>
    </button>
  );
};
