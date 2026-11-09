"use client";

import { getOrderApiError } from "@/api-req/customer-app";
import { NavHeaderComponent } from "@/components/layout/header-checkout";
import { Button } from "@/components/ui/button";
import { useCompleteMemberOrder, useGetMemberOrder } from "@/hooks/api/queries/customer/orders";
import { formatCurrency, formatDateHelper } from "@/lib/helper";
import { fulfillmentLabel, fulfillmentStyle } from "@/lib/order-status";
import { humanizePaymentStatus } from "@/lib/pending-package-payment";
import { AlertCircle, ExternalLink, Loader2, MapPin, Truck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export const OrderDetailView = () => {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { data: order, isLoading, isError } = useGetMemberOrder(id);
  const completeOrder = useCompleteMemberOrder(id);

  const handleComplete = async () => {
    try {
      await completeOrder.mutateAsync();
      toast.success("Order marked as received");
    } catch (error) {
      const { code, message } = getOrderApiError(error);
      toast.error(code === "INVALID_STATUS" ? "This order can no longer be marked as received." : message || "Failed to update order.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col w-full font-serif h-full text-brand-500">
        <NavHeaderComponent title="Order Detail" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="flex flex-col w-full font-serif h-full text-brand-500">
        <NavHeaderComponent title="Order Detail" />
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="text-lg font-semibold">Order not found</p>
          <Button onClick={() => router.push("/profile/orders")}>Back to My Orders</Button>
        </div>
      </div>
    );
  }

  const isThirdParty = order.delivery_method === "third_party";
  const canComplete = isThirdParty && order.fulfillment_status === "shipped";
  const discount = order.voucher_discount_idr ?? 0;
  const totalPaid = Math.max(0, order.total_price_idr - discount);

  return (
    <div className="flex flex-col w-full font-serif h-full text-brand-500">
      <NavHeaderComponent title="Order Detail" />
      <div className="flex flex-col gap-3 px-4 py-4 pb-28">
        <div className="rounded-xl border border-brand-100 bg-brand-25 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-sm font-bold">{order.order_code}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${fulfillmentStyle(order.fulfillment_status)}`}>
              {fulfillmentLabel(order.fulfillment_status)}
            </span>
          </div>
          <p className="mt-1 text-xs text-brand-400">{formatDateHelper(order.created_at, "EEEE, dd MMM yyyy · HH:mm")}</p>
          <div className="mt-3 flex items-center justify-between border-t border-brand-100 pt-3 text-sm">
            <span className="text-brand-400">Payment</span>
            <span className="font-semibold">{humanizePaymentStatus(order.payment_status)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-brand-400">Delivery</span>
            <span className="font-semibold">{isThirdParty ? "Third-party delivery" : "Pickup"}</span>
          </div>
        </div>

        {order.payment_status === "pending" && (
          <Button
            className="min-h-12 w-full text-sm font-extrabold"
            onClick={() => router.push(`/profile/orders/${order.id}/payment`)}
          >
            Continue payment
          </Button>
        )}

        <div className="rounded-xl border border-brand-100 bg-brand-25 p-4">
          <p className="mb-2 text-sm font-bold">Items</p>
          <div className="flex flex-col gap-2">
            {order.items?.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 border-b border-brand-100 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.product_name}</p>
                  <p className="text-xs text-brand-400">{item.variant_name}</p>
                  <p className="text-xs text-brand-400">
                    {formatCurrency(item.unit_price_idr)} × {item.quantity}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{formatCurrency(item.total_price_idr)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-brand-100 pt-3 text-sm">
            <span className="text-brand-400">Subtotal</span>
            <span className="font-semibold">{formatCurrency(order.total_price_idr)}</span>
          </div>
          {discount > 0 && (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-brand-400">
                Kode diskon{order.voucher_code ? ` (${order.voucher_code})` : ""}
              </span>
              <span className="font-semibold text-emerald-700">- {formatCurrency(discount)}</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-brand-100 pt-2">
            <span className="text-sm font-bold">Total dibayar</span>
            <span className="text-sm font-bold">{totalPaid === 0 && discount > 0 ? "Gratis" : formatCurrency(totalPaid)}</span>
          </div>
        </div>

        {isThirdParty && (
          <div className="rounded-xl border border-brand-100 bg-brand-25 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold">
              <MapPin size={15} /> Shipping
            </p>
            <p className="text-sm font-semibold">{order.shipping_recipient_name || "-"}</p>
            <p className="text-xs text-brand-400">{order.shipping_phone || "-"}</p>
            <p className="mt-1 whitespace-pre-line text-sm">{order.shipping_address || "-"}</p>
            {order.shipping_notes && <p className="mt-1 text-xs text-brand-400">{order.shipping_notes}</p>}

            {(order.tracking_number || order.tracking_url) && (
              <div className="mt-3 flex items-center justify-between border-t border-brand-100 pt-3 text-sm">
                <span className="flex items-center gap-1 text-brand-400">
                  <Truck size={15} /> Tracking
                </span>
                {order.tracking_url ? (
                  <a
                    href={order.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-semibold text-brand-600 underline underline-offset-2"
                  >
                    {order.tracking_number || "Open tracking"} <ExternalLink size={13} />
                  </a>
                ) : (
                  <span className="font-semibold">{order.tracking_number}</span>
                )}
              </div>
            )}
          </div>
        )}

        {order.notes && (
          <div className="rounded-xl border border-brand-100 bg-brand-25 p-4">
            <p className="mb-1 text-sm font-bold">Order notes</p>
            <p className="text-sm">{order.notes}</p>
          </div>
        )}

        {order.fulfillment_status === "canceled" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-700">Order canceled</p>
            {order.cancel_reason && <p className="mt-1 text-sm text-red-600">{order.cancel_reason}</p>}
          </div>
        )}

        {order.rental && (
          <div className="rounded-xl border border-brand-100 bg-brand-25 p-4">
            <p className="mb-2 text-sm font-bold">Rental</p>
            <p className="text-xs text-brand-400 capitalize">Status: {order.rental.status}</p>
            <div className="mt-2 flex flex-col gap-1">
              {order.rental.items?.map((item) => (
                <p key={item.product_variant_id} className="text-xs text-brand-400">
                  Rented {item.quantity_rented} · Returned {item.quantity_returned}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {canComplete && (
        <div className="sticky bottom-16 flex w-full bg-brand-50 p-4">
          <Button className="w-full" disabled={completeOrder.isPending} onClick={handleComplete}>
            {completeOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Order received"}
          </Button>
        </div>
      )}
    </div>
  );
};
