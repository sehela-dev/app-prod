"use client";

import { NavHeaderComponent } from "@/components/layout/header-checkout";
import { CustomPagination } from "@/components/general/pagination-component";
import { Button } from "@/components/ui/button";
import { useGetMemberOrders } from "@/hooks/api/queries/customer/orders";
import { formatCurrency, formatDateHelper } from "@/lib/helper";
import { fulfillmentLabel, fulfillmentStyle } from "@/lib/order-status";
import { humanizePaymentStatus } from "@/lib/pending-package-payment";
import { ChevronRight, Loader2, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const TABS = [
  { value: "all", name: "All" },
  { value: "pending", name: "Pending" },
  { value: "ready_for_pickup", name: "Ready" },
  { value: "shipped", name: "Shipped" },
  { value: "completed", name: "Completed" },
  { value: "canceled", name: "Canceled" },
];

const PAGE_SIZE = 10;

export const OrderListView = () => {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetMemberOrders({
    page,
    page_size: PAGE_SIZE,
    ...(status !== "all" ? { status: status as "pending" } : null),
  });
  const orders = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="flex flex-col w-full font-serif h-full text-brand-500">
      <NavHeaderComponent title="My Orders" />
      <div className="flex gap-1 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
              status === tab.value ? "bg-brand-500 text-white" : "bg-brand-100 text-brand-500"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 px-4 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
              <Package className="text-brand-400" size={22} />
            </div>
            <p className="text-sm font-semibold">No orders yet</p>
            <p className="max-w-[240px] text-xs text-brand-400">Your product orders will appear here.</p>
            <Button className="mt-2" onClick={() => router.push("/shop")}>
              Browse Shop
            </Button>
          </div>
        ) : (
          <>
            {orders.map((order) => {
              const itemCount = order.items?.reduce((n, item) => n + item.quantity, 0) ?? 0;
              const summary = order.items?.[0] ? `${order.items[0].product_name} · ${order.items[0].variant_name}` : "Order";
              const discount = order.voucher_discount_idr ?? 0;
              const totalPaid = Math.max(0, order.total_price_idr - discount);
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/profile/orders/${order.id}`)}
                  className="flex flex-col gap-2 rounded-xl border border-brand-100 bg-brand-25 p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-xs font-semibold">{order.order_code}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${fulfillmentStyle(order.fulfillment_status)}`}>
                      {fulfillmentLabel(order.fulfillment_status)}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-sm font-semibold">{summary}</p>
                  <p className="text-xs text-brand-400">
                    {itemCount} item(s) · {formatDateHelper(order.created_at, "dd MMM yyyy · HH:mm")}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{totalPaid === 0 && discount > 0 ? "Gratis" : formatCurrency(totalPaid)}</p>
                      {discount > 0 && (
                        <p className="text-[10px] text-brand-400 line-through">{formatCurrency(order.total_price_idr)}</p>
                      )}
                      {discount > 0 && (
                        <p className="text-[10px] font-medium text-emerald-700">
                          {order.voucher_code ? `${order.voucher_code} · ` : ""}-{formatCurrency(discount)}
                        </p>
                      )}
                    </div>
                    <p className="flex items-center gap-0.5 text-[11px] text-brand-400">
                      {humanizePaymentStatus(order.payment_status)} <ChevronRight size={14} />
                    </p>
                  </div>
                </button>
              );
            })}
            {(pagination?.total_pages ?? 1) > 1 && (
              <CustomPagination
                onPageChange={setPage}
                currentPage={page}
                hasNextPage={pagination?.has_next}
                hasPrevPage={pagination?.has_prev}
                totalItems={pagination?.total_items as number}
                totalPages={pagination?.total_pages as number}
                limit={PAGE_SIZE}
                position="center"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
