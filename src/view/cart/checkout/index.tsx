"use client";

import { getOrderApiError } from "@/api-req/customer-app";
import { StickyContainerComponent } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/context/cart.ctx";
import { useValidateVoucher } from "@/hooks/api/mutations/customers";
import { useCreateProductOrder, useGetAddresses } from "@/hooks/api/queries/customer/orders";
import { ENABLE_MEMBER_VOUCHER_LIFECYCLE } from "@/lib/config";
import { formatCurrency } from "@/lib/helper";
import { getVoucherErrorMessage, isVoucherErrorCode, VOUCHER_HELD_NOTE, VOUCHER_PREVIEW_NOTE } from "@/lib/voucher";
import { cn } from "@/lib/utils";
import type { IValidateVoucherResponse } from "@/types/customer-app/booking.interface";
import { ChevronRight, Loader2, MapPin, ShoppingBag, TicketPercent, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const ERROR_COPY: Record<string, string> = {
  VALIDATION_ERROR: "Please check your order details.",
  INVENTORY_ERROR: "Stock or pickup location changed. Please review your cart.",
  PRODUCT_UNAVAILABLE: "A product is no longer available. Please refresh the shop.",
  ORDER_CREATE_FAILED: "We could not create your order. Please try again.",
  PROFILE_INCOMPLETE: "Please complete your profile and agree to the terms first.",
  ADDRESS_NOT_FOUND: "The selected address no longer exists. Please choose another one.",
  ORDER_CONFIRM_FAILED: "Your order could not be confirmed. Please try again.",
  MIDTRANS_ERROR: "Failed to create payment. Please try again.",
  MIDTRANS_CONNECTION_ERROR: "Failed to create payment. Please try again.",
  CHANNEL_DISABLED: "This payment method is unavailable. Please pick another one.",
  CHANNEL_UNAVAILABLE: "This payment method is unavailable. Please pick another one.",
  PAYMENT_INSTRUCTIONS_UNAVAILABLE: "We couldn't prepare this payment. Please try again.",
  VOUCHER_INVALID: "This discount code is not valid.",
  VOUCHER_CATEGORY_MISMATCH: "This discount code is not valid for product orders.",
  MIN_PURCHASE_NOT_MET: "Your order does not meet the minimum for this discount code.",
  CONFIGURATION_ERROR: "Something went wrong on our side. Please contact support.",
};

export const CartCheckoutView = () => {
  const router = useRouter();
  const { items, isCartReady, subtotal, locationId, locationName, hasMixedLocations, clearCart } = useCart();
  const { data: addresses = [], isLoading: isLoadingAddresses } = useGetAddresses();
  const { mutateAsync, isPending } = useCreateProductOrder();

  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "third_party">("pickup");
  const [addressId, setAddressId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<IValidateVoucherResponse | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const checkoutSucceeded = useRef(false);
  const { mutateAsync: validateVoucherAsync, isPending: voucherValidating } = useValidateVoucher();
  const discount = appliedVoucher?.calculated_discount ?? 0;
  const total = appliedVoucher?.discounted_total_idr ?? subtotal;

  useEffect(() => {
    if (addressId || addresses.length === 0) return;
    setAddressId((addresses.find((a) => a.is_default) ?? addresses[0]).id);
  }, [addresses, addressId]);

  useEffect(() => {
    if (!isCartReady || items.length > 0 || checkoutSucceeded.current) return;
    router.replace("/cart");
  }, [isCartReady, items.length, router]);

  const selectedAddress = addresses.find((a) => a.id === addressId) ?? null;

  const handleApplyVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;
    setVoucherError(null);
    try {
      const raw = await validateVoucherAsync({
        voucher_code: code,
        cart_total_idr: subtotal,
        transaction_type: "order",
      });
      const voucher = (raw as unknown as { data?: IValidateVoucherResponse }).data ?? (raw as unknown as IValidateVoucherResponse);
      if (voucher?.is_valid) {
        setAppliedVoucher(voucher);
        setVoucherInput(voucher.voucher_code ?? code);
      } else {
        setAppliedVoucher(null);
        setVoucherError(getVoucherErrorMessage(voucher?.error_code, voucher?.error_message) || "Kode diskon tidak valid.");
      }
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
      const message =
        getVoucherErrorMessage(code) ||
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (err as Error)?.message ||
        "Gagal mengecek kode diskon";
      setAppliedVoucher(null);
      setVoucherError(message);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherInput("");
    setVoucherError(null);
  };

  const handleCheckout = async () => {
    if (!locationId || items.length === 0 || hasMixedLocations) return;
    if (deliveryMethod === "third_party" && !addressId) {
      toast.error("Please choose a delivery address.");
      return;
    }

    try {
      const res = await mutateAsync({
        location_id: locationId,
        delivery_method: deliveryMethod,
        ...(deliveryMethod === "third_party" && addressId ? { address_id: addressId } : null),
        items: items.map((item) => ({ variant_id: item.variant_id, quantity: item.quantity })),
        ...(notes.trim() ? { notes: notes.trim() } : null),
        ...(appliedVoucher?.voucher_code ? { voucher_code: appliedVoucher.voucher_code } : {}),
      });
      // Clear the cart only after a successful create; suppress the empty-cart
      // redirect so it cannot race the payment/detail navigation below.
      checkoutSucceeded.current = true;
      clearCart();
      // Always land on the in-app payment page (same pattern as booking). That
      // page opens Snap in a new tab or renders native VA/QRIS instructions.
      if (res?.payment_status === "paid") {
        router.replace(`/profile/orders/${res.order_id}`);
        return;
      }
      // Pass the create-time Snap fields so the payment page can open the
      // popup without waiting for a second status fetch.
      const qs = new URLSearchParams();
      if (res.snap_token) qs.set("snap_token", res.snap_token);
      if (res.snap_redirect_url) qs.set("snap_redirect_url", res.snap_redirect_url);
      router.replace(`/profile/orders/${res.order_id}/payment${qs.size ? `?${qs.toString()}` : ""}`);
    } catch (error) {
      const { code, message, details } = getOrderApiError(error);
      const fieldMessage = details ? Object.values(details)[0]?.[0] : undefined;
      const voucherMessage = getVoucherErrorMessage(code);
      if (isVoucherErrorCode(code)) {
        // The server recomputed the cart; drop the stale preview so the total resets.
        setAppliedVoucher(null);
        setVoucherError(voucherMessage || message || null);
      }
      toast.error(fieldMessage || voucherMessage || message || ERROR_COPY[code ?? ""] || "Failed to create order. Please try again.");
    }
  };

  if (!isCartReady || isLoadingAddresses) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    if (checkoutSucceeded.current) {
      return (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-brand-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Redirecting to payment…
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-16 text-center font-serif text-brand-500">
        <ShoppingBag className="h-12 w-12 text-brand-300" />
        <p className="font-semibold">Your cart is empty</p>
        <Button onClick={() => router.push("/shop")}>Go to Shop</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col justify-between font-serif text-brand-500">
      <div className="flex w-full flex-col gap-4 px-4 py-4">
        <h1 className="text-2xl font-extrabold">Checkout</h1>

        <div className="flex flex-col gap-2 rounded-xl border border-brand-100 bg-brand-25 p-3">
          {items.map((item) => (
            <div key={`${item.variant_id}-${item.location_id}`} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold">{item.product_name}</p>
                <p className="text-xs text-brand-400">
                  {item.variant_name} · x{item.quantity}
                </p>
              </div>
              <p className="shrink-0 font-semibold">{formatCurrency(item.price_idr * item.quantity)}</p>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-brand-100 pt-2 text-sm">
            <span className="flex items-center gap-1 text-brand-400">
              <MapPin size={14} /> Pickup at
            </span>
            <span className="font-semibold">{locationName ?? "-"}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-base font-bold">Delivery method</p>
          <RadioGroup value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as "pickup" | "third_party")}>
            <div className="flex items-start justify-between gap-3 rounded-md border border-brand-500 p-3">
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-semibold">Pickup</p>
                <p className="text-brand-400">Collect your order at {locationName ?? "the selected studio"}.</p>
              </div>
              <RadioGroupItem value="pickup" id="pickup" />
            </div>
            <div className="flex items-start justify-between gap-3 rounded-md border border-brand-500 p-3">
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-semibold">Third-party delivery</p>
                <p className="text-brand-400">Shipping fee is paid directly to the courier when applicable.</p>
              </div>
              <RadioGroupItem value="third_party" id="third_party" />
            </div>
          </RadioGroup>
        </div>

        {deliveryMethod === "third_party" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold">Delivery address</p>
              <Link href="/profile/addresses" className="flex items-center text-xs font-semibold underline">
                Manage <ChevronRight size={14} />
              </Link>
            </div>
            {addresses.length === 0 ? (
              <div className="rounded-md border border-dashed border-brand-300 p-3 text-sm">
                <p className="text-brand-400">You have no saved address yet.</p>
                <Button className="mt-2" variant="outline" onClick={() => router.push("/profile/addresses")}>
                  Add address
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {addresses.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => setAddressId(address.id)}
                    className={cn(
                      "flex items-start justify-between gap-3 rounded-md border border-brand-200 p-3 text-left text-sm",
                      addressId === address.id && "border-brand-500 bg-brand-100",
                    )}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold">
                        {address.label || "Address"}
                        {address.is_default && <span className="ml-2 text-[10px] font-bold uppercase text-brand-400">Default</span>}
                      </span>
                      <span className="text-xs text-brand-400">
                        {address.recipient_name} · {address.phone}
                      </span>
                      <span className="text-xs text-brand-400">{address.address}</span>
                    </span>
                    <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full border border-brand-500", addressId === address.id && "bg-brand-500")} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-base font-bold">Kode diskon</p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                className="min-h-11 rounded-xl border-brand-100 bg-white pl-9 pr-3"
                placeholder="Masukkan kode"
                value={voucherInput}
                onChange={(event) => {
                  setVoucherInput(event.target.value);
                  if (voucherError) setVoucherError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleApplyVoucher();
                  }
                }}
                disabled={!!appliedVoucher || voucherValidating}
              />
              <TicketPercent size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-500/40" />
            </div>
            {appliedVoucher ? (
              <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={removeVoucher}>
                <X size={14} /> Remove
              </Button>
            ) : (
              <Button
                type="button"
                className="min-h-11 rounded-xl bg-brand-500 px-4 text-white"
                onClick={handleApplyVoucher}
                disabled={!voucherInput.trim() || voucherValidating}
              >
                {voucherValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
              </Button>
            )}
          </div>
          {appliedVoucher ? (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-emerald-700">
                {appliedVoucher.voucher_code} applied — {formatCurrency(discount)} off
              </p>
              {ENABLE_MEMBER_VOUCHER_LIFECYCLE && <p className="text-[11px] text-brand-400">{VOUCHER_PREVIEW_NOTE}</p>}
              {ENABLE_MEMBER_VOUCHER_LIFECYCLE && <p className="text-[11px] text-brand-400">{VOUCHER_HELD_NOTE}</p>}
            </div>
          ) : voucherError ? (
            <p role="alert" className="text-xs font-medium text-red-600">
              {voucherError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-base font-bold">Notes (optional)</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note for your order"
            className="border-brand-100 bg-brand-00"
            maxLength={500}
          />
        </div>

        <div className="flex flex-col gap-1.5 rounded-md bg-brand-500 p-4 font-semibold text-white">
          <div className="flex items-center justify-between text-sm">
            <p>Subtotal</p>
            <p>{formatCurrency(subtotal)}</p>
          </div>
          {discount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <p>Discount</p>
              <p>- {formatCurrency(discount)}</p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-white/20 pt-2">
            <p>Total</p>
            <p className="text-lg font-bold">{total === 0 && discount > 0 ? "Gratis" : formatCurrency(total)}</p>
          </div>
        </div>
        {deliveryMethod === "third_party" && selectedAddress && (
          <p className="text-xs text-brand-400">Deliver to {selectedAddress.recipient_name} · {selectedAddress.phone}</p>
        )}
      </div>

      <StickyContainerComponent>
        <div className="flex flex-row gap-2 p-4">
          <div className="flex w-full">
            <Button variant="outline" className="w-full text-brand-500" onClick={() => router.push("/cart")}>
              Cancel
            </Button>
          </div>
          <div className="flex w-full">
            <Button
              className="w-full"
              disabled={
                isPending ||
                hasMixedLocations ||
                (deliveryMethod === "third_party" && !addressId)
              }
              onClick={handleCheckout}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Proceed to Pay"}
            </Button>
          </div>
        </div>
      </StickyContainerComponent>
    </div>
  );
};
