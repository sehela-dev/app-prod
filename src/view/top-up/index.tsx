"use client";
import { InfiniteScroll } from "@/components/base/infinite-scroll";
import { NavHeaderComponent } from "@/components/layout/header-checkout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthMember } from "@/context/member.ctx";
import { useGetPublicCreditPackagesInfinite, useGetPublicClasses } from "@/hooks/api/queries/customer/public";
import { useGetMyCredits } from "@/hooks/api/queries/customer/profile";
import { formatPackageEligibility } from "@/lib/credit-package";
import { formatCurrency, formatDateHelper } from "@/lib/helper";
import type { ICreditPackageItem } from "@/types/credit-package.interface";
import { ChevronDown, Loader2, SlidersHorizontal, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const PAGE_SIZE = 20;

const placeLabel = (place?: string | null) => {
  const p = (place ?? "").toLowerCase();
  if (p === "offline") return "In studio";
  if (p === "online") return "Online";
  return "In studio and online";
};

export const TopUpCreditPageView = () => {
  const { isAuthenticated, isNewMember } = useAuthMember();

  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const { data: classesData } = useGetPublicClasses({ page_size: 100 });
  const classes = useMemo(() => classesData?.data ?? [], [classesData]);
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useGetPublicCreditPackagesInfinite(
      activeFilter === "all" ? {} : { class_id: activeFilter },
      PAGE_SIZE,
    );

  const pages = useMemo(() => data?.pages ?? [], [data]);
  const items = useMemo(() => pages.flatMap((p) => p.data) ?? [], [pages]);
  const pagination = pages[pages.length - 1]?.pagination;
  const totalItems = pagination?.total_items ?? items.length;

  // ponytail: client-side best-value rank + first-timer pin; push to API ordering if catalog grows
  const ordered = useMemo(
    () => [...items].sort((a, b) => Number(b.max_purchases_per_user === 1) - Number(a.max_purchases_per_user === 1)),
    [items],
  );
  const bestId = useMemo(() => {
    let bestRate = Infinity;
    let best: ICreditPackageItem | null = null;
    for (const it of items) {
      const credits = Number(it.credits) || 0;
      const price = Number(it.price_idr) || 0;
      if (credits <= 0) continue;
      const rate = price / credits;
      if (rate < bestRate) {
        bestRate = rate;
        best = it;
      }
    }
    return items.length > 1 && best ? String(best.id) : null;
  }, [items]);

  const open = (id: string) => router.push(`/topup-credit/${id}`);

  return (
    <div className="flex h-full w-full flex-col font-serif">
      <div className=" text-brand-500">
        <NavHeaderComponent title="Top Up Credit" />
      </div>

      <div className="flex flex-col gap-4 px-4 pb-10 pt-4 text-brand-900">
        <BalancePanel />

        <div className="sticky top-0 z-10 -mx-4 bg-brand-50/95 px-4 py-2 backdrop-blur">
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger
              aria-label="Filter packages by class"
              className="w-full rounded-full border-brand-300 bg-white font-bold text-brand-700 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [&_svg]:opacity-100"
            >
              <SlidersHorizontal size={14} aria-hidden="true" className="shrink-0" />
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.class_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">Select a package</p>
          <p className="text-[11px] text-gray-500">{totalItems} options</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading packages">
            <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-semibold">Could not load packages</p>
            <p className="text-sm text-gray-500">Please try again later.</p>
          </div>
        ) : items.length > 0 ? (
          <InfiniteScroll hasMore={!!hasNextPage} isLoading={isFetchingNextPage} onLoadMore={() => fetchNextPage()}>
            <div className="flex flex-col gap-2">
              {ordered.map((item) => (
                <PackageRow
                  key={item.id}
                  item={item}
                  isBest={bestId != null && String(item.id) === bestId}
                  isNewMember={isNewMember}
                  isAuthenticated={isAuthenticated}
                  onOpen={open}
                />
              ))}
            </div>
            <p className="mt-4 max-w-[60ch] text-[11px] leading-relaxed text-gray-500">
              Activate within 30 days of purchase. Once activated, the day count above starts on your first class.
            </p>
          </InfiniteScroll>
        ) : activeFilter !== "all" ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-semibold">No packages in this filter</p>
            <p className="text-sm text-gray-500">Try another class.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-semibold">No credit packages available</p>
            <p className="text-sm text-gray-500">Please check back later.</p>
          </div>
        )}

        <footer className="mt-2 text-center text-[11px] leading-relaxed text-gray-500">
          Both studios, Kemang and Pondok Labu.{" "}
          <button
            type="button"
            className="font-semibold text-brand-700 underline underline-offset-2"
            onClick={() => router.push("/terms-and-conditions")}
          >
            Full credit terms
          </button>
        </footer>
        {isAuthenticated &&
          <div className="pb-2 text-center">
            <Button variant="link" className="text-xs" onClick={() => router.push("/profile/purchase-history")}>
              View purchase history
            </Button>
          </div>
        }
      </div>
    </div>
  );
};

const BalancePanel = () => {
  const { isAuthenticated } = useAuthMember();
  if (!isAuthenticated) return null;
  return <BalancePanelInner />;
};

const BalancePanelInner = () => {
  const router = useRouter();
  const { profile } = useAuthMember();
  const { data, isLoading } = useGetMyCredits({ is_expired: false });
  const [expanded, setExpanded] = useState(false);

  const credits = useMemo(() => data?.data ?? [], [data]);
  // ponytail: client-side expiry sort; push to API ordering if collection grows
  const slides = useMemo(() => {
    const active = credits.filter((c) => !c.is_expired && c.credits_remaining > 0);
    const pool = active.length > 0 ? active : credits;
    return [...pool].sort((a, b) => {
      const ae = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
      const be = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
      return ae - be;
    });
  }, [credits]);

  const balance = profile?.overview?.credits_balance ?? credits.reduce((s, c) => s + (c.credits_remaining || 0), 0);
  const soonest = slides.find((s) => s.expires_at) ?? null;
  const soonestDays =
    soonest?.expires_at != null
      ? Math.max(0, Math.ceil((new Date(soonest.expires_at).getTime() - Date.now()) / 86400000))
      : null;
  const soonestLabel =
    soonestDays == null
      ? null
      : soonestDays <= 0
        ? "today"
        : soonestDays === 1
          ? "tomorrow"
          : `in ${soonestDays} days`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-3xl bg-brand-500 py-8" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-white" />
      </div>
    );
  }
  if (slides.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 p-5 text-white shadow-sm">
      {/* <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-white/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full border-[12px] border-white/10" /> */}
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-2 text-[11px] font-bold uppercase tracking-[0.18em]">You already have</p>
          <button
            type="button"
            onClick={() => router.push("/profile/my-credits")}
            className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
          >
            My Credits
          </button>
        </div>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="font-serif text-5xl font-semibold leading-none">{balance}</span>
          <span className="text-lg">credits</span>
        </p>
        <p className="mt-2 text-sm">
          Across {slides.length} {slides.length === 1 ? "package" : "packages"}
          {soonest && soonestLabel && (
            <>
              {" · "}soonest expires{" "}
              <span className="font-bold">
                {formatDateHelper(soonest.expires_at as string, "d MMM")}, {soonestLabel}
              </span>
            </>
          )}
        </p>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="my-packages-list"
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold"
        >
          {expanded ? "Hide my packages" : "Show my packages"}
          <ChevronDown size={16} aria-hidden="true" className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>

        {expanded && (
          <ul id="my-packages-list" className="mt-1 flex flex-col gap-2">
            {slides.map((c) => {
              const isSoonest = soonest != null && c.package_purchase_id === soonest.package_purchase_id;
              return (
                <li key={c.package_purchase_id} className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm">
                    <span className="font-bold">{c.package_name}</span> {c.credits_remaining} left
                    {!c.is_owner && c.is_shared && <span> · shared{c.shared_by_user_name ? ` by ${c.shared_by_user_name}` : ""}</span>}
                  </p>
                  <p className={`shrink-0 text-sm ${isSoonest ? "font-bold" : ""}`}>
                    {c.expires_at ? `Expires ${formatDateHelper(c.expires_at, "d MMM")}` : "Not started yet"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

const PackageRow = ({
  item,
  isBest,
  isNewMember,
  isAuthenticated,
  onOpen,
}: {
  item: ICreditPackageItem;
  isBest: boolean;
  isNewMember?: boolean;
  isAuthenticated?: boolean;
  onOpen: (id: string) => void;
}) => {
  const credits = Number(item.credits) || 0;
  const price = Number(item.price_idr) || 0;
  const isFirstTimer = item.max_purchases_per_user === 1;
  const isNewOnly = item.only_for_new_users === true;
  // ponytail: default-deny while profile loads (isNewMember undefined) so
  // authenticated non-new members can't tap through before the flag resolves
  const isBlocked = isNewOnly && isAuthenticated === true && isNewMember !== true;
  const classNames = item.class_ids_restriction?.map((c) => c.name).join(", ");
  const facts: string[] = [];
  facts.push(`${item.validity_days} days from your first class`);
  facts.push(`${classNames || "All classes"} · ${placeLabel(item.place_restriction)}`);
  facts.push(formatPackageEligibility(item));

  return (
    <button
      type="button"
      onClick={() => onOpen(String(item.id))}
      disabled={isBlocked}
      aria-label={`${item.name}, ${item.credits} credits, ${formatCurrency(String(item.price_idr))}${isBest ? ", best value" : ""}${isFirstTimer ? ", first-timers only, one purchase per person" : ""}${isNewOnly ? ", new members only" : ""}${item.is_shareable ? ", shareable" : ""}${isBlocked ? ", unavailable for your account" : ""}`}
      className={
        isBlocked
          ? "w-full rounded-2xl border border-brand-200 bg-white p-4 text-left opacity-60"
          : isBest
            ? "w-full rounded-2xl border-2 border-brand-500 bg-brand-25 p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            : "w-full rounded-2xl border border-brand-200 bg-white p-4 text-left transition-shadow hover:border-brand-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      }
    >
      <span className="flex items-start justify-between gap-4">
        <span className="min-w-0 flex-1">
          <span className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-serif text-base font-semibold">{item.name}</span>
            {isBest && (
              <span className="rounded-full border border-brand-200 bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-900">
                Best value
              </span>
            )}
            {isFirstTimer && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                First-timers · 1 purchase
              </span>
            )}
            {isNewOnly && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                New members only
              </span>
            )}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {credits} {credits === 1 ? "credit" : "credits"}
            </span>
            {item.is_shareable && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                <Users size={10} aria-hidden="true" /> Shareable
              </span>
            )}
          </span>
          <span className="mt-1 block text-[11px] leading-relaxed text-gray-500">
            {facts.map((fact, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1 text-gray-300">·</span>}
                {fact.includes("days") ? (
                  <>
                    <span className="font-bold text-brand-900">{fact.split(" ")[0]} days</span> {fact.split(" ").slice(1).join(" ")}
                  </>
                ) : (
                  fact
                )}
              </span>
            ))}
          </span>
          {isBlocked && (
            <span className="mt-1 block text-[11px] font-semibold text-gray-500">
              For new members only — not available for your account.
            </span>
          )}
        </span>
        <span className="shrink-0 whitespace-nowrap text-right">
          <span className="block text-base font-bold tabular-nums">{formatCurrency(String(item.price_idr))}</span>
        </span>
      </span>
    </button>
  );
};
