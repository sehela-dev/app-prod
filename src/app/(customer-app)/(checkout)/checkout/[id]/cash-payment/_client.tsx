"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, QrCode, Clock, CheckCircle, AlertCircle, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { useGetPaymentStatus } from "@/hooks/api/queries/customer/payments";
import { useGetMySessionDetail } from "@/hooks/api/queries/customer/profile";
import { useRemainingTime } from "@/hooks/use-remaining-time";
import { formatDateHelper, normalizeOrderId } from "@/lib/helper";
import { ENABLE_MEMBER_VOUCHER_LIFECYCLE } from "@/lib/config";
import { VOUCHER_HELD_NOTE, VOUCHER_RELEASED_NOTE } from "@/lib/voucher";
import { isPaymentFailure, isPaymentSuccess, isPaymentTerminal } from "@/lib/payment-status";
import { loadSnap } from "@/lib/snap";
import { NativeInstructionsComponent } from "@/view/payment/native-instructions";

const PAYMENT_TIMEOUT_MS = 15 * 60 * 1000; // 15m after bookings.created_at — matches expire_stale_pending_bookings

export default function CashPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = typeof params.id === "string" ? params.id : null;
  const bookingId = searchParams.get("booking_id") as string | null;
  const snapParam = searchParams.get("snap_redirect_url") as string | null;

  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const openedTokenRef = useRef<string | null>(null);
  const snapBusyRef = useRef(false);
  const fallbackOpenedRef = useRef(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Use profile/my-sessions/:id (booking_id) - requested API, not public/sessions or public/bookings
  const { data: detailResp, isLoading, isError, refetch } = useGetMySessionDetail(bookingId ?? undefined);
  const detail = detailResp?.data;

  const snapToken = detail?.payment?.snap_token ?? null;
  // URL param kept for old links only; checkout now passes booking_id alone.
  const snapFallbackUrl = snapParam || detail?.payment?.snap_redirect_url || null;

  const bookingStatus = detail?.booking_status ?? null;
  const paymentStatus = detail?.payment?.status ?? null;
  const orderId = detail?.payment?.order_id ?? null;
  const createdAt = (detail as unknown as { created_at?: string })?.created_at ?? null;

  // Native rows have no snap token; legacy rows have a token but no instructions.
  const pi = detail?.payment?.payment_instructions ?? null;
  const isRedirect = pi?.type === "redirect" || (!pi && Boolean(snapToken || snapFallbackUrl));
  const nativeInstructions = pi && pi.type !== "redirect" ? pi : null;

  const createdMs = createdAt ? Date.parse(createdAt) : NaN;
  const expiresAt = pi?.expires_at ?? (Number.isFinite(createdMs) ? new Date(createdMs + PAYMENT_TIMEOUT_MS).toISOString() : null);
  const expiryRemainingMs = useRemainingTime(expiresAt);
  const timeRemaining = expiryRemainingMs ?? PAYMENT_TIMEOUT_MS;
  const windowExpired = expiryRemainingMs === 0;

  // 15m lazy expiry: now - created_at >=15m → expired (backend does it on next fetch)
  const backendExpired = bookingStatus === "expired" || paymentStatus === "expire" || paymentStatus === "expired";
  const isExpired = backendExpired || windowExpired;
  const isPaymentFailed = isPaymentFailure(paymentStatus);
  const isPaymentSettled = isPaymentSuccess(paymentStatus);
  const isPending = !isPaymentFailed && !isPaymentSettled && bookingStatus === "pending_payment";
  const canPay = isPending && !paymentConfirmed && !isExpired;
  // Poll for every pending row, native or Snap; the hook stops on terminal.
  const shouldPoll = canPay;

  // Poll while pending so the webhook can confirm without a reload. FE-01 caps it.
  const { data: statusResp } = useGetPaymentStatus(shouldPoll ? orderId : null);
  const liveStatus = statusResp?.data?.transaction_status ?? null;

  useEffect(() => {
    if (isPaymentTerminal(liveStatus)) void refetch();
  }, [liveStatus, refetch]);

  const openSnap = useCallback(async () => {
    if (!snapToken || !canPay || snapBusyRef.current) return;
    snapBusyRef.current = true;
    openedTokenRef.current = snapToken;
    const release = () => {
      snapBusyRef.current = false;
    };
    try {
      await loadSnap();
      if (!aliveRef.current) return;
      if (!window.snap) throw new Error("Snap is not available");
      window.snap.pay(snapToken, {
        onSuccess: () => {
          release();
          void refetch();
        },
        onPending: () => {
          release();
          void refetch();
        },
        onError: () => {
          release();
          toast.error("Payment failed", { description: "Please try again.", position: "top-center" });
          void refetch();
        },
        // Closing is not a failure: the token stays valid and the user can reopen.
        onClose: () => {
          release();
          void refetch();
        },
      });
    } catch {
      release();
      if (!aliveRef.current) return;
      // No client key / script blocked / CSP: keep the redirect flow alive.
      if (snapFallbackUrl) {
        toast.error("Secure payment unavailable", { description: "Opening the payment page instead.", position: "top-center" });
        window.location.href = snapFallbackUrl;
      } else {
        toast.error("Payment page unavailable", { description: "Please refresh and try again.", position: "top-center" });
      }
    }
  }, [snapToken, snapFallbackUrl, canPay, refetch]);

  // Open Snap once per token, redirect rows only. onClose keeps the ref, so it never loops.
  useEffect(() => {
    if (!canPay || !isRedirect || !snapToken) return;
    if (openedTokenRef.current === snapToken) return;
    void openSnap();
  }, [canPay, isRedirect, snapToken, openSnap]);

  // No token at all: preserve the old redirect fallback, once.
  useEffect(() => {
    if (!canPay || !isRedirect || snapToken || !snapFallbackUrl || fallbackOpenedRef.current) return;
    fallbackOpenedRef.current = true;
    window.location.href = snapFallbackUrl;
  }, [canPay, isRedirect, snapToken, snapFallbackUrl]);

  useEffect(() => {
    if (bookingStatus === "confirmed" || paymentStatus === "paid" || paymentStatus === "settlement" || paymentStatus === "capture") {
      setPaymentConfirmed(true);
    }
  }, [bookingStatus, paymentStatus]);

  useEffect(() => {
    if (windowExpired && !paymentConfirmed && !backendExpired) refetch(); // triggers backend lazy expire
  }, [windowExpired, paymentConfirmed, backendExpired, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (isError || (!detail && !snapParam)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center gap-4 font-serif text-brand-500">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="font-semibold text-lg">Unable to load payment details</p>
        <p className="text-sm text-brand-500/70">Please try again or contact support</p>
        <Button variant="outline" onClick={() => router.push("/book")} className="mt-2 rounded-xl border-brand-200">
          Back to Booking
        </Button>
      </div>
    );
  }

  const className = detail?.session_name || detail?.class_name || "Class";
  const startDatetime = detail?.start_datetime || "";
  const amountIdr = detail?.amount_paid_idr ?? detail?.total_paid_idr ?? detail?.original_amount_idr ?? detail?.price_idr ?? 0;

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (paymentConfirmed) {
    return (
      <div className="flex flex-col min-h-dvh bg-gray-50 font-serif">
        <div className="flex w-full max-w-md mx-auto px-4 py-8 flex-col gap-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brand-500/20 blur-xl" />
              <div className="relative rounded-full bg-brand-500 p-4 shadow-sm">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="font-extrabold text-2xl text-brand-700">Payment Success</h1>
              <p className="text-sm text-brand-500/70 max-w-[320px] leading-relaxed">
                You&apos;re all set! Your spot at Sehela Space is confirmed.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="rounded-lg bg-brand-50 p-2">
                <CreditCard className="h-4 w-4 text-brand-600" />
              </div>
              <h3 className="font-semibold text-brand-700">Booking Details</h3>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Confirmed
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-brand-500/60 shrink-0">Class</span>
                <span className="font-medium text-brand-900 text-right">{className}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-brand-500/60 shrink-0">Date & Time</span>
                <span className="font-medium text-brand-900 text-right">
                  {startDatetime ? formatDateHelper(startDatetime, "EEEE, dd MMM yyyy HH:mm") : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-brand-500/60">Amount</span>
                <span className="font-bold text-brand-700">Rp {Number(amountIdr).toLocaleString("id-ID")}</span>
              </div>
              <div className="h-px bg-brand-50" />
              <div className="flex items-center justify-between gap-4">
                <span className="text-brand-500/60">Order ID</span>
                <span className="font-mono text-xs text-brand-700">{normalizeOrderId(orderId) || "—"}</span>
              </div>
              {bookingId && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-brand-500/60 text-xs">Booking ID</span>
                  <span className="font-mono text-xs text-brand-500 truncate max-w-[160px]">{bookingId}</span>
                </div>
              )}
            </div>
            <div className="mt-4 rounded-xl bg-brand-25 border border-brand-100 p-3 text-center">
              <p className="text-xs font-medium text-brand-700">✓ Keep this page for check-in</p>
              <p className="text-xs text-brand-500/70 mt-0.5">QR will be available in My Class. Arrive 15 minutes early.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              className="min-h-12 w-full rounded-xl bg-brand-500 text-sm font-bold text-white hover:bg-brand-600 shadow-sm"
              onClick={() => router.push("/profile/my-sessions")}
            >
              View My Class
            </Button>
            <Button
              variant="outline"
              className="min-h-12 w-full rounded-xl border-brand-200 text-brand-600 hover:bg-brand-25 font-semibold"
              onClick={() => router.push("/book")}
            >
              Back to Booking
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50 font-serif">
      <div className="flex w-full max-w-md mx-auto px-4 py-8 flex-col gap-6">
        <div className="text-center">
          <h1 className="font-bold text-2xl text-brand-500">Complete Your Payment</h1>
          <p className="text-brand-500/60 mt-1">Complete your payment securely — we&apos;ll confirm here</p>
        </div>

        <div className="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-100 p-3">
                <QrCode className="h-6 w-6 text-brand-500" />
              </div>
              <div>
                <p className="font-semibold text-brand-500">Midtrans Payment</p>
                <p className="text-xs text-brand-500/60">Secure payment in this page</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-red-50 px-4 py-1.5">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="font-mono font-bold text-red-600">{formatTime(timeRemaining)}</span>
              <span className="text-xs text-red-500">remaining</span>
            </div>
          </div>

          {canPay && nativeInstructions ? (
            <NativeInstructionsComponent
              instructions={nativeInstructions}
              amountIdr={amountIdr}
              channelLabel={detail?.payment?.channel_label}
              remainingMs={expiryRemainingMs}
            />
          ) : canPay && isRedirect && (snapToken || snapFallbackUrl) ? (
            <div className="rounded-xl border border-brand-200 bg-brand-25 p-4 mb-6">
              <p className="text-sm font-medium text-brand-700">{snapToken ? "Secure payment window" : "Payment page"}</p>
              <p className="text-xs text-brand-500/70 mt-1">If it didn&apos;t open, click below. Keep this page open — we&apos;ll auto-detect success.</p>
              <Button
                className="mt-3 w-full rounded-xl bg-brand-500 text-white hover:bg-brand-600"
                onClick={() => (snapToken ? void openSnap() : snapFallbackUrl && (window.location.href = snapFallbackUrl))}
              >
                <ExternalLink className="h-4 w-4" />
                {snapToken ? "Open Payment Window" : "Open Payment Page"}
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-25 p-8 text-center mb-6">
              <CreditCard className="h-12 w-12 mx-auto text-brand-500/50 mb-3" />
              <p className="font-medium text-brand-500">Payment Instructions</p>
              <p className="text-sm text-brand-500/60 mt-1">
                {isExpired ? "Payment window expired. Please make a new booking." : "Payment details are unavailable. Please refresh or contact support."}
              </p>
              {canPay && (
                <Button
                  variant="outline"
                  className="mt-3 rounded-xl border-brand-200 text-brand-600"
                  onClick={() => router.push("/profile/my-sessions")}
                >
                  Go to My Class to Retry
                </Button>
              )}
            </div>
          )}

          <div className="rounded-xl border border-brand-100 bg-brand-25 p-4 mb-6">
            <h3 className="font-semibold text-brand-500 mb-3">Booking Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-500/60">Class</span>
                <span className="font-medium">{className}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-500/60">Date & Time</span>
                <span className="font-medium">{startDatetime ? formatDateHelper(startDatetime, "EEEE, dd MMM yyyy HH:mm") : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-500/60">Amount</span>
                <span className="font-bold text-lg text-brand-500">Rp {Number(amountIdr).toLocaleString("id-ID")}</span>
              </div>
              {orderId && (
                <div className="flex justify-between">
                  <span className="text-brand-500/60">Order ID</span>
                  <span className="font-mono text-xs">{normalizeOrderId(orderId)}</span>
                </div>
              )}
            </div>
          </div>

          {isPending && !isExpired && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 p-4 mb-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <div>
                <p className="text-sm font-medium text-blue-700">Waiting for payment confirmation...</p>
                {ENABLE_MEMBER_VOUCHER_LIFECYCLE && detail?.voucher_code && (
                  <p className="text-xs text-blue-700/80">{VOUCHER_HELD_NOTE}</p>
                )}
              </div>
            </div>
          )}

          {isExpired && !paymentConfirmed && (
            <div className="flex items-center gap-2 rounded-xl bg-zinc-50 border border-zinc-200 p-4 mb-4">
              <AlertCircle className="h-5 w-5 text-zinc-600" />
              <div>
                <p className="text-sm font-medium text-zinc-700">Booking expired — 15m payment window exceeded (payment_expired). Please make a new booking.</p>
                {ENABLE_MEMBER_VOUCHER_LIFECYCLE && detail?.voucher_code && (
                  <p className="text-xs text-zinc-600">{VOUCHER_RELEASED_NOTE}</p>
                )}
              </div>
            </div>
          )}

          {isPaymentFailed && !isExpired && !paymentConfirmed && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 mb-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-700">Payment {paymentStatus}</p>
                <p className="text-xs text-red-600">Go to My Class to retry this booking.</p>
                {ENABLE_MEMBER_VOUCHER_LIFECYCLE && detail?.voucher_code && (
                  <p className="text-xs text-red-600">{VOUCHER_RELEASED_NOTE}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button variant="outline" onClick={() => refetch()} className="w-full rounded-xl border-brand-200 py-3 text-brand-600 font-semibold hover:bg-brand-25">
              I&apos;ve Completed Payment — Check Status
            </Button>
            {isPaymentFailed && !isExpired && !paymentConfirmed && (
              <Button className="w-full rounded-xl bg-brand-500 text-white hover:bg-brand-600" onClick={() => router.push("/profile/my-sessions")}>
                Go to My Class
              </Button>
            )}
            {canPay && isRedirect && (snapToken || snapFallbackUrl) && (
              <button
                onClick={() => (snapToken ? void openSnap() : snapFallbackUrl && (window.location.href = snapFallbackUrl))}
                className="w-full rounded-xl border border-brand-500 bg-white py-3 text-brand-500 font-semibold transition-colors hover:bg-brand-25 flex items-center justify-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                {snapToken ? "Re-open Payment Window" : "Re-open Payment Page"}
              </button>
            )}
            <button
              onClick={() => router.push(isExpired && sessionId ? `/book/session/${sessionId}` : "/book")}
              className="w-full rounded-xl border border-brand-100 bg-white py-3 text-brand-500 font-semibold transition-colors hover:bg-brand-25"
            >
              {isExpired && sessionId ? "Back to Session" : "Back to Booking"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
