"use client";

import type React from "react";

import { LogoComponent } from "@/components/asset/logo";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/general/password-input";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES, AuthSignUpFormValues, authSignUpSchema, completeProfileTokenSchema } from "@/resolver";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { previewURLHelper } from "@/lib/helper";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompleteProfileWithToken, useUpdateProfile } from "@/hooks/api/mutations/customers";
import { Divider } from "@/components/ui/divider";
import { useRouter, useSearchParams } from "next/navigation";
import { useGetProfile } from "@/hooks/api/queries/customer/profile";
import { useVerifyCompleteProfile } from "@/hooks/api/queries/customer/use-verify-complete-profile";
import { IAuthSignUpPaylaod } from "@/types/customer-app/auth-customer.interface";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, TriangleAlert } from "lucide-react";
import { TncDialog } from "@/components/general/tnc-dialog";
import { useJwtToken } from "@/hooks";
import { resendRegistration } from "@/api-req/customer-app/auth";
import { toast } from "sonner";

const defaultValues = {
  email: "",
  password: "",
  full_name: "",
  phone: "",
  instagram_username: "",
  gender: "",
  date_of_birth: "",
  photo: null,
  photo_consent: false,
  tnc_agreed: false,
  confirm_password: "",
  medical_notes: "",
};
// resolver is chosen per-mode inside component to allow optional password for token path

export const CompleteProfilePageView = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawToken = searchParams.get("token") ?? searchParams.get("code");
  const rawEmail = searchParams.get("email");
  // also support direct window parse for cases where Next's useSearchParams lags
  const fallback = typeof window !== "undefined" ? new URL(window.location.href).searchParams : null;
  const token = rawToken ?? fallback?.get("token") ?? fallback?.get("code") ?? null;
  const emailParam = rawEmail ?? fallback?.get("email") ?? null;
  // ponytail: token alone decides token mode — the email in the link is display-only
  // and mail clients sometimes drop its dot (seen in prod), so never gate on it.
  const isTokenMode = !!token;
  // BE contract: preserve booking intent via ?next (alias ?redirect)
  const rawNext = searchParams.get("next") ?? searchParams.get("redirect") ?? fallback?.get("next") ?? fallback?.get("redirect") ?? null;
  const normalizeNext = (v: string) => (v === "/booking" ? "/book" : v);
  const getSafeNext = (fallback?: string | null) => {
    if (fallback && fallback.startsWith("/") && !fallback.startsWith("//")) return normalizeNext(fallback);
    if (rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")) return normalizeNext(rawNext);
    try {
      const s = sessionStorage.getItem("auth.redirect");
      if (s && s.startsWith("/") && !s.startsWith("//")) return normalizeNext(s);
    } catch {}
    return "/book";
  };

  const { resetJwt, setJwtToken, access_token, isHydrated } = useJwtToken();
  const [tncDialogOpen, setTncDialogOpen] = useState(false);

  // Token path verify (no JWT, 15m)
  const {
    data: verifyData,
    isLoading: verifyLoading,
    error: verifyError,
    refetch: refetchVerify,
  } = useVerifyCompleteProfile(emailParam, token, isTokenMode);

  const verifyErrorCode = (verifyError as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
  // verify resolves the email from the token record; fall back to the link only if the BE is older
  const verifiedEmail = (verifyData as { data?: { email?: string } } | undefined)?.data?.email ?? emailParam;
  const isInvalidToken = ["INVALID_TOKEN", "TOKEN_NOT_FOUND", "TOKEN_EXPIRED", "TOKEN_ALREADY_USED"].includes(verifyErrorCode ?? "");

  // countdown from expires_at
  const expiresAt = (verifyData as { data?: { expires_at?: string } })?.data?.expires_at;
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt || !isTokenMode) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSec(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, isTokenMode]);
  const isExpired = remainingSec === 0;

  // JWT path — only with a session, so an unauthenticated no-token visit can't 401 into "Unable to load"
  const { data: profileUser, isLoading, isError, refetch } = useGetProfile(!isTokenMode && Boolean(access_token));

  useEffect(() => {
    if (!isTokenMode && profileUser?.data?.is_profile_complete) router.replace(getSafeNext());
  }, [profileUser, router, isTokenMode]);

  useEffect(() => {
    if (verifyErrorCode === "ALREADY_COMPLETED") router.replace(getSafeNext());
  }, [verifyErrorCode, router]);

  // no token and no session → nothing to load here; send to login instead of "Unable to load"
  useEffect(() => {
    if (isTokenMode || !isHydrated || access_token) return;
    const next = getSafeNext();
    if (next !== "/profile/my-sessions") router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
    else router.replace("/auth/login");
  }, [isTokenMode, isHydrated, access_token, router]);

  const goToLogin = () => {
    resetJwt();
    const next = getSafeNext();
    if (next !== "/profile/my-sessions") router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
    else router.replace("/auth/login");
  };

  const handleResend = async () => {
    if (!verifiedEmail) return;
    try {
      await resendRegistration({ email: verifiedEmail });
      toast.success("New link sent", { description: "Check your email for a new 15m link.", position: "top-center" });
      refetchVerify();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Please try again later (60s throttle).";
      toast.error("Resend failed", { description: msg, position: "top-center" });
    }
  };

  const values = useMemo(() => {
    if (isTokenMode) {
      const v = verifyData as { data?: { full_name?: string; email?: string } } | undefined;
      return {
        email: v?.data?.email ?? emailParam ?? "",
        full_name: v?.data?.full_name ?? "",
        password: "",
        phone: "",
        instagram_username: "",
        gender: "",
        date_of_birth: "",
        photo: undefined,
        photo_consent: false,
        tnc_agreed: false,
        confirm_password: "",
        medical_notes: "",
      };
    }
    if (!profileUser?.data) return defaultValues;
    return {
      email: profileUser?.data?.email,
      full_name: profileUser?.data?.full_name,
      password: "",
      phone: profileUser?.data?.phone ?? "",
      instagram_username: profileUser?.data?.instagram_username ?? "",
      gender: profileUser?.data?.gender ?? "",
      date_of_birth: profileUser?.data?.date_of_birth,
      photo: undefined,
      photo_consent: false,
      tnc_agreed: false,
      confirm_password: "",
    };
  }, [profileUser, isTokenMode, emailParam, verifyData]);

  const resolver = isTokenMode ? zodResolver(completeProfileTokenSchema) : zodResolver(authSignUpSchema);
  const methods = useForm<AuthSignUpFormValues>({ defaultValues, resolver: resolver as never, mode: "all", values });

  const { control, handleSubmit, setValue } = methods;
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: jwtMutate, isPending: jwtPending } = useUpdateProfile();
  const { mutateAsync: tokenMutate, isPending: tokenPending } = useCompleteProfileWithToken();
  const isPending = isTokenMode ? tokenPending : jwtPending;

  const openTncDialog = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setTncDialogOpen(true);
  };

  const onSubmit = handleSubmit(async (data) => {
    if (isTokenMode) {
      if (!token) return;
      if (isExpired) {
        toast.error("Link expired", { description: "Link expired (15m), request a new one.", position: "top-center" });
        return;
      }
      const payload = {
        ...(verifiedEmail ? { email: verifiedEmail } : {}),
        token,
        full_name: data.full_name || undefined,
        phone: data.phone || undefined,
        instagram_username: data.instagram_username || undefined,
        gender: data.gender || undefined,
        date_of_birth: data.date_of_birth || undefined,
        medical_notes: data.medical_notes || undefined,
        photo_consent: data.photo_consent,
        tnc_agreed: data.tnc_agreed,
        ...(data.password ? { new_password: data.password } : {}),
      };
      try {
        const res = (await tokenMutate(payload as never)) as {
          data?: {
            session?: { access_token: string; refresh_token: string; expires_in?: number; expires_at?: number };
            next_redirect?: string | null;
          };
        };
        const session = res?.data?.session;
        const beNext = (res?.data?.next_redirect as string | null) ?? null;
        try {
          sessionStorage.removeItem("auth.redirect");
        } catch {}
        if (session?.access_token) {
          setJwtToken({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            expires_at: session.expires_at,
          });
          router.push(getSafeNext(beNext));
        } else {
          toast.success("Profile completed", { description: "Done — please login.", position: "top-center" });
          const next = getSafeNext(beNext);
          router.push(next !== "/book" ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login");
        }
      } catch (error: unknown) {
        const code = (error as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
        if (code === "ALREADY_COMPLETED") router.replace(getSafeNext());
      }
      return;
    }
    try {
      const payload: IAuthSignUpPaylaod = {
        email: data?.email,
        full_name: data?.full_name,
        password: data?.password,
        date_of_birth: data?.date_of_birth,
        gender: data?.gender,
        ...(data?.instagram_username ? { instagram_username: data?.instagram_username } : null),
        ...(data?.photo ? { photo: data?.photo } : null),
        photo_consent: data?.photo_consent as boolean,
        tnc_agreed: data?.tnc_agreed,
        phone: data?.phone,
      };
      const res = (await jwtMutate(payload)) as { data?: { next_redirect?: string | null } } & { next_redirect?: string | null };
      if (res) {
        const beNext = (res as { data?: { next_redirect?: string | null } })?.data?.next_redirect ?? (res as { next_redirect?: string | null })?.next_redirect ?? null;
        try {
          sessionStorage.removeItem("auth.redirect");
        } catch {}
        router.push(getSafeNext(beNext));
      }
    } catch (error) {
      console.log(error);
      if (
        (error as { response?: { status?: number } })?.response?.status === 401 ||
        (error as { response?: { status?: number } })?.response?.status === 403
      ) {
        goToLogin();
      }
    }
  });

  // Token mode loading / error states
  if (isTokenMode) {
    if (verifyLoading) {
      return (
        <div className="flex flex-col items-center w-full space-y-12 font-serif">
          <div className="pt-12 flex justify-center items-center w-full mx-auto max-w-[361px]">
            <LogoComponent className="w-[99px] h-[32px]" />
          </div>
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-brand-500 text-sm">Verifying link...</p>
          </div>
        </div>
      );
    }
    if (isInvalidToken || isExpired) {
      return (
        <div className="flex flex-col items-center w-full space-y-12 font-serif">
          <div className="pt-12 flex justify-center items-center w-full mx-auto max-w-[361px]">
            <LogoComponent className="w-[99px] h-[32px]" />
          </div>
          <div className="w-full mx-auto max-w-[361px] px-6">
            <div className="bg-white mx-auto w-full px-6 rounded-md pt-10 pb-6 flex flex-col items-center text-center gap-4">
              <TriangleAlert className="h-10 w-10 text-brand-400" />
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-brand-500 leading-tight">Link Expired</h3>
                <p className="text-sm font-normal text-brand-400 leading-tight">
                  This link is invalid or has expired (15m). Request a new one — resend is throttled 60s.
                </p>
              </div>
              <Button className="w-full max-h-[42px] min-h-[42px] text-sm" onClick={handleResend}>
                Request New Link
              </Button>
              <Button variant="outline" className="w-full max-h-[42px] min-h-[42px] text-sm" onClick={goToLogin}>
                Back to Login
              </Button>
            </div>
          </div>
        </div>
      );
    }
  }

  if (!isTokenMode && (!isHydrated || !access_token)) {
    return null;
  }

  if (!isTokenMode && isLoading) {
    return (
      <div className="flex flex-col items-center w-full space-y-12 font-serif">
        <div className="pt-12 flex justify-center items-center w-full mx-auto max-w-[361px]">
          <LogoComponent className="w-[99px] h-[32px]" />
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isTokenMode && (isError || (!isLoading && !profileUser?.data))) {
    return (
      <div className="flex flex-col items-center w-full space-y-12 font-serif">
        <div className="pt-12 flex justify-center items-center w-full mx-auto max-w-[361px]">
          <LogoComponent className="w-[99px] h-[32px]" />
        </div>
        <div className="w-full mx-auto max-w-[361px] px-6">
          <div className="bg-white mx-auto w-full px-6 rounded-md pt-10 pb-6 flex flex-col items-center text-center gap-4">
            <TriangleAlert className="h-10 w-10 text-brand-400" />
            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-brand-500 leading-tight">Unable to load</h3>
              <p className="text-sm font-normal text-brand-400 leading-tight">
                We couldn&apos;t load your profile. Your session may have expired. Please log in again to continue.
              </p>
            </div>
            <Button variant="outline" className="w-full max-h-[42px] min-h-[42px] text-sm" onClick={() => refetch()}>
              Try Again
            </Button>
            <Button className="w-full max-h-[42px] min-h-[42px] text-sm" onClick={goToLogin}>
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full space-y-12 font-serif">
      <div className="pt-12 flex justify-center items-center w-full mx-auto max-w-[361px]">
        <LogoComponent className="w-[99px] h-[32px]" />
      </div>

      <div className="w-full mx-auto max-w-[361px]">
        <div className="bg-white mx-auto w-full px-6 rounded-md pt-10">
          <div className="">
            <h3 className="text-3xl font-bold text-brand-500 leading-tight">Complete your Profile</h3>
            <h3 className="text-sm font-normal text-brand-400 leading-tight">Enter your information to complete your profile.</h3>
          </div>
          <FormProvider {...methods}>
            <form onSubmit={onSubmit} className="space-y-2 my-4">
              <div className="space-y-3">
                <FormField
                  control={control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-serif text-brand-500 text-sm" required>
                        Your Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="Type here..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-serif text-brand-500 text-sm" required>
                        Date of Birth
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="Type here..."
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-serif text-brand-500 text-sm" required>
                        Gender
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          defaultValue="male"
                          value={field.value}
                          className="flex flex-row gap-3 items-center"
                          onValueChange={(e) => field.onChange(e)}
                        >
                          {["male", "female"].map((item) => (
                            <div className="flex items-center gap-3" key={item}>
                              <RadioGroupItem value={item} id="gender" onClick={() => item} />
                              <Label htmlFor="gender" className="text-brand-500 capitalize">
                                {item}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-serif text-brand-500 text-sm" required>
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="mail@example.com"
                          readOnly
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-serif text-brand-500 text-sm" required>
                        Phone Number
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="0812xxxx"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="instagram_username"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-serif text-brand-500 text-sm">Username Instagram</FormLabel>
                      <FormControl>
                        <Input
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="Type here..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!isTokenMode ? (
                  <FormField
                    control={control}
                    name="photo"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="font-serif text-brand-500 text-sm">Photo Profile</FormLabel>
                        <FormControl>
                          <div className="flex flex-row items-center gap-4">
                            <div className="object-cover">
                              <Image
                                src={previewURLHelper(field.value)}
                                alt="placeholder"
                                width={75}
                                height={75}
                                className="min-w-[75px] min-h-[75px] rounded-full object-cover"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <Input
                                className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                                placeholder="Type here..."
                                ref={inputRef}
                                type="file"
                                hidden
                                accept={String(ACCEPTED_IMAGE_TYPES)}
                                onChange={(e) => field.onChange(e.target.files?.[0] || null)}
                              />
                              <div className="flex flex-col gap-2">
                                <Button className="text-sm" size={"sm"} type="button" onClick={() => inputRef.current?.click()}>
                                  Choose File
                                </Button>
                                <FormDescription className="text-gray-500 !text-xs">Max File 2 Mb</FormDescription>
                              </div>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <></>
                )}

                <FormField
                  control={control}
                  name="medical_notes"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-serif text-brand-500 text-sm">Medical Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="Type here.."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-serif text-brand-500 text-sm" required={!isTokenMode}>
                        Password
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder={isTokenMode ? "New password (optional)" : "Password"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="confirm_password"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-serif text-brand-500 text-sm" required={!isTokenMode}>
                        Confirm Password
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-600 placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                          placeholder="Confirm Password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Divider className="my-6" color="var(--color-gray-400)" />
                <FormField
                  control={control}
                  name="photo_consent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start">
                      <FormControl>
                        <Checkbox id="photo_consent" checked={field.value} onCheckedChange={field.onChange} className="mt-1" />
                      </FormControl>
                      <FormLabel htmlFor="photo_consent" className="cursor-pointer text-brand-500 font-normal text-sm">
                        I agree to allow Sehela Space to use my photo for social media purposes.
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="tnc_agreed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start">
                      <FormControl>
                        <Checkbox
                          id="tnc"
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setTncDialogOpen(true);
                              return;
                            }
                            field.onChange(false);
                          }}
                          className="mt-1"
                        />
                      </FormControl>
                      <FormLabel htmlFor="tnc" className="cursor-pointer text-brand-500 font-normal text-sm">
                        <p className="text-sm">
                          I confirm that I have read and accept the{" "}
                          <button type="button" className="font-semibold text-sm underline" onClick={openTncDialog}>
                            Term and Conditions
                          </button>{" "}
                          and the{" "}
                          <button type="button" className="font-semibold text-sm underline" onClick={openTncDialog}>
                            Privacy Policy
                          </button>
                        </p>
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex w-full flex-col gap-2">
                <Button type="submit" className="w-full max-h-[42px] min-h-[42px] text-sm" disabled={isPending || (isTokenMode && isExpired)}>
                  {isPending ? "Saving..." : "Complete your profile"}
                </Button>
              </div>
              <div className="text-center space-y-4 mt-12 pb-2">
                <p className="text-gray-500 text-sm">
                  Already have an account?{" "}
                  <a
                    className="text-brand-500 font-bold underline"
                    href={(() => {
                      const n = getSafeNext();
                      return n !== "/profile/my-sessions" ? `/auth/login?next=${encodeURIComponent(n)}` : "/auth/login";
                    })()}
                  >
                    Log in here
                  </a>
                </p>
              </div>
            </form>
          </FormProvider>

          <TncDialog
            open={tncDialogOpen}
            onOpenChange={setTncDialogOpen}
            onAccept={() => setValue("tnc_agreed", true, { shouldValidate: true, shouldDirty: true })}
          />
        </div>
      </div>
    </div>
  );
};
