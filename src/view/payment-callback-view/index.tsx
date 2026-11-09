"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useGetPaymentStatus } from "@/hooks/api/queries/customer/payments";
import { displayOrderId, normalizeOrderId } from "@/lib/helper";
import { isPaymentFailure, isPaymentSuccess } from "@/lib/payment-status";

export const PaymentCallbackView = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawOrderId = searchParams.get("order_id");
  const orderId = rawOrderId ? normalizeOrderId(rawOrderId) : null;
  const urlTransactionStatus = searchParams.get("transaction_status");

  // Verify actual status from backend (webhook may lag behind Midtrans redirect) — BE now stores without '#', strip for compat
  const { data, isLoading } = useGetPaymentStatus(orderId);

  const serverStatus = data?.data?.transaction_status ?? data?.data?.status;
  const effectiveStatus = serverStatus ?? urlTransactionStatus ?? "";

  const isSuccess = isPaymentSuccess(effectiveStatus);
  const isFailed = isPaymentFailure(effectiveStatus);
  const isPending = !isSuccess && !isFailed && !!effectiveStatus;
  const isUnknown = !isLoading && !effectiveStatus;
  // BE-08: the payment row tells us what was paid; do not parse order_id.
  const payableType = data?.data?.payable_type ?? null;
  const bookingId = data?.data?.booking_id ?? null;
  const isBooking = payableType === "booking";
  const isPackagePurchase = payableType === "package_purchase";
  const isProductOrder = payableType === "order";
  const destination = isPackagePurchase
    ? "/profile/my-credits"
    : isProductOrder
      ? "/profile/orders"
      : isBooking && bookingId
        ? `/profile/my-sessions/${bookingId}`
        : isBooking
          ? "/profile/my-sessions"
          : "/";
  const destinationLabel = isPackagePurchase ? "View My Credits" : isProductOrder ? "View My Orders" : isBooking ? "View My Class" : "Home";

  return (
    <div className="relative flex flex-col w-full gap-8 font-serif mx-auto pt-8 min-h-dvh text-brand-500">
      <div className="flex flex-col items-center gap-4 text-center mt-12 px-4">
        {isPending && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-brand-500" />
            <p className="font-extrabold text-xl">Processing Payment</p>
            <p className="font-normal text-brand-500/70 max-w-[280px]">
              We&apos;re confirming your payment. This usually takes just a few seconds.
            </p>
          </>
        )}

        {isSuccess && (
          <>
            <Image src={"/assets/view/success.png"} alt="success" width={120} height={120} />
            <p className="font-extrabold text-xl">Payment Success</p>
            <p className="font-normal">
              {isProductOrder
                ? "Your order is confirmed. We will process it shortly."
                : isPackagePurchase
                  ? "Your credits have been added to your account."
                  : isBooking
                    ? "You're all set! Your spot at Sehela Space is confirmed."
                    : "Your payment was successful."}
            </p>
          </>
        )}

        {isFailed && (
          <>
            <Image src={"/assets/alert/no-session.png"} alt="failed" width={120} height={120} />
            <p className="font-extrabold text-xl">Payment Not Completed</p>
            <p className="font-normal text-brand-500/70 max-w-[280px]">
              {isProductOrder
                ? "Your payment didn't go through. You can check your order status in My Orders."
                : isPackagePurchase
                  ? "Your payment didn't go through. You can try again from My Credits."
                  : isBooking
                    ? "Your payment didn't go through. Your booking is still reserved — you can try paying again from My Class."
                    : "Your payment didn't go through. Please try again."}
            </p>
          </>
        )}

        {isUnknown && (
          <>
            <Image src={"/assets/alert/no-session.png"} alt="unknown" width={120} height={120} />
            <p className="font-extrabold text-xl">Payment Status Unavailable</p>
            <p className="font-normal text-brand-500/70 max-w-[280px]">
              We couldn&apos;t confirm your payment status right now. Please check your order for the latest update.
            </p>
          </>
        )}

        {orderId && (
          <p className="text-xs text-brand-500/50 font-mono">Order ID: {displayOrderId(orderId)}</p>
        )}

        {!isLoading && (
          <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
            {isPending ? (
              <Button className="min-h-12 text-sm font-extrabold" disabled>
                Waiting for confirmation...
              </Button>
            ) : (
              <Button className="min-h-12 text-sm font-extrabold" onClick={() => router.push(destination)}>
                {destinationLabel}
              </Button>
            )}
            {(isFailed || isPending || isUnknown) && (
              <Button
                variant="outline"
                className="min-h-12 text-sm font-extrabold"
                onClick={() => router.push(isProductOrder ? "/shop" : isPackagePurchase ? "/topup-credit" : isBooking ? "/book" : "/")}
              >
                {isProductOrder ? "Back to Shop" : isPackagePurchase ? "Back to Top Up" : isBooking ? "Back to Book" : "Home"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};