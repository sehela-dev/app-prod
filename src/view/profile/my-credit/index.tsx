"use client";

import { GeneralTabComponent } from "@/components/general/tabs-component";
import { NavHeaderComponent } from "@/components/layout/header-checkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getShareErrorMessage } from "@/api-req/customer-app/payments";
import { useAuthMember } from "@/context/member.ctx";
import { useSharePackagePurchase } from "@/hooks/api/mutations/customers";
import { useGetMyCreditsInfinite } from "@/hooks/api/queries/customer/profile";
import { formatEligibleTime, formatInstructorNames, formatPackageEligibility } from "@/lib/credit-package";
import { formatDateHelper } from "@/lib/helper";
import { CalendarClock, Clock3, GemIcon, Loader2, MapPin, Plus, Ticket, Users } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const tabs = [
  {
    name: "Active Credit",
    value: "active",
  },
  {
    name: "Expired Credit",
    value: "expired",
  },
];

export const MyCreditsView = () => {
  const router = useRouter();
  const { profile } = useAuthMember();

  const [selecetedTab, setSelectedTab] = useState("active");
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetMyCreditsInfinite(
    { is_expired: selecetedTab === "expired" },
    10
  );

  // ponytail: client-side rank sort; push to API ordering if list grows
  const items = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    const rank = (i: import("@/types/customer-app/my-credit.interface").IMyCreditItem) =>
      i.is_expired ? 3 : i.credits_remaining <= 0 ? 2 : i.validity_status === "not_started" ? 1 : 0;
    return [...flat].sort((a, b) => rank(a) - rank(b));
  }, [data]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length, selecetedTab]);

  return (
    <div className="flex flex-col w-full font-serif h-full text-brand-500">
      <NavHeaderComponent title="My Credits" />

      <div className="flex flex-col gap-4 px-4">
        <div className="mx-auto w-full mt-4">
          <div className="min-h-[181px] flex flex-col w-full  bg-brand-500 border border-brand-500  rounded-[12px] p-4 items-center gap-4 justify-between">
            <p className="text-xl font-semibold text-gray-50">Total Credits</p>
            <div className="flex flex-row items-center gap-1">
              <GemIcon size={24} color="var(--color-gray-50)" />
              <p className="text-[32px] text-gray-50 font-semibold leading-[110%]">{profile?.overview?.credits_balance}</p>
            </div>
            <p className="text-sm text-gray-50">Active Credits Available</p>
            <div className="flex w-full">
              <Button
                className="bg-gray-50 w-full gap-2 text-brand-500 hover:bg-brand-200 hover:shadow-md transition-shadow"
                onClick={() => router.push("/topup-credit")}
              >
                <Plus size={16} strokeWidth={2.5} />
                Top Up Credit
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full pb-4">
          <div className="mb-4">
            <GeneralTabComponent
              variant="line"
              tabs={tabs}
              selecetedTab={selecetedTab}
              setTab={(e) => {
                if (e === selecetedTab) return;
                setSelectedTab(e);
              }}
            />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length > 0 ? (
            <div className="flex flex-col gap-3 w-full">
              {items.map((item) => (
                <MyCreditsCardsItem
                  key={item.package_purchase_id}
                  item={item}
                  variant={selecetedTab === "expired" ? "expired" : "active"}
                />
              ))}
              <div ref={sentinelRef} className="flex min-h-[1px] w-full justify-center py-2">
                {isFetchingNextPage ? (
                  <span className="inline-flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading more…
                  </span>
                ) : hasNextPage ? (
                  <span className="text-[11px] text-gray-400">Scroll for more</span>
                ) : (
                  <span className="text-[11px] text-gray-400">All caught up</span>
                )}
              </div>
            </div>
          ) : (
            <EmptyStateCredit variant={selecetedTab as "active" | "expired"} />
          )}
        </div>
      </div>
    </div>
  );
};

interface IProps {
  item: import("@/types/customer-app/my-credit.interface").IMyCreditItem;
  variant?: "active" | "expired";
}

function formatExpiry(expires_at: string | null, validity_status: string, validity_days: number) {
  if (expires_at) return { label: formatDateHelper(expires_at, "dd MMM yyyy"), sub: validity_status === "expired" || validity_status === "active" ? "· expires" : "" };
  if (validity_status === "not_started") return { label: "Not started", sub: `· ${validity_days}d on first use` };
  if (validity_status === "unknown") return { label: "No expiry", sub: validity_days ? `· ${validity_days}d` : "" };
  return { label: "No expiry", sub: validity_days ? `· ${validity_days}d` : "" };
}
function formatRestriction(v: string | string[] | null | undefined) {
  if (!v) return null;
  return Array.isArray(v) ? v.join(", ") : v;
}

export const MyCreditsCardsItem = ({ item, variant = "active" }: IProps) => {
  const isExpired = variant === "expired" || item.is_expired;
  const isDepleted = !isExpired && item.credits_remaining <= 0;
  const isMuted = isExpired || isDepleted;
  const [shareOpen, setShareOpen] = useState(false);
  const pct = item.total_credits ? Math.min(100, Math.round((item.credits_used / item.total_credits) * 100)) : 0;
  const expiry = formatExpiry(item.expires_at, item.validity_status, item.validity_days);
  const isRefund = item.package_type === "refund";
  const showNotStarted = !isExpired && !isDepleted && item.validity_status === "not_started";
  const place = formatRestriction(item.place_restriction);
  const sessionType = formatRestriction(item.session_type_restriction);
  const instructorNames = formatInstructorNames(item.instructor_ids_restriction);
  const timeWindow = formatEligibleTime(item.eligible_start_time, item.eligible_end_time);
  const hasInstructorOrTimeRestriction = !!instructorNames || !!timeWindow;
  // Shareable only when unused: a single credit_spend locks sharing (server enforces SHARE_USED).
  // Received packages can never be re-shared: owner-only and never shared_by someone else.
  const canShare =
    item.is_owner &&
    !item.shared_by_user_id &&
    !item.is_shared &&
    !item.shared_with_user_id &&
    item.is_shareable === true &&
    !isMuted &&
    item.credits_used === 0 &&
    (item.status ? item.status === "paid" : true);

  return (
    <div
      className={
        isMuted
          ? "flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 opacity-80"
          : "flex flex-col gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={
              isMuted
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200"
                : isRefund
                  ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500"
                  : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500"
            }
          >
            <GemIcon size={16} className={isMuted ? "text-gray-500" : "text-white"} />
          </div>
          <div className="min-w-0">
            <p className="flex items-baseline gap-1.5 leading-none">
              <span className={isMuted ? "text-[18px] font-bold tracking-tight text-gray-600" : "text-[18px] font-bold tracking-tight text-brand-900"}>
                {item.credits_remaining}
              </span>
              <span className={isMuted ? "text-[11px] font-medium text-gray-500" : "text-[11px] font-medium text-brand-500"}>
                / {item.total_credits} Credits
              </span>
              {item.credits_remaining !== item.total_credits && !isMuted && (
                <span className="ml-1 hidden text-[10px] text-gray-400 sm:inline">· {item.credits_used} used</span>
              )}
            </p>
            <p className={isMuted ? "mt-1 truncate text-xs font-medium text-gray-600" : "mt-1 truncate text-xs font-medium text-brand-900"}>{item.package_name}</p>
            {item.package_description && (
              <p className={isMuted ? "truncate text-[11px] text-gray-500" : "truncate text-[11px] text-gray-600"}>{item.package_description}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={
              isMuted
                ? "inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-semibold tracking-wide text-gray-600"
                : showNotStarted
                  ? "inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-amber-700"
                  : "inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-brand-700"
            }
          >
            {isMuted ? <Clock3 size={11} /> : showNotStarted ? <Clock3 size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
            {isExpired ? "Expired" : isDepleted ? "Fully Used" : showNotStarted ? "Not started" : "Active"}
          </span>
          {isRefund && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-amber-700">Refund</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className={isMuted ? "text-gray-500" : "text-gray-600"}>
            {showNotStarted ? "Validity" : "Usage"}
          </span>
          <span className={isMuted ? "font-medium text-gray-600" : "font-medium text-brand-900"}>
            {showNotStarted ? `${item.validity_days} days` : `${item.credits_used}/${item.total_credits}`}
          </span>
        </div>
        <div className={isMuted ? "h-1.5 w-full overflow-hidden rounded-full bg-gray-200" : "h-1.5 w-full overflow-hidden rounded-full bg-brand-50"}>
          <div
            className={isMuted ? "h-full rounded-full bg-gray-400" : showNotStarted ? "h-full rounded-full bg-amber-400" : "h-full rounded-full bg-brand-500"}
            style={{ width: `${isMuted ? 100 : showNotStarted ? 0 : pct}%` }}
          />
        </div>
      </div>

      <div
        className={
          isMuted
            ? "flex flex-wrap items-center gap-2 border-t border-gray-200 pt-2.5 text-[11px] text-gray-500"
            : "flex flex-wrap items-center gap-2 border-t border-brand-50 pt-2.5 text-[11px] text-gray-500"
        }
      >
        <span className="inline-flex items-center gap-1.5">
          <Ticket size={12} className={isMuted ? "text-gray-400" : "text-brand-400"} /> {item.credits_remaining} left
        </span>
        <span className="h-3 w-px bg-gray-200" />
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock size={12} className={isMuted ? "text-gray-400" : "text-brand-400"} />
          {expiry.label} <span className="text-gray-400">{expiry.sub}</span>
        </span>
        {(place || sessionType) && (
          <>
            <span className="h-3 w-px bg-gray-200" />
            <span className="inline-flex items-center gap-1.5 capitalize">
              <MapPin size={12} className={isMuted ? "text-gray-400" : "text-brand-400"} />
              {[place, sessionType].filter(Boolean).join(" · ") || "—"}
            </span>
          </>
        )}
        {hasInstructorOrTimeRestriction && (
          <>
            <span className="h-3 w-px bg-gray-200" />
            <span className="inline-flex items-center gap-1.5">
              <Users size={12} className={isMuted ? "text-gray-400" : "text-brand-400"} />
              {formatPackageEligibility(item)}
            </span>
          </>
        )}
      </div>

      {item.is_shared && item.shared_by_user_name && (
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] text-gray-600">
          <Users size={12} className="text-gray-500" /> Shared by {item.shared_by_user_name}
        </div>
      )}
      {!item.is_owner && item.is_shared && !item.shared_by_user_name && (
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-brand-25 px-2.5 py-1.5 text-[11px] text-brand-700">
          <Users size={12} /> Shared credit
        </div>
      )}
      {item.is_owner && !!item.shared_with_user_name && (
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-brand-25 px-2.5 py-1.5 text-[11px] text-brand-700">
          <Users size={12} /> Shared with {item.shared_with_user_name}
        </div>
      )}
      {canShare && (
        <SharePackagePanel
          open={shareOpen}
          onOpenChange={setShareOpen}
          purchaseId={item.package_purchase_id}
          packageName={item.package_name}
        />
      )}
    </div>
  );
};

export const EmptyStateCredit = ({ variant = "active" }: { variant?: "active" | "expired" }) => {
  const isExpired = variant === "expired";
  return (
    <div className="w-full mx-auto flex flex-col items-center gap-4 py-10 text-center">
      <div className={isExpired ? "flex h-28 w-28 items-center justify-center rounded-full bg-gray-100" : "flex h-28 w-28 items-center justify-center rounded-full bg-brand-25"}>
        <Image src="/assets/view/gems.png" alt="no-data" width={80} height={80} className={isExpired ? "opacity-60 grayscale" : ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-brand-900">{isExpired ? "No Expired Credits" : "No Active Credits"}</p>
        <p className="max-w-[260px] text-xs leading-relaxed text-gray-500">
          {isExpired ? "Expired credits will appear here once they pass their validity period." : "Top up now and unlock more learning opportunities!"}
        </p>
      </div>
    </div>
  );
};

function SharePackagePanel({
  open,
  onOpenChange,
  purchaseId,
  packageName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseId: string;
  packageName: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isPending } = useSharePackagePurchase();

  const handleShare = async () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    try {
      const res = await mutateAsync({ purchaseId, email: trimmed });
      toast.success("Package shared", {
        description: `Shared with ${res.data?.shared_with?.name || res.data?.shared_with?.email || trimmed}.`,
        position: "top-center",
      });
      onOpenChange(false);
      setEmail("");
      setError(null);
    } catch (err) {
      const apiError = (err as { response?: { data?: { error?: { code?: string; message?: string } } } })?.response
        ?.data?.error;
      setError(getShareErrorMessage(apiError?.code, apiError?.message));
    }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
      <p className="text-sm font-bold text-brand-900">Share with 1 other person</p>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-600">
        Add them before your first class, it can&apos;t be changed after that.
      </p>
      {!open ? (
        <Button
          variant="outline"
          className="mt-3 min-h-11 w-full gap-1.5 rounded-xl border-brand-300 bg-white text-xs font-bold text-brand-700"
          onClick={() => onOpenChange(true)}
        >
          <Plus size={14} /> Add person
        </Button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor={`share-email-${purchaseId}`} className="text-xs font-bold text-brand-900">
            Their email
          </label>
          <div className="flex gap-2">
            <Input
              id={`share-email-${purchaseId}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@email.com"
              value={email}
              disabled={isPending}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              aria-label={`Email of the person to share ${packageName} with`}
              aria-invalid={!!error}
              className="min-h-11 rounded-xl bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleShare();
                }
              }}
            />
            <Button className="min-h-11 shrink-0" onClick={() => void handleShare()} disabled={isPending || !email.trim()}>
              {isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </span>
              ) : (
                "Save"
              )}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-[11px] font-medium text-red-600">
              {error}
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-gray-500">
            They must already have a Sehela account. Sharing lasts until the package expires and cannot be revoked.
          </p>
        </div>
      )}
    </div>
  );
}
