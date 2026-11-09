"use client";
import { NavHeaderComponent } from "@/components/layout/header-checkout";
import { Button } from "@/components/ui/button";
import { useAuthMember } from "@/context/member.ctx";
import { useGetPublicCreditPackageDetail } from "@/hooks/api/queries/customer/public";
import { useGetPaymentStatus } from "@/hooks/api/queries/customer/payments";
import type { IPaymentStatus } from "@/api-req/customer-app/payments";
import { formatCurrency } from "@/lib/helper";
import {
  PACKAGE_PAYMENT_FAILURE_STATUSES,
  PACKAGE_PAYMENT_SUCCESS_STATUSES,
  clearPendingPackagePayment,
  formatExpiryCountdown,
  getPendingPackagePayment,
  humanizePaymentStatus,
} from "@/lib/pending-package-payment";
import { NativeInstructionsComponent } from "@/view/payment/native-instructions";
import { AlertCircle, CheckCircle, Clock, ExternalLink, GemIcon, Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Pending host page for package purchases — mirrors checkout/[id]/cash-payment:
// Midtrans opens in a new tab, this page owns the countdown + status.
export const PackagePaymentView = () => {
  const router = useRouter();
  const { id } = useParams();
  const packageId = typeof id === "string" ? id : "";
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const snapParam = searchParams.get("snap_redirect_url");
  const expiresParam = searchParams.get("expires_at");
  const createdParam = searchParams.get("created_at");

  const { data: packageData } = useGetPublicCreditPackageDetail(packageId || null);
  const { data: statusData, refetch } = useGetPaymentStatus(orderId);
  const { isAuthenticated, isNewMember } = useAuthMember();
  const statusRow = statusData?.data as (IPaymentStatus & { snap_redirect_url?: string; expires_at?: string; created_at?: string }) | undefined;

  const stored = getPendingPackagePayment();
  const storedMatch = stored && (!orderId || stored.order_id === orderId) ? stored : null;
  const snapUrl = snapParam || storedMatch?.snap_redirect_url || statusRow?.snap_redirect_url || null;
  const pi = statusRow?.payment_instructions ?? null;
  const isRedirect = pi?.type === "redirect" || (!pi && Boolean(snapUrl));
  const nativeInstructions = pi && pi.type !== "redirect" ? pi : null;

  const serverStatus = statusRow?.transaction_status ?? "";
  const isSettled = PACKAGE_PAYMENT_SUCCESS_STATUSES.includes(serverStatus);
  const isFailed = PACKAGE_PAYMENT_FAILURE_STATUSES.includes(serverStatus);

  // Expiry anchor: instructions > server expires_at > row created_at + 15m > initiate-time + 15m
  const expiresAtMs = pi?.expires_at
    ? Date.parse(pi.expires_at)
    : expiresParam
      ? Date.parse(expiresParam)
      : statusRow?.expires_at
        ? Date.parse(statusRow.expires_at)
        : (statusRow?.created_at || createdParam)
          ? Date.parse(String(statusRow?.created_at ?? createdParam)) + 15 * 60 * 1000
          : (storedMatch?.initiated_at ?? Date.now()) + 15 * 60 * 1000;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (isSettled || isFailed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isSettled, isFailed]);
  const remainingMs = expiresAtMs - now;
  const backendExpired = serverStatus === "expire" || serverStatus === "expired" || isFailed;
  const isExpired = backendExpired || remainingMs <= 0;
  const isPending = !!orderId && !isSettled && !isExpired && !isFailed;

  useEffect(() => {
    if (isSettled || isFailed || isExpired) clearPendingPackagePayment();
  }, [isSettled, isFailed, isExpired]);
  useEffect(() => {
    if (remainingMs <= 0 && !isSettled && !backendExpired) refetch(); // triggers backend lazy expire
  }, [remainingMs, isSettled, backendExpired, refetch]);

  // Open Snap once for redirect rows only — keeps this page as status host.
  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (!isRedirect || !snapUrl || hasOpenedRef.current || isSettled || isExpired) return;
    hasOpenedRef.current = true;
    const w = window.open(snapUrl, "_blank", "noopener,noreferrer");
    if (!w) hasOpenedRef.current = false;
  }, [isRedirect, snapUrl, isSettled, isExpired]);

  const item = packageData?.data;
  // Same new-members-only guard as list/detail. Only hard-block when the
  // profile has resolved (isNewMember === false) and payment hasn't settled —
  // a settled order was valid at creation, so always show its success state.
  const isNewOnlyBlocked =
    item?.only_for_new_users === true && isAuthenticated && isNewMember === false && !isSettled;

  if (isNewOnlyBlocked) {
    return (
      <div className="flex flex-col w-full font-serif h-full text-brand-500">
        <NavHeaderComponent title="Payment" />
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <p className="font-semibold text-lg">Not available</p>
          <p className="text-sm text-brand-500/70">This package is for new members only — not available for your account.</p>
          <Button className="mt-2 min-h-12 text-sm font-extrabold" onClick={() => router.push("/topup-credit")}>
            Browse packages
          </Button>
        </div>
      </div>
    );
  }

  if (!orderId) {
    return (
      <div className="flex flex-col w-full font-serif h-full text-brand-500">
        <NavHeaderComponent title="Payment" />
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="font-semibold text-lg">Missing order</p>
          <p className="text-sm text-brand-500/70">No payment was started for this package.</p>
          <Button className="mt-2 min-h-12 text-sm font-extrabold" onClick={() => router.push("/topup-credit")}>
            Browse packages
          </Button>
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
            <p className="max-w-[300px] text-sm text-brand-500/70">
              Your credits are on the way — check My Credits for the updated balance.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-brand-100 bg-white p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-500/60">Package</span>
              <span className="font-medium">{item?.name ?? "Credit package"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-500/60">Amount</span>
              <span className="font-bold text-brand-700">
                {formatCurrency(statusRow?.amount_idr ?? statusRow?.gross_amount_idr ?? item?.price_idr ?? 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-500/60">Order ID</span>
              <span className="font-mono text-xs">{orderId.replace(/^#+/, "")}</span>
            </div>
          </div>
          <Button className="min-h-12 w-full text-sm font-extrabold" onClick={() => router.push("/profile/my-credits")}>
            View My Credits
          </Button>
          <Button variant="outline" className="min-h-12 w-full text-sm font-semibold" onClick={() => router.push("/profile/purchase-history")}>
            Purchase history
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
                <GemIcon className="h-5 w-5 text-brand-500" />
              </span>
              <div>
                <p className="font-semibold">Midtrans Payment</p>
                <p className="text-xs text-brand-500/60">{nativeInstructions ? "Secure payment in this page" : "Opened in new tab"}</p>
              </div>
            </div>
            {!isExpired && !isFailed && (
              <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5">
                <Clock className="h-4 w-4 text-red-500" />
                <span className="font-mono text-sm font-bold text-red-600">{formatExpiryCountdown(remainingMs)}</span>
              </div>
            )}
          </div>

          {nativeInstructions && isPending && (
            <NativeInstructionsComponent
              instructions={nativeInstructions}
              amountIdr={
                statusRow?.amount_idr ??
                statusRow?.gross_amount_idr ??
                item?.price_idr ??
                0
              }
              channelLabel={statusRow?.channel_label}
              remainingMs={remainingMs}
            />
          )}

          {isRedirect && snapUrl && !isExpired && !isFailed && (
            <div className="mb-4 rounded-xl border border-brand-200 bg-brand-25 p-4">
              <p className="text-sm font-medium text-brand-700">Payment page opened in new tab</p>
              <p className="mt-1 text-xs text-brand-500/70">If it didn&apos;t open, click below. Keep this page open — we&apos;ll auto-detect success.</p>
              <Button className="mt-3 w-full" onClick={() => window.open(snapUrl, "_blank", "noopener,noreferrer")}>
                <ExternalLink className="h-4 w-4" /> Open Midtrans Payment Page
              </Button>
            </div>
          )}

          <div className="rounded-xl border border-brand-100 bg-brand-25 p-4">
            <h3 className="mb-3 font-semibold">Order Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-brand-500/60">Package</span>
                <span className="text-right font-medium">{item?.name ?? "Credit package"}</span>
              </div>
              {item && (
                <div className="flex justify-between gap-3">
                  <span className="text-brand-500/60">Credits</span>
                  <span className="font-medium">{item.credits} Credits</span>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-brand-500/60">Amount</span>
                <span className="text-lg font-bold">
                  {formatCurrency(
                    statusRow?.amount_idr ??
                    statusRow?.gross_amount_idr ??
                    item?.price_idr ??
                    0,
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-brand-500/60">Order ID</span>
                <span className="font-mono text-xs">{orderId.replace(/^#+/, "")}</span>
              </div>
            </div>
          </div>

          {isPending && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <p className="text-sm font-medium text-blue-700">
                Waiting for payment confirmation{serverStatus ? ` (${humanizePaymentStatus(serverStatus)})` : ""}…
              </p>
            </div>
          )}

          {(isExpired || isFailed) && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-700">
                {isExpired && !isFailed
                  ? "Payment expired — 15m window exceeded. Please start a new payment."
                  : `Payment ${humanizePaymentStatus(serverStatus)} — please start a new payment.`}
              </p>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {isPending && (
              <Button variant="outline" onClick={() => refetch()} className="w-full min-h-12 font-semibold">
                I&apos;ve Completed Payment — Check Status
              </Button>
            )}
            {(isExpired || isFailed) && (
              <Button className="w-full min-h-12 text-sm font-extrabold" onClick={() => router.push(`/topup-credit/${packageId}`)}>
                Try Again
              </Button>
            )}
            {isRedirect && snapUrl && isPending && (
              <button
                onClick={() => window.open(snapUrl, "_blank", "noopener,noreferrer")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-500 bg-white py-3 font-semibold text-brand-500 transition-colors hover:bg-brand-25"
              >
                <ExternalLink className="h-4 w-4" /> Re-open Payment Page
              </button>
            )}
            <button
              onClick={() => router.push("/topup-credit")}
              className="w-full rounded-xl border border-brand-100 bg-white py-3 font-semibold text-brand-500 transition-colors hover:bg-brand-25"
            >
              Browse packages
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
