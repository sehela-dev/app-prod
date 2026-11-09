"use client";
import { BaseDialogComponent } from "@/components/general/base-dialog-component";
import { NavHeaderComponent } from "@/components/layout/header-checkout";
import { Button } from "@/components/ui/button";
import { useRetryPackagePayment } from "@/hooks/api/mutations/customers";
import { useGetPaymentHistoryDetail, useGetPaymentStatus } from "@/hooks/api/queries/customer/payments";
import { ENABLE_NATIVE_PAYMENT } from "@/lib/config";
import { formatCurrency, formatDateHelper } from "@/lib/helper";
import { isPaymentRetryable, isPaymentTerminal } from "@/lib/payment-status";
import { loadSnap } from "@/lib/snap";
import {
  formatExpiryCountdown,
  getPendingPackagePayment,
  humanizePaymentStatus,
  setPendingPackagePayment,
} from "@/lib/pending-package-payment";
import { getPurchaseKind, PURCHASE_KIND_BADGE, PURCHASE_KIND_ICON_BG, PURCHASE_KIND_LABEL } from "@/lib/purchase-kind";
import { AlertCircle, Gem as GemIcon, Loader2, Package as PackageIcon, ReceiptText, RefreshCw, Ticket as TicketIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NativeInstructionsComponent } from "@/view/payment/native-instructions";

const SUCCESS = ["settlement", "capture"];

// Payment history detail — :ref = payment uuid, readable order_id, or PKG-….
// Lifecycle fields: top-ups add purchase_status/purchased_at/expires_at,
// bookings add booking_status, both add voucher_code/discount_idr.
export const PurchaseHistoryDetailView = ({ refId }: { refId: string }) => {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useGetPaymentHistoryDetail(refId);
  const item = data?.data;
  const resumeUrl =
    (item && typeof item.snap_redirect_url === "string" && item.snap_redirect_url) ||
    (getPendingPackagePayment()?.snap_redirect_url ?? null);
  const [changeOpen, setChangeOpen] = useState(false);
  const retryMutation = useRetryPackagePayment();
  const snapBusyRef = useRef(false);

  const kind = getPurchaseKind(item?.payable_type);
  const isPackage = kind === "credit";
  const isBooking = kind === "class";
  const isProduct = kind === "product";
  const status = item?.status ? String(item.status) : "";
  const serverPending = status === "pending";
  const orderId = item?.order_id
    ? String(item.order_id)
    : item?.provider_txn_id
      ? String(item.provider_txn_id)
      : null;

  // Expiry anchor: server expires_at first, created_at + 15m fallback.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!serverPending) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [serverPending]);
  const expiresAtMs = item?.expires_at
    ? Date.parse(String(item.expires_at))
    : item?.created_at
      ? Date.parse(String(item.created_at)) + 15 * 60 * 1000
      : 0;
  const remainingMs = expiresAtMs - now;
  const timeExpired = serverPending && expiresAtMs > 0 && remainingMs <= 0;
  const displayStatus = timeExpired ? "expired" : status;
  const isPending = serverPending && !timeExpired;
  const { data: statusData, refetch: refetchStatus } = useGetPaymentStatus(isPackage && isPending ? orderId : null);
  const pi = statusData?.data?.payment_instructions ?? null;
  const nativeInstructions = ENABLE_NATIVE_PAYMENT && pi && pi.type !== "redirect" ? pi : null;
  const paymentRemainingMs = pi?.expires_at
    ? Math.max(0, Date.parse(pi.expires_at) - now)
    : remainingMs;

  useEffect(() => {
    if (isPaymentTerminal(statusData?.data?.transaction_status ?? null)) void refetch();
  }, [statusData?.data?.transaction_status, refetch]);

  // Pending resume: popup with the stored token, then the Snap page. Blocked
  // popups fall back to the top-up payment page (packages) which hosts its own
  // open button.
  const handleContinue = async () => {
    if (!item || snapBusyRef.current) return;
    snapBusyRef.current = true;
    const release = () => {
      snapBusyRef.current = false;
    };
    const url =
      (typeof item.snap_redirect_url === "string" && item.snap_redirect_url) ||
      (getPendingPackagePayment()?.snap_redirect_url ?? null);
    const token = isPackage ? statusData?.data?.snap_token ?? null : null;
    if (token) {
      try {
        await loadSnap();
        if (window.snap) {
          window.snap.pay(token, {
            onSuccess: () => {
              release();
              void refetchStatus();
            },
            onPending: () => {
              release();
              void refetchStatus();
            },
            onError: () => {
              release();
              void refetchStatus();
            },
            onClose: () => {
              release();
              void refetchStatus();
            },
          });
          return;
        }
      } catch {
        // fall through to the Snap page
      }
    }
    release();
    if (url && window.open(url, "_blank", "noopener,noreferrer")) return;
    if (isPackage) {
      const packageId = String(item.package_id ?? item.payable_id ?? "");
      const qs = new URLSearchParams({
        ...(orderId ? { order_id: orderId } : {}),
        ...(url ? { snap_redirect_url: url } : {}),
        ...(item.expires_at ? { expires_at: String(item.expires_at) } : {}),
        ...(item.created_at ? { created_at: String(item.created_at) } : {}),
      });
      router.push(packageId ? `/topup-credit/${packageId}/payment?${qs.toString()}` : "/profile/purchase-history");
    } else if (isBooking && item.payable_id) {
      router.push(`/profile/my-sessions/${String(item.payable_id)}`);
    } else if (isProduct) {
      router.push(item.payable_id ? `/profile/orders/${String(item.payable_id)}/payment` : "/profile/orders");
    }
  };

  const handlePackageAction = () => {
    if (!isPackage || !orderId) return;
    retryMutation.mutate(
      { order_id: orderId },
      {
        onSuccess: (res) => {
          setChangeOpen(false);
          const packageId = String(item?.package_id ?? item?.payable_id ?? "");
          setPendingPackagePayment({
            order_id: res.data.order_id,
            package_id: packageId,
            snap_redirect_url: res.data.snap_redirect_url ?? null,
            initiated_at: Date.now(),
          });
          const qs = new URLSearchParams({ order_id: res.data.order_id });
          if (res.data.snap_token) qs.set("snap_token", res.data.snap_token);
          if (res.data.snap_redirect_url) qs.set("snap_redirect_url", res.data.snap_redirect_url);
          if (res.data.payment_instructions?.expires_at) qs.set("expires_at", res.data.payment_instructions.expires_at);
          router.push(packageId ? `/topup-credit/${packageId}/payment?${qs.toString()}` : "/profile/purchase-history");
        },
        onError: () => {
          void refetch();
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col w-full font-serif h-full text-brand-500">
        <NavHeaderComponent title="Payment Detail" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="flex flex-col w-full font-serif h-full text-brand-500">
        <NavHeaderComponent title="Payment Detail" />
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="font-semibold text-lg">Payment not found</p>
          <p className="max-w-[280px] text-sm text-brand-500/70">This payment doesn&apos;t exist or isn&apos;t yours.</p>
          <Button className="mt-2 min-h-12 text-sm font-extrabold" onClick={() => router.push("/profile/purchase-history")}>
            Back to history
          </Button>
        </div>
      </div>
    );
  }

  const amount = item.gross_amount_idr ?? (item.amount_idr as number | undefined) ?? 0;
  const title = isPackage
    ? String(item.package_name ?? "Credit package")
    : isBooking
      ? String(item.session_name ?? "Class booking")
      : isProduct
        ? "Product order"
        : "Payment";
  const lifecycle = item.purchase_status ?? item.booking_status ?? item.fulfillment_status;
  const discount = item.discount_idr != null ? Number(item.discount_idr) : 0;

  return (
    <div className="flex flex-col w-full font-serif h-full text-brand-500">
      <NavHeaderComponent title="Payment Detail" />
      <div className="flex flex-col gap-3 px-4 mt-4 pb-6">
        <div className="rounded-2xl border border-brand-100 bg-white px-4 py-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${PURCHASE_KIND_ICON_BG[kind]}`}
            >
              {isPackage ? (
                <GemIcon size={16} className="text-white" />
              ) : isBooking ? (
                <TicketIcon size={16} className="text-white" />
              ) : isProduct ? (
                <PackageIcon size={16} className="text-white" />
              ) : (
                <ReceiptText size={16} className="text-white" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${PURCHASE_KIND_BADGE[kind]}`}
                >
                  {PURCHASE_KIND_LABEL[kind]}
                </span>
                <p className="truncate text-sm font-semibold text-brand-900">{title}</p>
              </div>
              <p className="text-[11px] text-gray-500">{humanizePaymentStatus(displayStatus)}</p>
            </div>
            <p className="shrink-0 text-base font-bold text-brand-900">{formatCurrency(String(amount))}</p>
          </div>
          {isPending && expiresAtMs > 0 && (
            <p className="mt-2 font-mono text-[11px] font-bold text-red-600">Expires in {formatExpiryCountdown(remainingMs)}</p>
          )}

          <div className="mt-2 space-y-2 border-t border-brand-50 pt-2 text-sm">
            {lifecycle && (
              <Row label={isPackage ? "Purchase" : isBooking ? "Booking" : "Fulfillment"} value={String(lifecycle)} capitalize />
            )}
            {isPackage && item.package_credits != null && (
              <Row label="Credits" value={`${String(item.package_credits)} credits`} />
            )}
            {isBooking && item.class_name && <Row label="Class" value={String(item.class_name)} />}
            {item.purchased_at && (
              <Row label="Purchased" value={formatDateHelper(String(item.purchased_at), "dd MMM yyyy · HH:mm")} />
            )}
            {item.expires_at && (
              <Row label="Pay before" value={formatDateHelper(String(item.expires_at), "dd MMM yyyy · HH:mm")} />
            )}
            {item.voucher_code && <Row label="Voucher" value={String(item.voucher_code)} mono />}
            {discount > 0 && <Row label="Discount" value={`− ${formatCurrency(String(discount))}`} />}
            {item.order_id && <Row label="Order ID" value={String(item.order_id)} mono />}
            {item.provider_txn_id && <Row label="Transaction ID" value={String(item.provider_txn_id)} mono />}
            {item.created_at && (
              <Row label="Created" value={formatDateHelper(String(item.created_at), "dd MMM yyyy · HH:mm")} />
            )}
          </div>
        </div>

        {nativeInstructions && isPending && (
          <NativeInstructionsComponent
            instructions={nativeInstructions}
            amountIdr={statusData?.data?.amount_idr ?? statusData?.data?.gross_amount_idr ?? amount}
            channelLabel={statusData?.data?.channel_label}
            remainingMs={paymentRemainingMs}
          />
        )}

        {isPending && !nativeInstructions && (
          <>
            <Button className="min-h-12 w-full text-sm font-extrabold" onClick={handleContinue}>
              Continue payment
            </Button>
            {resumeUrl && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = resumeUrl;
                }}
                className="w-full text-center text-xs font-medium text-brand-500/70 underline underline-offset-2"
              >
                Trouble opening it? Continue on the payment page
              </button>
            )}
            <Button variant="outline" className="min-h-11 w-full text-sm font-semibold" onClick={() => setChangeOpen(true)}>
              Change payment method
            </Button>
          </>
        )}

        {isPending && (
          <Button
            variant="outline"
            className="min-h-11 w-full text-sm font-semibold"
            onClick={() => {
              void refetchStatus();
              void refetch();
            }}
          >
            I&apos;ve completed payment — check status
          </Button>
        )}

        {isPackage && !isPending && (isPaymentRetryable(status) || displayStatus === "expired") && (
          <Button
            className="min-h-12 w-full text-sm font-extrabold"
            onClick={() => handlePackageAction()}
            disabled={retryMutation.isPending}
          >
            {retryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Retry payment
          </Button>
        )}

        {!isPending && (SUCCESS.includes(status)) && (
          <Button
            className="min-h-12 w-full text-sm font-extrabold"
            onClick={() =>
              router.push(
                isBooking
                  ? "/profile/my-sessions"
                  : isProduct
                    ? item.payable_id
                      ? `/profile/orders/${String(item.payable_id)}`
                      : "/profile/orders"
                    : "/profile/my-credits"
              )
            }
          >
            {isBooking ? "View My Class" : isProduct ? "View My Order" : "View My Credits"}
          </Button>
        )}
        <div className="text-center">
          <Button variant="link" className="text-xs" onClick={() => router.push("/profile/purchase-history")}>
            Back to history
          </Button>
        </div>
      </div>
      {changeOpen && (
        <BaseDialogComponent
          isOpen={changeOpen}
          title="Change payment method?"
          btnConfirm={retryMutation.isPending ? "Working..." : "Yes, change"}
          onConfirm={handlePackageAction}
          onClose={() => setChangeOpen(false)}
          onCloseText="Cancel"
          isDisabled={retryMutation.isPending}
        >
          <p className="text-center text-sm leading-relaxed text-brand-500">
            Are you sure you want to change the payment method? The current order will be cancelled and a new one will be created. You&apos;ll choose the new method on the payment page.
          </p>
        </BaseDialogComponent>
      )}

    </div>
  );
};

function Row({ label, value, mono, capitalize }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-[13px] text-gray-500">{label}</span>
      <span className={`truncate text-right text-[13px] font-medium text-brand-900 ${mono ? "font-mono text-xs" : ""} ${capitalize ? "capitalize" : ""}`}>
        {value}
      </span>
    </div>
  );
}

