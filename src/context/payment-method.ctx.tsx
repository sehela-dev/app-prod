"use client";

import type React from "react";

import { createContext, useContext, useMemo, useState } from "react";

interface IPaymentMethodType {
  paymentType?: "credit" | "cash";
  onChangePaymentMethod: (data: "credit" | "cash") => void;
}

const PaymentMethodContext = createContext<IPaymentMethodType | undefined>(undefined);

export function PaymentMethodProvider({ children }: { children: React.ReactNode }) {
  const [paymentType, setPaymentType] = useState<IPaymentMethodType["paymentType"]>("cash");

  const ctxValue = useMemo(
    () => ({
      paymentType,
      onChangePaymentMethod: (data: IPaymentMethodType["paymentType"]) => setPaymentType(data),
    }),
    [paymentType],
  );

  return <PaymentMethodContext.Provider value={ctxValue}>{children}</PaymentMethodContext.Provider>;
}

export function usePaymentMethodCtx() {
  const ctx = useContext(PaymentMethodContext);
  if (!ctx) throw new Error("usePaymentMethod must be used within PaymentMethodProvider");
  return ctx;
}
