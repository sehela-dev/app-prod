"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ChevronDown, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays, differenceInDays, format, parseISO, startOfDay } from "date-fns";

// import { MainFooterComponent } from "@/components/layout";
import { SessionCardComponent } from "@/components/general/session-card";
import { SessionFilters } from "@/components/general/session-filters";
import { InfiniteScroll } from "@/components/base/infinite-scroll";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useGetPublicLocations, useGetPublicSessionsInfinite } from "@/hooks/api/queries/customer/public";
import { formatDateHelper } from "@/lib/helper";

const DATE_RANGE_DAYS = 30;

function SessionDateStrip({ selectedDate, onSelect }: { selectedDate?: string; onSelect: (d: string) => void }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayStr = useMemo(() => format(today, "yyyy-MM-dd"), [today]);

  const effectiveSelected = useMemo(() => {
    if (!selectedDate) return todayStr;
    try {
      const parsed = parseISO(selectedDate);
      if (Number.isNaN(parsed.getTime())) return todayStr;
      const d = startOfDay(parsed);
      if (d < today) return todayStr;
      return format(d, "yyyy-MM-dd");
    } catch {
      return todayStr;
    }
  }, [selectedDate, today, todayStr]);

  const dates = useMemo(() => {
    const base = effectiveSelected ? parseISO(effectiveSelected) : today;
    const endFromSelected = addDays(startOfDay(base), DATE_RANGE_DAYS);
    const defaultEnd = addDays(today, DATE_RANGE_DAYS);
    const end = endFromSelected > defaultEnd ? endFromSelected : defaultEnd;
    const len = differenceInDays(end, today) + 1;
    return Array.from({ length: len }, (_, i) => addDays(today, i));
  }, [today, effectiveSelected]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const otherDates = useMemo(() => dates.slice(1), [dates]);
  const isTodaySelected = effectiveSelected === todayStr;

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [otherDates.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!effectiveSelected || isTodaySelected) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    const idx = otherDates.findIndex((d) => format(d, "yyyy-MM-dd") === effectiveSelected);
    if (idx >= 0) {
      const child = el.children[idx] as HTMLElement | undefined;
      child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [effectiveSelected, otherDates, isTodaySelected]);

  const scrollBy = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  };

  const todayDate = dates[0];

  return (
    <div className="w-full rounded-2xl bg-none border border-brand-100 p-1.5 flex gap-1.5 items-stretch">
      {/* Today pinned — seamless */}
      <button
        type="button"
        onClick={() => onSelect(todayStr)}
        className={cn(
          "flex min-w-[62px] h-[68px] flex-col items-center justify-center rounded-xl px-2 text-center transition-all shrink-0 cursor-pointer",
          isTodaySelected
            ? "bg-brand-500 text-white shadow-sm"
            : "bg-none text-zinc-600  hover:border-zinc-200  hover:bg-brand-100",
        )}
      >
        <span className="text-[10px] font-medium tracking-widest uppercase opacity-60">&nbsp;</span>
        <span className="text-[18px] font-bold leading-none mt-0.5">Today</span>
        <span className="text-[10px] font-medium opacity-60">&nbsp;</span>
        <span className={cn("mt-1.5 h-1 w-1 rounded-full", isTodaySelected ? "bg-white" : "bg-brand-500")} />
      </button>

      <div className="relative flex-1 min-w-0 flex items-stretch">
        <div
          ref={scrollRef}
          className="flex flex-1 gap-1.5 overflow-x-auto snap-x snap-mandatory scroll-smooth items-stretch [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {otherDates.map((d) => {
            const dateStr = format(d, "yyyy-MM-dd");
            const isSelected = dateStr === effectiveSelected;
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelect(dateStr)}
                className={cn(
                  "flex min-w-[60px] h-[68px] flex-col items-center justify-center rounded-xl px-2 text-center transition-all shrink-0 cursor-pointer snap-start",
                  isSelected
                    ? "bg-brand-500 text-white shadow-sm"
                    : "bg-none text-zinc-600  hover:border-zinc-200 hover:bg-brand-100",
                )}
              >
                <span className="text-[10px] font-medium tracking-widest uppercase opacity-60">{format(d, "EEE")}</span>
                <span className="text-[18px] font-bold leading-none mt-0.5">{format(d, "d")}</span>
                <span className="text-[10px] font-medium opacity-60">{format(d, "MMM")}</span>
                <span className={cn("mt-1.5 h-1 w-1 rounded-full transition-colors", isSelected ? "bg-white" : "bg-transparent")} />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Previous dates"
          onClick={() => scrollBy(-1)}
          disabled={!canPrev}
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 size-7 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-600 transition-colors cursor-pointer",
            canPrev ? "hover:bg-zinc-900 hover:text-white hover:border-zinc-900" : "opacity-40 cursor-default",
          )}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          aria-label="Next dates"
          onClick={() => scrollBy(1)}
          disabled={!canNext}
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 size-7 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-600 transition-colors cursor-pointer",
            canNext ? "hover:bg-zinc-900 hover:text-white hover:border-zinc-900" : "opacity-40 cursor-default",
          )}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function BookLocationFilter({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const {
    data: locationsData,
    isLoading: locationsLoading,
    isFetching: locationsFetching,
  } = useGetPublicLocations({ page_size: 50, q: search.trim() || undefined });
  const locationOptions = useMemo(
    () => (locationsData?.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    [locationsData],
  );
  const toggle = (id: string) => {
    onChange(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);
  };
  return (
    <div className="w-full rounded-xl border border-brand-100 bg-brand-25 font-serif text-brand-500">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex items-center gap-2 cursor-pointer group">
                <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
                <p className="text-sm font-extrabold">Location</p>
                {values.length > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                    {values.length}
                  </span>
                )}
              </button>
            </CollapsibleTrigger>
            {values.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs font-semibold underline cursor-pointer hover:opacity-70"
              >
                Clear
              </button>
            )}
          </div>
          <CollapsibleContent className="pt-4">
            <div className="flex flex-col gap-3">
              <Input
                placeholder="Search location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white border-brand-100"
              />
              {values.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {values.map((id) => {
                    const label = locationOptions.find((o) => o.value === id)?.label ?? id;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        {label}
                        <button
                          type="button"
                          onClick={() => toggle(id)}
                          className="rounded-full p-0.5 hover:bg-white/20 cursor-pointer"
                          aria-label={`Remove ${label}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="max-h-48 overflow-auto flex flex-col gap-1 pr-1">
                {locationsLoading || locationsFetching ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : locationOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No location found.</p>
                ) : (
                  locationOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-brand-100 cursor-pointer"
                    >
                      <Checkbox checked={values.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
                      <span className="text-sm truncate">{opt.label}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

export const BookClassView = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const classId = searchParams.get("class_id") ?? undefined;
  const dateParam = searchParams.get("date") ?? null;
  const instructorId = searchParams.get("instructor_id") ?? undefined;
  const locationIdRaw = searchParams.get("location_ids") ?? searchParams.get("location_id") ?? "";
  const locationIds = useMemo(
    () => (locationIdRaw ? [...new Set(locationIdRaw.split(",").map((s) => s.trim()).filter(Boolean))] : []),
    [locationIdRaw],
  );
  const locationParam = locationIds.length ? locationIds.join(",") : undefined;
  const place = searchParams.get("place") ?? undefined;

  const effectiveDate = useMemo(() => {
    const today = startOfDay(new Date());
    const todayStr = format(today, "yyyy-MM-dd");
    if (!dateParam) return todayStr;
    try {
      const parsed = parseISO(dateParam);
      if (Number.isNaN(parsed.getTime())) return todayStr;
      const d = startOfDay(parsed);
      if (d < today) return todayStr;
      return format(d, "yyyy-MM-dd");
    } catch {
      return todayStr;
    }
  }, [dateParam]);

  const [filterResetKey, setFilterResetKey] = useState(0);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetPublicSessionsInfinite(
    {
      date: effectiveDate,
      class_id: classId,
      instructor_id: instructorId,
      ...(locationParam ? { location_id: locationParam } : {}),
      place,
    },
    10,
  );

  const groups = useMemo(() => {
    const raw = data?.pages.flatMap((page) => page.data ?? []) ?? [];
    const byDate = new Map<string, (typeof raw)[number]>();
    for (const g of raw) {
      const existing = byDate.get(g.date);
      if (!existing) byDate.set(g.date, { ...g, sessions: [...g.sessions] });
      else {
        const seen = new Set(existing.sessions.map((s) => s.id));
        for (const s of g.sessions) if (!seen.has(s.id)) { existing.sessions.push(s); seen.add(s.id); }
      }
    }
    return [...byDate.values()];
  }, [data]);
  const sessions = useMemo(() => groups.flatMap((g) => g.sessions), [groups]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        sessions: g.sessions.filter(
          (s) =>
            s.session_name.toLowerCase().includes(q) ||
            s.instructor_name?.toLowerCase().includes(q) ||
            s.location_name?.toLowerCase().includes(q) ||
            s.class_name?.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.sessions.length > 0);
  }, [groups, search]);
  const filteredSessions = useMemo(() => filteredGroups.flatMap((g) => g.sessions), [filteredGroups]);

  const setParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };

  const handleResetFilters = () => {
    setFilterResetKey((key) => key + 1);
    setSearch("");
    setParams({ class_id: undefined, instructor_id: undefined, location_id: undefined, location_ids: undefined, place: undefined });
  };

  return (
    <div className="flex flex-col w-full gap-8 font-serif mx-auto pt-8 min-h-dvh text-brand-500 justify-between">
      <div className="flex w-full px-6 flex-col gap-8 h-full">
        <button onClick={handleBack} className="flex items-center gap-2 text-sm font-semibold w-fit cursor-pointer hover:opacity-70">
          <ChevronLeft size={18} /> Back
        </button>

        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-extrabold">Upcoming Sessions</h3>
          <SessionDateStrip
            selectedDate={effectiveDate ?? undefined}
            onSelect={(d) => setParams({ date: effectiveDate === d ? undefined : d })}
          />
          <BookLocationFilter
            values={locationIds}
            onChange={(next) => setParams({ location_id: next.length ? next.join(",") : undefined, location_ids: undefined })}
          />
          <SessionFilters
            key={filterResetKey}
            classId={classId}
            instructorId={instructorId}
            place={place}
            onChange={(key, value) => setParams({ [key]: value })}
            onReset={handleResetFilters}
          />



          {/* <SearchInput
            search={search}
            onSearch={setSearch}
            placeholder="Search sessions, instructors, locations..."
            className="[&>input]:bg-brand-00 [&>input]:rounded-xl [&>input]:border-brand-100"
          /> */}

          {search.trim() && (
            <p className="text-sm text-brand-500/60">
              {filteredSessions.length} result{filteredSessions.length === 1 ? "" : "s"}
            </p>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <p className="text-sm text-brand-500/70">Something went wrong while loading sessions.</p>
              <Button variant="outline" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="font-semibold">No sessions available</p>
              <p className="text-sm text-brand-500/70 mt-1">Try another date or adjust your filters.</p>
            </div>
          ) : search.trim() && filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="font-semibold">No matches found</p>
              <p className="text-sm text-brand-500/70 mt-1">Try a different keyword for your search.</p>
            </div>
          ) : (
            <InfiniteScroll hasMore={!!hasNextPage} isLoading={isFetchingNextPage} onLoadMore={() => fetchNextPage()}>
              <div className="flex flex-col gap-6">
                {filteredGroups.map((group) => (
                  <div key={group.date} className="flex flex-col gap-4">
                    <h3 className="font-[600]">{formatDateHelper(group.date ?? "", "EEEE, dd MMM yyyy")}</h3>
                    <div className="flex flex-col gap-4">
                      {group.sessions.map((session) => (
                        <SessionCardComponent
                          key={session.id}
                          time={session.time_start}
                          endTime={session.time_end}
                          title={session.session_name}
                          location={session.place === "online" ? "Online" : session.location_name ?? ""}
                          instructor={session.instructor_name ?? ""}
                          slot={String(session.slots_available)}
                          isFull={session.is_full}
                          isSpecial={session.type === "special"}
                          isOnline={session.place === "online"}
                          credit={session.allow_credit && session.price_credit_amount ? String(session.price_credit_amount) : ""}
                          price={!session.is_credit_only && session.price_idr > 0 ? session.price_idr.toLocaleString("id-ID") : ""}
                          url={`/book/session/${session.id}?date=${group.date}${classId ? `&class_id=${classId}` : ""}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </InfiniteScroll>
          )}
        </div>
      </div>
      {/* <MainFooterComponent /> */}
    </div>
  );
};
