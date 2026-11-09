"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, MapPin, TicketPercent, Users, Video, X } from "lucide-react";

import { CircleCheckSvg } from "@/components/asset/svg/CircleCheckSvg";
import { CircleInfoSvg } from "@/components/asset/svg/CircleInfoSvg";
import { CardCreditComponent } from "@/components/general/card-credit";
import { CheckoutSessionCardComponent } from "@/components/general/checkout-session-card";

import { StickyContainerComponent } from "@/components/layout";
import { NavHeaderComponent } from "@/components/layout/header-checkout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { usePaymentMethodCtx } from "@/context/payment-method.ctx";
import { useCreateBooking, useCreatePublicBooking, useValidateVoucher } from "@/hooks/api/mutations/customers";
import { useGetEligibleCredits, useGetMyCredits } from "@/hooks/api/queries/customer/profile";
import { useGetPublicSession } from "@/hooks/api/queries/customer/public";
import { ENABLE_MEMBER_VOUCHER_LIFECYCLE } from "@/lib/config";
import { formatEligibleTime, formatInstructorNames } from "@/lib/credit-package";
import { formatDateHelper } from "@/lib/helper";
import {
  getSessionTypeRestrictionCopy,
  getVoucherErrorMessage,
  isVoucherErrorCode,
  VOUCHER_HELD_NOTE,
  VOUCHER_PREVIEW_NOTE,
} from "@/lib/voucher";
import { cn } from "@/lib/utils";
import { getSessionLevelBadge, getSessionTypeBadge } from "@/utils/session-badge";
import type { IEligibleCreditPackage, IValidateVoucherResponse } from "@/types/customer-app/booking.interface";

type PaymentMethod = "credit" | "cash";

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "cash", label: "Pay online" },
  { id: "credit", label: "Credit Package(s)" },
];

const getDuration = (start: string, end: string): string => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const total = eh * 60 + em - (sh * 60 + sm);
  return total > 0 ? `${total} min` : "";
};

const formatRestrictionValue = (value?: string | string[] | null) => {
  if (!value) return "";
  const text = Array.isArray(value) ? value.join(", ") : value;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const getPackageRestrictionSummary = (item: IEligibleCreditPackage) => {
  const classCount = item.class_ids_restriction?.length ?? 0;
  const instructors = formatInstructorNames(item.instructor_ids_restriction);
  return [
    formatRestrictionValue(item.session_type_restriction),
    formatRestrictionValue(item.place_restriction),
    classCount ? `${classCount} class${classCount > 1 ? "es" : ""}` : "",
    instructors ? `Instructor: ${instructors}` : "",
    formatEligibleTime(item.eligible_start_time, item.eligible_end_time) ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
};

export const CheckoutSessionView = () => {
  const router = useRouter();
  const { id } = useParams();
  const { paymentType, onChangePaymentMethod } = usePaymentMethodCtx();
  const [selectedCredit, setSelectedCredit] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [validatedVoucher, setValidatedVoucher] = useState<IValidateVoucherResponse | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  const { data: session, isLoading, isError, refetch: refetchSession } = useGetPublicSession(typeof id === "string" ? id : undefined);
  const { data: creditsData, isLoading: creditsLoading } = useGetMyCredits();
  const eligibleParams = session?.id ? { class_session_id: session.id } : undefined;

  const {
    data: eligibleCreditsData,
    isLoading: eligibleLoading,
    refetch: refetchEligibleCredits,
  } = useGetEligibleCredits(eligibleParams);
  // usinf credit
  const { mutateAsync, isPending: bookingPending } = useCreateBooking();
  // using cash
  const { mutateAsync: mutatePublicBooking, isPending: publicBookingPending } = useCreatePublicBooking();
  const { mutateAsync: validateVoucherAsync, isPending: voucherValidating } = useValidateVoucher();

  const isCreditOnly = !!session?.is_credit_only || session?.price_idr === 0;
  const allowCredit = !!session?.allow_credit && (session?.price_credit_amount ?? 0) > 0;
  const showCredit = isCreditOnly ? allowCredit : paymentType === "credit" && allowCredit;

  useEffect(() => {
    if (isCreditOnly && paymentType !== "credit" && allowCredit) onChangePaymentMethod("credit");
  }, [isCreditOnly, paymentType, allowCredit, onChangePaymentMethod]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center gap-4 font-serif text-brand-500">
        <p className="font-semibold">{isError ? "Something went wrong while loading this session." : "Session not found."}</p>
        <p className="text-sm text-brand-500/70">It may have started or is no longer available.</p>
        <Button onClick={() => router.push("/book")}>Back to Book</Button>
      </div>
    );
  }

  const sessionCreditPrice = session.price_credit_amount ?? 1;
  const availableCredits = eligibleParams ? eligibleCreditsData?.data ?? [] : creditsData?.data?.filter((item) => !item.is_expired) ?? [];
  const creditsListLoading = eligibleParams ? eligibleLoading : creditsLoading;
  const selectedPackage = availableCredits.find((item) => item.package_purchase_id === selectedCredit);
  const selectedPackageRestriction = selectedPackage ? getPackageRestrictionSummary(selectedPackage) : "";
  const isOnline = session.place === "online";
  const levelBadge = getSessionLevelBadge(session.level);
  const typeBadge = getSessionTypeBadge(session.type);

  const onSelectWalletCredit = (id: string) => {
    setSelectedCredit((prev) => (prev === id ? null : id));
  };

  const handleApplyVoucher = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setVoucherError(null);
    try {
      const raw = await validateVoucherAsync({
        voucher_code: code,
        transaction_type: "booking",
        class_session_id: session!.id,
      });
      // raw is { success, data } per edge function
      const v: IValidateVoucherResponse = (raw as unknown as { data: IValidateVoucherResponse }).data ?? (raw as unknown as IValidateVoucherResponse);
      if (v.is_valid) {
        setAppliedCoupon(v.voucher_code ?? code);
        setValidatedVoucher(v);
        setVoucherError(null);
      } else {
        const mismatchCopy =
          v.error_code === "VOUCHER_SESSION_TYPE_MISMATCH" ? getSessionTypeRestrictionCopy(v.session_types) : null;
        setAppliedCoupon(null);
        setValidatedVoucher(null);
        setVoucherError(mismatchCopy || getVoucherErrorMessage(v.error_code, v.error_message) || "Kode diskon tidak valid.");
      }
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
      const msg =
        getVoucherErrorMessage(code) ||
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (err as Error)?.message ||
        "Gagal mengecek kode diskon";
      setVoucherError(msg);
      setAppliedCoupon(null);
      setValidatedVoucher(null);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedCoupon(null);
    setValidatedVoucher(null);
    setVoucherError(null);
    setCouponInput("");
  };

  const handleCouponInputChange = (val: string) => {
    setCouponInput(val);
    if (voucherError) setVoucherError(null);
  };

  // derived pricing for online payment
  const subtotal = session?.price_idr ?? 0;
  const discount = validatedVoucher?.calculated_discount ?? 0;
  const total = validatedVoucher?.discounted_total_idr ?? subtotal;
  const sessionRestrictionCopy = getSessionTypeRestrictionCopy(validatedVoucher?.session_types);

  const handleProcessPayment = async () => {
    const handleBookingError = async (err: unknown) => {
      const data = (err as { response?: { data?: { error?: { code?: string; message?: string }; success?: boolean } } })?.response?.data;
      const code = data?.error?.code;
      if (code === "PROFILE_INCOMPLETE") {
        const fullPath = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : `/checkout/${id as string}`;
        router.replace(`/complete-profile?next=${encodeURIComponent(fullPath)}`);
        return true;
      }
      if (code === "CREDIT_AMOUNT_MISMATCH") {
        // Price changed since page load — refresh session so UI shows the new price.
        await refetchSession();
        return false; // let the mutation toast show data.error.message ("This session costs N credits")
      }
      if (code === "CREDIT_PACKAGE_NOT_ELIGIBLE") {
        // The package rules changed or the selection no longer matches this session.
        setSelectedCredit(null);
        await refetchEligibleCredits();
        return false; // mutation toast shows the server message
      }
      if (code === "MIDTRANS_ERROR" || code === "MIDTRANS_CONNECTION_ERROR" || code === "SESSION_FULL") {
        // BE has already released the slot / changed the session state.
        await refetchSession();
        return false;
      }
      if (code === "PAYMENT_INSTRUCTIONS_UNAVAILABLE") {
        // Charge cancelled and slot released; the booking was expired on create.
        await refetchSession();
        return false;
      }
      if (code === "DUPLICATE_BOOKING") {
        router.push("/profile/my-sessions");
        return true;
      }
      if (isVoucherErrorCode(code)) {
        // The server rejected the reservation; drop the stale preview and show the new total.
        handleRemoveVoucher();
        return false;
      }
      return false;
    };
    if (paymentType === "credit" && selectedCredit) {
      try {
        await mutateAsync({
          class_session_id: session.id,
          payment_method: "credits",
          package_purchase_id: selectedCredit,
          credits_to_use: sessionCreditPrice,
        });
        router.push(`/checkout/${id}/success`);
      } catch (err) {
        if (await handleBookingError(err)) return;
        // error toast handled by the mutation config; user can retry with another package
      }
    } else if (paymentType === "cash") {
      try {
        const voucher_code = appliedCoupon ? appliedCoupon.trim().toUpperCase() : undefined;
        const response = await mutatePublicBooking({
          class_session_id: session.id,
          payment_method: "midtrans",
          ...(voucher_code ? { voucher_code } : {}),
        });
        const bookingData = response.data;
        if (bookingData?.payment_status === "paid" || Number(bookingData?.amount_idr ?? 1) === 0) {
          router.push(`/checkout/${id}/success`);
        } else if (bookingData?.booking_id) {
          // Pass the create-time token/URL so the popup can open without a
          // second (possibly stale) detail fetch.
          const qs = new URLSearchParams({ booking_id: bookingData.booking_id });
          if (bookingData.snap_token) qs.set("snap_token", bookingData.snap_token);
          if (bookingData.snap_redirect_url) qs.set("snap_redirect_url", bookingData.snap_redirect_url);
          // Snap opens as an overlay on the cash-payment page.
          router.push(`/checkout/${id}/cash-payment?${qs.toString()}`);
        } else {
          router.push(`/checkout/${id}/success`);
        }
      } catch (err) {
        if (await handleBookingError(err)) return;
        // error toast handled by the mutation config
      }
    }
  };

  return (
    <>
      <div className="flex flex-col w-full font-serif min-h-full text-brand-500">
        <NavHeaderComponent />
        <div className="flex w-full px-4 flex-col gap-4 mt-4 pb-28">
          <h3 className="font-semibold">Order Items</h3>
          <CheckoutSessionCardComponent
            time={session.time_start}
            duration={getDuration(session.time_start, session.time_end)}
            title={session.session_name}
            location={session.place === "online" ? "Online" : session.location_name ?? ""}
            date={formatDateHelper(session.start_date, "EEEE, dd MMM yyyy")}
            instructor={session.instructor_name ?? undefined}
          />

          {/* Session details */}
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">Session Details</h3>
            <div className="rounded-xl border border-brand-100 bg-brand-25 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Badge className={`rounded-full text-xs ${typeBadge.className}`}>{typeBadge.label}</Badge>
                {levelBadge && <Badge className={`rounded-full text-xs ${levelBadge.className}`}>{levelBadge.label}</Badge>}
              </div>

              {session.session_description && <p className="text-sm leading-relaxed text-brand-500/80">{session.session_description}</p>}

              <div className="h-px w-full bg-brand-100" />

              <div className="flex flex-col gap-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-brand-500/60">
                    <Users size={14} className="shrink-0" /> Instructor
                  </span>
                  <span className="font-semibold text-right">{session.instructor_name ?? "To be announced"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-brand-500/60">
                    {isOnline ? <Video size={14} className="shrink-0" /> : <MapPin size={14} className="shrink-0" />} Place
                  </span>
                  <span className="font-semibold text-right">{isOnline ? "Online session" : session.location_name ?? "Offline"}</span>
                </div>
                {!isOnline && session.location_address && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-brand-500/60">
                      <MapPin size={14} className="shrink-0" /> Address
                    </span>
                    <span className="font-semibold text-right">{session.location_address}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-brand-500/60">
                    <Users size={14} className="shrink-0" /> Availability
                  </span>
                  <span className="font-semibold text-right">
                    {session.is_full ? "Fully booked" : `${session.slots_available} of ${session.slots_total} seats left`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment method */}
          {isCreditOnly ? (
            <div className="rounded-xl border border-brand-500/20 bg-brand-25 p-3 flex items-center gap-2">
              <Badge className="bg-brand-500 text-gray-50">Credit Only</Badge>
              <p className="text-xs text-brand-500/70">This session only accepts credits.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">How would you like to pay?</h3>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const disabled = method.id === "credit" && !allowCredit;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChangePaymentMethod(method.id)}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-sm font-bold transition-colors",
                        disabled && "opacity-40 cursor-not-allowed",
                        paymentType === method.id
                          ? "bg-brand-500 border-brand-500 text-gray-50"
                          : "border-brand-100 bg-brand-25 text-brand-500 hover:border-brand-500",
                      )}
                    >
                      {method.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showCredit ? (
            <div className="flex flex-col gap-4 w-full">
              <div className="flex items-center w-full justify-between">
                <p className="font-semibold">My Credit</p>
                <Button
                  className="bg-brand-100 border text-sm border-brand-500 rounded-xl"
                  variant={"secondary"}
                  onClick={() => router.push("/topup-credit")}
                >
                  Top Up Credit
                </Button>
              </div>

              {creditsListLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : availableCredits.length === 0 ? (
                <div className="bg-[#E3F2DC] min-h-[66px] border border-[#CB8D42] gap-2 rounded-xl p-4 flex flex-row items-center">
                  <CircleInfoSvg />
                  <p className="text-sm font-medium text-[#CB8D42]">Oops! You don’t have any credits. Top up to join the class.</p>
                </div>
              ) : (
                <>
                  <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex flex-row items-center gap-2">
                      {availableCredits.map((item) => {
                        const insufficient = (item.credits_remaining ?? 0) < (session.price_credit_amount ?? 0);
                        return (
                          <CardCreditComponent
                            key={item.package_purchase_id}
                            id={item.package_purchase_id}
                            isActive={selectedCredit === item.package_purchase_id}
                            title={item.package_name}
                            value={item.credits_remaining}
                            totalCredits={item.total_credits}
                            description={item.package_description}
                            restriction={getPackageRestrictionSummary(item)}
                            isShared={item.is_shared}
                            expiryDate={item.expires_at ?? undefined}
                            disabled={insufficient}
                            onClick={() => !insufficient && onSelectWalletCredit(item.package_purchase_id)}
                          />
                        );
                      })}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                  {selectedPackage && (
                    <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-25 p-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-brand-500/60">Credits to use</span>
                        <span className="text-base font-bold">
                          {sessionCreditPrice} Credit{sessionCreditPrice > 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="text-xs text-brand-500/70">
                        Using credits from {selectedPackage.package_name} ({selectedPackage.credits_remaining} remaining).
                      </p>
                      {selectedPackageRestriction && (
                        <p className="text-xs text-brand-500/70">{selectedPackageRestriction}</p>
                      )}
                      <p className="text-xs text-brand-500/70">
                        {selectedPackage.expires_at
                          ? `Expires ${formatDateHelper(selectedPackage.expires_at, "dd MMM yyyy")}`
                          : "No expiry"}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2.5 w-full">
                    <h3 className="font-semibold">Order Summary</h3>
                    <div className="flex flex-row items-center justify-between w-full text-sm">
                      <p>Total Price</p>
                      <p className="text-right font-semibold">
                        {sessionCreditPrice} Credit{sessionCreditPrice > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h3 className="font-semibold">Kode diskon</h3>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      className="min-h-[48px] rounded-xl border-brand-100 bg-white pl-10 pr-3"
                      placeholder="Masukkan kode diskon"
                      value={couponInput}
                      onChange={(e) => handleCouponInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleApplyVoucher();
                        }
                      }}
                      disabled={!!appliedCoupon}
                    />
                    <TicketPercent size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-500/40" />
                  </div>
                  <Button
                    type="button"
                    className="min-h-[48px] rounded-xl bg-brand-500 px-6 text-gray-50"
                    onClick={handleApplyVoucher}
                    disabled={!couponInput.trim() || voucherValidating || !!appliedCoupon}
                  >
                    {voucherValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>

                {appliedCoupon && validatedVoucher ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-brand-500/40 bg-brand-25 py-3 pl-4 pr-2">
                      <div className="flex items-center gap-3">
                        <CircleCheckSvg />
                        <div className="flex flex-col">
                          <p className="text-sm font-semibold uppercase">{appliedCoupon}</p>
                          <p className="text-xs text-brand-500/60">
                            {validatedVoucher.voucher_name
                              ? `${validatedVoucher.voucher_name} — Rp ${validatedVoucher.calculated_discount.toLocaleString("id-ID")} off`
                              : `Rp ${validatedVoucher.calculated_discount.toLocaleString("id-ID")} off your booking`}
                          </p>
                          {sessionRestrictionCopy && <p className="text-xs text-brand-500/60">{sessionRestrictionCopy}</p>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveVoucher}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-brand-500/50 transition-colors hover:bg-brand-100 hover:text-brand-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {ENABLE_MEMBER_VOUCHER_LIFECYCLE && <p className="text-[11px] text-brand-500/60">{VOUCHER_PREVIEW_NOTE}</p>}
                    {ENABLE_MEMBER_VOUCHER_LIFECYCLE && <p className="text-[11px] text-brand-500/60">{VOUCHER_HELD_NOTE}</p>}
                  </div>
                ) : voucherError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-xs font-medium text-red-600">{voucherError}</p>
                  </div>
                ) : (
                  <p className="text-xs text-brand-500/50">Have a promo code? Apply it here before checkout.</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-semibold">Order Summary</h3>
                <div className="flex flex-col gap-2.5 rounded-xl border border-brand-100 bg-brand-25 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-brand-500/60">Subtotal</span>
                    <span className="font-semibold">Rp {subtotal.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-brand-500/60">Discount</span>
                    <span className={cn("font-semibold", discount > 0 ? "text-emerald-600" : "text-brand-500")}>
                      {discount > 0 ? `- Rp ${discount.toLocaleString("id-ID")}` : "Rp 0"}
                    </span>
                  </div>
                  <div className="h-px w-full bg-brand-100" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-lg font-extrabold">
                      {total === 0 && discount > 0 ? "Gratis" : `Rp ${total.toLocaleString("id-ID")}`}
                    </span>
                  </div>
                  {total === 0 && discount > 0 && (
                    <p className="text-right text-[11px] text-brand-500/60">Gratis — tidak perlu pembayaran.</p>
                  )}
                </div>
              </div>

            </>
          )}
        </div>
      </div>
      <StickyContainerComponent>
        <div className="flex w-full p-4">
          <Button
            className="w-full min-h-[48px]"
            disabled={(showCredit && !selectedCredit) || bookingPending || publicBookingPending}
            onClick={handleProcessPayment}
          >
            {(bookingPending || publicBookingPending) && <Loader2 className="h-4 w-4 animate-spin" />}
            {bookingPending || publicBookingPending ? "Booking..." : "Process Payment"}
          </Button>
        </div>
      </StickyContainerComponent>
    </>
  );
};
