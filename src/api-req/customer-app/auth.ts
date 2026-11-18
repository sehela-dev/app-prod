import { axiosx } from "@/lib/axiosx";
import { MAIN_API_URL, MAIN_AUTH_API_URL } from "@/lib/config";
import {
  TAuthCompleteProfile,
  TAuthCustomerLogin,
  TAuthCustomerSignUp,
  TAuthCustomerVerifyAccount,
  TAuthForgotPassword,
  TAuthProfileCustomer,
  TAuthResetPassword,
} from "@/types/customer-app/auth-customer.interface";

const normEmail = (email: string) => email.trim().toLowerCase();

export const userAuthLogin: TAuthCustomerLogin = async (data) => {
  const res = await axiosx(false).post(`${MAIN_API_URL}/auth/login`, { ...data, email: normEmail(data.email) });
  return res.data;
};

export const userAuthSignUp: TAuthCustomerSignUp = async (data) => {
  // ponytail: signup email must be stored lowercase, or every later lookup (share, forgot-password) misses
  if (data instanceof FormData) {
    const email = data.get("email");
    if (typeof email === "string") data.set("email", normEmail(email));
  } else if (data.email) {
    data.email = normEmail(data.email);
  }
  const res = await axiosx(false).post(`${MAIN_API_URL}/auth/signup`, data);
  return res.data;
};

export const userAuthVerifyEmail: TAuthCustomerVerifyAccount = async (data) => {
  const res = await axiosx(false).post(`${MAIN_API_URL}/auth/verify-email`, { ...data, email: normEmail(data.email) });
  return res.data;
};

export const userAuthResendVerifyEmail: TAuthCustomerVerifyAccount = async (data) => {
  const res = await axiosx(false).post(`${MAIN_API_URL}/auth/resend-verification`, { ...data, email: normEmail(data.email) });
  return res.data;
};

export const userAuthGetProfile: TAuthProfileCustomer = async () => {
  const res = await axiosx(true).get(`${MAIN_API_URL}/profile`);
  return res.data;
};
export const userAuthGetProfileCallback: TAuthProfileCustomer = async (data) => {
  const res = await axiosx(false, data).get(`${MAIN_API_URL}/profile`);
  return res.data;
};

export const userSigInWithGoogle = async () => {
  // dont change this
  const url = `${MAIN_AUTH_API_URL}/authorize?provider=google&redirect_to=https://book.sehelaspace.com/auth/callback`;
  // const url = `${MAIN_AUTH_API_URL}/authorize?provider=google&redirect_to=http://localhost:3000/auth/callback`;
  window.location.href = url;
};

export const userCompleteProfile: TAuthCompleteProfile = async (data) => {
  const res = await axiosx(true).post(`${MAIN_API_URL}/profile/update`, data);
  return res.data;
};

export const verifyCompleteProfileToken = async (email: string | null | undefined, token: string) => {
  // Email is optional: the token identifies the record, and mail clients can mangle the link email.
  const res = await axiosx(false).get(`${MAIN_API_URL}/auth/complete-profile/verify`, {
    params: { ...(email ? { email: normEmail(email) } : {}), token },
  });
  return res.data;
};

export const completeProfileWithToken: import("@/types/customer-app/auth-customer.interface").TCompleteProfileWithToken = async (data) => {
  const res = await axiosx(false).post(`${MAIN_API_URL}/auth/complete-profile`, data.email ? { ...data, email: normEmail(data.email) } : data);
  return res.data;
};

export const resendRegistration = async (data: { email: string }) => {
  const res = await axiosx(false).post(`${MAIN_API_URL}/auth/resend-registration`, { email: normEmail(data.email) });
  return res.data;
};

export const userAuthForgotPassword: TAuthForgotPassword = async (data) => {
  const res = await axiosx(false).post(`${MAIN_API_URL}/auth/forgot-password`, { email: normEmail(data.email) });
  return res.data;
};

export const userAuthResetPassword: TAuthResetPassword = async (data) => {
  const res = await axiosx(false).post(`${MAIN_API_URL}/auth/reset-password`, { ...data, email: normEmail(data.email) });
  return res.data;
};
