"use client";

import { NavHeaderComponent } from "@/components/layout/header-checkout";
import { Button } from "@/components/ui/button";
import { useGetPaymentStatus } from "@/hooks/api/queries/customer/payments";
import { useGetMemberOrder } from "@/hooks/api/queries/customer/orders";
import { useRemainingTime } from "@/hooks/use-remaining-time";
import { ENABLE_MEMBER_VOUCHER_LIFECYCLE, ENABLE_NATIVE_PAYMENT } from "@/lib/config";
import { formatCurrency } from "@/lib/helper";
import { VOUCHER_HELD_NOTE, VOUCHER_RELEASED_NOTE } from "@/lib/voucher";
import { isPaymentFailure, isPaymentSuccess, isPaymentTerminal } from "@/lib/payment-status";
import { humanizePaymentStatus } from "@/lib/pending-package-payment";
import { loadSnap } from "@/lib/snap";
import { NativeInstructionsComponent } from "@/view/payment/native-instructions";
import { AlertCircle, CheckCircle, Clock, ExternalLink, Loader2, ShoppingBag } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

const PAYMENT_TIMEOUT_MS = 15 * 60 * 1000;

export const OrderPaymentView = () => {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params?.id as string;
  const createdToken = searchParams.get("snap_token");
  const createdUrl = searchParams.get("snap_redirect_url");
  const { data: order, isLoading, isError, refetch: refetchOrder } = useGetMemberOrder(orderId);
  const orderCode = order?.order_code ?? null;
  const statusOrderId = order?.payment?.order_id ?? orderCode;
  const amountPaid = order ? Math.max(0, order.total_price_idr - (order.voucher_discount_idr ?? 0)) : 0;

  const { data: statusData, refetch: refetchStatus } = useGetPaymentStatus(statusOrderId);
  const statusRow = statusData?.data;
  const pi = statusRow?.payment_instructions ?? order?.payment_instructions ?? null;
  const snapUrl = createdUrl ?? statusRow?.snap_redirect_url ?? (pi?.type === "redirect" ? pi.redirect_url : null);
  const snapToken = createdToken ?? statusRow?.snap_token ?? null;
  const nativeInstructions = ENABLE_NATIVE_PAYMENT && pi && pi.type !== "redirect" ? pi : null;
  const isRedirect = !nativeInstructions;

  const createdAtMs = order?.created_at ? Date.parse(order.created_at) : NaN;
  const expiresAt = pi?.expires_at ?? (Number.isFinite(createdAtMs) ? new Date(createdAtMs + PAYMENT_TIMEOUT_MS).toISOString() : null);
  const remainingMs = useRemainingTime(expiresAt);
  const windowExpired = remainingMs === 0;

  const serverStatus = statusRow?.transaction_status ?? order?.payment_status ?? "";
  const isSettled = isPaymentSuccess(serverStatus) || order?.payment_status === "paid";
  const isFailed = isPaymentFailure(serverStatus);
  const isExpired = windowExpired || serverStatus === "expire" || serverStatus === "expired";
  const isPending = !!orderCode && !isSettled && !isFailed && !isExpired;
  // Create-response fields are valid for 15 min; open from them even if the
  // order/status re-fetch has not caught up yet.
  const canOpenCreated = Boolean(createdToken || createdUrl) && !isSettled && !isFailed && !isExpired;
  const canOpenSnap = isPending || canOpenCreated;

  const snapBusyRef = useRef(false);
  const openSnap = useCallback(async () => {
    if (!snapToken || snapBusyRef.current || !canOpenSnap) return;
    snapBusyRef.current = true;
    const release = () => {
      snapBusyRef.current = false;
    };
    try {
      await loadSnap();
      if (!window.snap) throw new Error("Snap is not available");
      window.snap.pay(snapToken, {
        onSuccess: () => {
          release();
          void refetchStatus();
          void refetchOrder();
        },
        onPending: () => {
          release();
          void refetchStatus();
        },
        onError: () => {
          release();
          toast.error("Payment failed", { description: "Please try again.", position: "top-center" });
          void refetchStatus();
        },
        // Closing is not a failure: the token stays valid and the user can reopen.
        onClose: () => {
          release();
          void refetchStatus();
        },
      });
    } catch {
      release();
      // No client key / script blocked: fall back to the redirect page.
      if (snapUrl) {
        toast.error("Secure payment unavailable", { description: "Opening the payment page instead.", position: "top-center" });
        window.open(snapUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Payment page unavailable", { description: "Please refresh and try again.", position: "top-center" });
      }
    }
  }, [snapToken, snapUrl, canOpenSnap, refetchStatus, refetchOrder]);

  const openedRef = useRef(false);
  useEffect(() => {
    // Stored native instructions win; never push the member to an external page.
    if (nativeInstructions || openedRef.current || isSettled || isExpired || !canOpenSnap) return;
    if (snapToken) {
      openedRef.current = true;
      void openSnap();
      return;
    }
    if (isRedirect && snapUrl) {
      openedRef.current = true;
      const tab = window.open(snapUrl, "_blank", "noopener,noreferrer");
      if (!tab) openedRef.current = false;
    }
  }, [nativeInstructions, snapToken, isRedirect, snapUrl, isSettled, isExpired, canOpenSnap, openSnap]);

  useEffect(() => {
    if (isPaymentTerminal(serverStatus)) {
      void refetchOrder();
    }
  }, [serverStatus, refetchOrder]);

  if (isLoading) {
    return (
      <div className="flex flex-col w-full font-serif h-full text-brand-500">
        <NavHeaderComponent title="Payment" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="flex flex-col w-full font-serif h-full text-brand-500">
        <NavHeaderComponent title="Payment" />
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="text-lg font-semibold">Order not found</p>
          <Button onClick={() => router.push("/profile/orders")}>Back to My Orders</Button>
        </div>
      </div>
    );
  }

  if (isSettled) {
    return (
      <div className="flex flex-col w-full font-serif h-full text-brand-500">
        <NavHeaderComponent title="Payment" />
        <div className="flex flex-col gap-4 px-4 mt-4 pb-6">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500">
              <CheckCircle className="h-8 w-8 text-white" />
            </span>
            <p className="text-xl font-extrabold">Payment Success</p>
            <p className="max-w-[300px] text-sm text-brand-500/70">Your order is paid. We will let you know when it is ready.</p>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-brand-100 bg-white p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-500/60">Order</span>
              <span className="font-mono text-xs">{orderCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-500/60">Amount</span>
              <span className="font-bold">{formatCurrency(amountPaid)}</span>
            </div>
          </div>
          <Button className="min-h-12 w-full text-sm font-extrabold" onClick={() => router.push(`/profile/orders/${order.id}`)}>
            View Order
          </Button>
          <Button variant="outline" className="min-h-12 w-full text-sm font-semibold" onClick={() => router.push("/shop")}>
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full font-serif h-full text-brand-500">
      <NavHeaderComponent title="Complete Your Payment" />
      <div className="flex flex-col gap-4 px-4 mt-4 pb-6">
        <p className="-mt-2 text-center text-xs text-brand-500/60">
          {nativeInstructions ? "Complete your payment here — we'll confirm automatically" : "Pay via Midtrans — we'll confirm here"}
        </p>

        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100">
                <ShoppingBag className="h-5 w-5 text-brand-500" />
              </span>
              <div>
                <p className="font-semibold">Midtrans Payment</p>
                <p className="text-xs text-brand-500/60">
                  {nativeInstructions || snapToken ? "Secure payment in this page" : "Opened in new tab"}
                </p>
              </div>
            </div>
            {!isExpired && !isFailed && remainingMs !== null && (
              <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5">
                <Clock className="h-4 w-4 text-red-500" />
                <span className="font-mono text-sm font-bold text-red-600">
                  {Math.floor(Math.max(0, remainingMs) / 60000).toString().padStart(2, "0")}:
                  {Math.floor((Math.max(0, remainingMs) % 60000) / 1000).toString().padStart(2, "0")}
                </span>
              </div>
            )}
          </div>

          {nativeInstructions && isPending && (
            <NativeInstructionsComponent
              instructions={nativeInstructions}
              amountIdr={statusRow?.amount_idr ?? statusRow?.gross_amount_idr ?? amountPaid}
              channelLabel={statusRow?.channel_label}
              remainingMs={remainingMs}
            />
          )}

          {!nativeInstructions && (snapToken || (isRedirect && snapUrl)) && isPending && (
            <div className="mb-4 rounded-xl border border-brand-200 bg-brand-25 p-4">
              <p className="text-sm font-medium text-brand-700">
                {snapToken ? "Secure payment window" : "Payment page opened in new tab"}
              </p>
              <p className="mt-1 text-xs text-brand-500/70">
                {snapToken
                  ? "Complete your payment in the secure window. Keep this page open — we'll auto-detect success."
                  : "If it didn't open, click below. Keep this page open — we'll auto-detect success."}
              </p>
              <Button
                className="mt-3 w-full"
                onClick={() => {
                  if (snapToken) {
                    void openSnap();
                    return;
                  }
                  if (snapUrl) window.open(snapUrl, "_blank", "noopener,noreferrer");
                }}
              >
                <ExternalLink className="h-4 w-4" /> {snapToken ? "Open Payment Window" : "Open Midtrans Payment Page"}
              </Button>
              {snapUrl && (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = snapUrl;
                  }}
                  className="mt-2 w-full text-center text-xs font-medium text-brand-500/70 underline underline-offset-2"
                >
                  Trouble opening it? Continue on the payment page
                </button>
              )}
            </div>
          )}

          <div className="rounded-xl border border-brand-100 bg-brand-25 p-4">
            <h3 className="mb-3 font-semibold">Order Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-brand-500/60">Order</span>
                <span className="font-mono text-xs">{orderCode}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-brand-500/60">Items</span>
                <span className="text-right font-medium">{order.items?.length ?? 0}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-brand-500/60">Amount</span>
                <span className="text-lg font-bold">
                  {formatCurrency(statusRow?.amount_idr ?? statusRow?.gross_amount_idr ?? amountPaid)}
                </span>
              </div>
            </div>
          </div>

          {isPending && (nativeInstructions || snapToken || snapUrl) && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <div>
                <p className="text-sm font-medium text-blue-700">
                  Waiting for payment confirmation{serverStatus ? ` (${humanizePaymentStatus(serverStatus)})` : ""}…
                </p>
                {ENABLE_MEMBER_VOUCHER_LIFECYCLE && order.voucher_code && (
                  <p className="text-xs text-blue-700/80">{VOUCHER_HELD_NOTE}</p>
                )}
              </div>
            </div>
          )}

          {isPending && !nativeInstructions && !snapToken && !snapUrl && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">
                Payment details are unavailable. Refresh the status or start a new order.
              </p>
              <Button variant="outline" className="mt-3 w-full" onClick={() => void refetchStatus()}>
                Refresh status
              </Button>
            </div>
          )}

          {(isExpired || isFailed) && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-zinc-600" />
              <div>
                <p className="text-sm font-medium text-zinc-700">
                  {isExpired && !isFailed
                    ? "Payment expired — 15m window exceeded. Please start a new order."
                    : `Payment ${humanizePaymentStatus(serverStatus)} — please start a new order.`}
                </p>
                {ENABLE_MEMBER_VOUCHER_LIFECYCLE && order.voucher_code && (
                  <p className="text-xs text-zinc-600">{VOUCHER_RELEASED_NOTE}</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {isPending && (
              <Button
                variant="outline"
                onClick={() => {
                  void refetchStatus();
                  void refetchOrder();
                }}
                className="w-full min-h-12 font-semibold"
              >
                I&apos;ve Completed Payment — Check Status
              </Button>
            )}
            {(isExpired || isFailed) && (
              <Button className="w-full min-h-12 text-sm font-extrabold" onClick={() => router.push("/shop")}>
                Try Again
              </Button>
            )}
            <button
              onClick={() => router.push(`/profile/orders/${order.id}`)}
              className="w-full rounded-xl border border-brand-100 bg-white py-3 font-semibold text-brand-500 transition-colors hover:bg-brand-25"
            >
              View Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
