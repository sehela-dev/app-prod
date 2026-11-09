export const ENV = (process.env.ENV as string) ?? "dev";

export const MAIN_API_URL = ENV === "dev" ? process.env.API_URL : (process.env.MAIN_API_URL as string);
export const MAIN_AUTH_API_URL = ENV === "dev" ? process.env.DEV_AUTH_API_URL : (process.env.MAIN_AUTH_API_URL as string);
export const SECRET_KEY = ENV === "dev" ? process.env.DEV_SECRET_KEY : (process.env.MAIN_SECRET_KEY as string);
export const AUTH_KEY = ENV === "dev" ? process.env.DEV_SECRET_AUTH_KEY : (process.env.MAIN_SECRET_AUTH_KEY as string);

// Public Midtrans client key for snap.js. Optional: when absent, checkout falls
// back to the snap_redirect_url flow. Never put the server key here.
export const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY as string | undefined;

// FE-12 change-method UI. On by default; set ENABLE_PAYMENT_CHANGE=false to disable.
const PAYMENT_CHANGE_FLAG = process.env.ENABLE_PAYMENT_CHANGE;
export const ENABLE_PAYMENT_CHANGE = PAYMENT_CHANGE_FLAG ? PAYMENT_CHANGE_FLAG === "true" : true;

// FE-19 native VA/QRIS page. Hard-off: prod is Snap-only (2026-11-09 decision)
// and the merchant is not provisioned for legacy Core API. Re-enable here only
// after Midtrans activates native channels. Channel selection still uses
// /public/payment-channels either way.
export const ENABLE_NATIVE_PAYMENT = false;

// Member voucher package top-up. On by default; set
// ENABLE_MEMBER_VOUCHER_PACKAGE=false to disable.
const MEMBER_VOUCHER_PACKAGE_FLAG = process.env.ENABLE_MEMBER_VOUCHER_PACKAGE;
export const ENABLE_MEMBER_VOUCHER_PACKAGE = MEMBER_VOUCHER_PACKAGE_FLAG
  ? MEMBER_VOUCHER_PACKAGE_FLAG === "true"
  : true;

// Held/released copy. On by default; set
// ENABLE_MEMBER_VOUCHER_LIFECYCLE=false to disable.
const MEMBER_VOUCHER_LIFECYCLE_FLAG = process.env.ENABLE_MEMBER_VOUCHER_LIFECYCLE;
export const ENABLE_MEMBER_VOUCHER_LIFECYCLE = MEMBER_VOUCHER_LIFECYCLE_FLAG
  ? MEMBER_VOUCHER_LIFECYCLE_FLAG === "true"
  : true;

if (!MAIN_API_URL) {
  throw new Error("MAIN_API_URL  is not defined in environment variables");
}
if (!SECRET_KEY) {
  throw new Error("SECRET_KEY is not defined in environment variables");
}

export const DEFAULT_PASSWORD = "SecurePass123!";
export const AUTH_ACTION = {
  LOGIN: "login",
  REGISTER: "register",
  RESET: "reset_password",
};

export const validationStatus = (data: number | string) => {
  switch (data) {
    case 401:
      return "UNAUTHORIZED";
    case 400:
      return "BAD REQUEST";
    case 403:
      return "FORBIDDEN";
    case 422:
      return "BASIC VALIDATION";
    default:
      return "ERROR";
  }
};

export interface IResponseData<T> {
  statusCode: number;
  message: string;
  data: T;
  pagination?: IPagiantion;
}

export interface IPagiantion {
  page: number;
  page_size: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_prev: boolean;
}
