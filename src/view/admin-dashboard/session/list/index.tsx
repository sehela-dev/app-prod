"use client";
import { DateRangePicker } from "@/components/base/date-range-picker";
import { buildNumber, CustomTable } from "@/components/general/custom-table";
import { CancelSessionDialog } from "@/components/general/cancel-session-dialog";
import { CustomPagination } from "@/components/general/pagination-component";
import { GeneralTabComponent } from "@/components/general/tabs-component";
import { SessionsCalendarView } from "@/components/page/session/sessions-calendar-view";
import { DuplicateRangeDialog } from "@/components/page/session/duplicate-range-dialog";
import { RoomBlockDialog, RoomBlockInitial } from "@/components/page/session/room-block-dialog";
import { PendingGoLiveSection } from "@/components/page/session/pending-go-live-section";
import { SessionDetailSheet } from "@/components/page/session/session-detail-sheet";
import { QuickCreateSlot, SessionQuickCreateSheet } from "@/components/page/session/session-quick-create-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { useDeleteRoomBlock, usePublishSession, useUnpublishSession } from "@/hooks/api/mutations/admin";
import { useGetAllSessions, useGetSessions } from "@/hooks/api/queries/admin/class-session";
import { useGetRoomBlocks } from "@/hooks/api/queries/admin/class-room";
import { useAdminPermission } from "@/hooks/use-role-access";
import { defaultDate, formatDateHelper } from "@/lib/helper";
import { cn } from "@/lib/utils";
import { formatPublishCountdown, isScheduled } from "@/utils/session-badge";
// import { IClassSessionCategory } from "@/types/class-category.interface";
import { ISessionItem } from "@/types/class-sessions.interface";
import { IRoomBlock } from "@/types/class-room.interface";
import { ICommonParams } from "@/types/general.interface";
import type { EventCalendarRangeInfo, EventCalendarSlotInfo } from "@/components/reui/event-calendar/event-calendar-types";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { branchLabel, SEHELA_BRANCH } from "@/constants/sample-data";
import { Ban, CirclePlus, CalendarDays, CalendarPlus, CopyPlus, Ellipsis, LayoutList } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addHours, format } from "date-fns";
import { BaseDialogConfirmation } from "@/components/general/dialog-confirnation";

const tabFilter = [
  {
    value: "all",
    name: "All",
  },
  {
    value: "scheduled",
    name: "Scheduled",
  },

  {
    value: "ongoing",
    name: "On Going",
  },
  {
    value: "ended",
    name: "Ended",
  },
  {
    value: "canceled",
    name: "Canceled",
  },
];

export const SessionListPage = () => {
  const { can } = useAdminPermission();
  const router = useRouter();
  const [limit, setLimit] = useState(10);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tabs, setTabs] = useState("all");
  const [openDialogConfirm, setOpenDialogConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSession, setSelectedSession] = useState<ISessionItem | null>(null);

  const [selectedRange, setSelectedRange] = useState<{ from?: string | null; to?: string | null }>({
    from: null,
    to: null,
  });
  const [creditOnly, setCreditOnly] = useState(false);
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null);
  const [branch, setBranch] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const sessionParams = {
    search,
    status: tabs !== "all" ? tabs : "",
    startDate: selectedRange.from as string,
    endDate: selectedRange.to as string,
    ...(branch !== "all" ? { branch } : null),
    ...(visibility === "published" ? { is_published: true } : visibility === "draft" ? { is_published: false } : null),
  } as ICommonParams & Record<string, unknown>;
  const { data, isLoading, refetch: refetchList } = useGetSessions({ ...sessionParams, page, limit }, view === "list");
  // Calendar must show the whole month: BE caps page_size at 100, so page through all of them.
  const {
    data: allData,
    isLoading: isLoadingAll,
    refetch: refetchAll,
    // Strictly date-driven: no range yet (calendar hasn't set its month) = no fetch,
    // so we never pull unfiltered history. Month nav changes the key → refetch.
  } = useGetAllSessions(sessionParams, view === "calendar" && !!selectedRange.from && !!selectedRange.to);
  const calendarData = view === "calendar" ? allData : undefined;
  const calendarLoading = view === "calendar" ? isLoadingAll : false;
  const refetch = () => {
    if (view === "calendar") refetchAll();
    else refetchList();
  };

  const [openDuplicateRange, setOpenDuplicateRange] = useState(false);
  const [openBlockDialog, setOpenBlockDialog] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<IRoomBlock | null>(null);
  const [quickSlot, setQuickSlot] = useState<QuickCreateSlot | null>(null);
  const [slotPopup, setSlotPopup] = useState<(QuickCreateSlot & { x: number; y: number }) | null>(null);

  useEffect(() => {
    if (!slotPopup) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSlotPopup(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [slotPopup]);

  const handleSlotClick = (slot: EventCalendarSlotInfo, e: React.MouseEvent) => {
    if (!can("session:create")) return;
    setSlotPopup({ date: slot.date, end: slot.end, allDay: slot.allDay, x: e.clientX, y: e.clientY });
  };

  // Prefill for the popover's "Block time" option (same defaults as quick-create).
  // Snapshot into state at click time — slotPopup closes in the same tick.
  const [blockSeed, setBlockSeed] = useState<RoomBlockInitial | null>(null);
  const blockInitial: RoomBlockInitial | null = useMemo(() => {
    if (!slotPopup) return null;
    return {
      start_date: format(slotPopup.date, "yyyy-MM-dd"),
      time_start: slotPopup.allDay ? "10:00" : format(slotPopup.date, "HH:mm"),
      time_end: slotPopup.allDay ? "13:00" : format(slotPopup.end ?? addHours(slotPopup.date, 1), "HH:mm"),
    };
  }, [slotPopup]);

  const handleCalendarRangeChange = (info: EventCalendarRangeInfo) => {
    // Active range = the selected month itself; the visible range also covers
    // the grayed-out outside days, which carry no data.
    const from = format(info.activeRange.start, "yyyy-MM-dd");
    const to = format(info.activeRange.end, "yyyy-MM-dd");
    setSelectedRange((prev) => (prev.from === from && prev.to === to ? prev : { from, to }));
  };

  const { mutateAsync: publishAsync } = usePublishSession();
  const { mutateAsync: unpublishAsync } = useUnpublishSession();
  const { mutateAsync: deleteBlockAsync } = useDeleteRoomBlock();
  // Blocks load only once the calendar sets an active range (hook stays idle otherwise).
  const { data: blocksData, refetch: refetchBlocks } = useGetRoomBlocks({
    start_date: selectedRange.from ?? undefined,
    end_date: selectedRange.to ?? undefined,
  });

  const headers = [
    {
      id: "session_name",
      text: "Session Name",
      value: (row: ISessionItem) => <span>{row.session_name}</span>,
    },
    {
      id: "credit_only",
      text: "Credit Only",
      value: (row: ISessionItem) =>
        row.is_credit_only ? (
          <Badge variant="secondary" className="text-xs">
            Credit Only
          </Badge>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      id: "class",
      text: "Class",
      value: (row: ISessionItem) => row.class.class_name,
    },
    {
      id: "capacity",
      text: "Capacity",
      value: (row: ISessionItem) => String(row.slots_display),
    },
    {
      id: "start_date",
      text: "Date",
      value: (row: ISessionItem) => formatDateHelper(row.start_date, "dd/MM/yyyy"),
    },
    {
      id: "instructor",
      text: "Instructor",
      value: "instructor_name",
    },
    {
      id: "time",
      text: "Time",
      value: "time_start",
    },
    {
      id: "location",
      text: "Location",
      value: (row: ISessionItem) => <p className="capitalize">{row.place === "offline" ? row.location : row.place}</p>,
    },
    {
      id: "branch",
      text: "Branch",
      value: (row: ISessionItem) => branchLabel(row.branch),
    },
    {
      id: "status",
      text: "Status",
      value: (row: ISessionItem) => (
        <div className="flex flex-col gap-1">
          <p
            className={cn("capitalize font-semibold", {
              "text-gray-500": row.is_published === false,
              "text-green-500": row.is_published !== false && row.status === "ongoing",
              "text-blue-500": row.is_published !== false && row.status === "scheduled",
              "text-red-500": row.is_published !== false && row.status === "ended",
              "text-yellow-500": row.is_published !== false && row.status === "canceled",
            })}
          >
            {row.status}
          </p>
          {row.is_published === false ? (
            <Badge variant="secondary" className="w-fit border-dashed text-xs">
              {isScheduled(row) ? `Scheduled ${formatPublishCountdown(row.publish_at)}` : "Draft · hidden"}
            </Badge>
          ) : null}
        </div>
      ),
    },
  ];

  const numberOptions = {
    text: "No",
    show: false,
    render: (_: unknown, idx: number) => buildNumber(idx, limit, page),
  };

  const actionOptions = {
    text: "Action",
    show: true,
    render: (row: ISessionItem) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="data-[state=open]:bg-muted text-muted-foreground flex size-8" size="icon">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-32">
          {can("session:update") && <DropdownMenuItem onClick={() => router.push(`session/${row.id}/edit`)}>Edit</DropdownMenuItem>}
          {can("session:detail") && <DropdownMenuItem onClick={() => router.push(`session/${row.id}`)}>View Details</DropdownMenuItem>}
          {can("session:update") && row.is_published === false ? (
            <DropdownMenuItem
              onClick={async () => {
                await publishAsync(row.id);
                refetch();
              }}
            >
              Publish
            </DropdownMenuItem>
          ) : null}
          {can("session:update") && row.is_published !== false ? (
            <DropdownMenuItem
              onClick={async () => {
                await unpublishAsync(row.id);
                refetch();
              }}
            >
              Unpublish
            </DropdownMenuItem>
          ) : null}

          {row.status === "canceled" ? (
            <></>
          ) : (
            can("session:delete") && (
              <DropdownMenuItem variant="destructive" className="" onClick={() => onDelete(row.id)}>
                Cancel Session
              </DropdownMenuItem>
            )
          )}

        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };

  const handleSearch = (e: string) => {
    setSearch(e);
    setPage(1);
  };

  const handleDateRangeChangeDual = (startDate: string, endDate?: string) => {
    setSelectedRange((prev) => ({ ...prev, from: startDate, to: endDate ?? "" }));
  };

  const onDelete = (id: string) => {
    setOpenDialogConfirm(!!id);
    setSelectedId(id);
  };

  const onConfirmDeleteBlock = async () => {
    if (!selectedBlock) return;
    try {
      await deleteBlockAsync(selectedBlock.id);
      setSelectedBlock(null);
      refetchBlocks();
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="flex w-full  flex-col gap-2">
      <div className="flex flex-row justify-between w-full items-center">
        <div className="max-w-auto">

          <GeneralTabComponent
            selecetedTab={tabs}
            setTab={(e) => {
              setTabs(e);
              setSearch("");
              setPage(1);
            }}
            tabs={tabFilter}
          />

        </div>
        <div className="flex flex-row items-center w-full justify-end gap-2 flex-wrap">
          <div className="flex gap-1 rounded-md border border-brand-100 p-1">
            <Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => setView("list")}>
              <LayoutList /> List
            </Button>
            <Button
              variant={view === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setTabs("all");
                setSearch("");
                setPage(1);
                setView("calendar");
              }}
            >
              <CalendarDays /> Calendar
            </Button>
          </div>
          <div className="flex gap-2">
            {can("session:create") && (
              <Button
                variant="outline"
                className=" text-sm font-medium"
                onClick={() => {
                  setBlockSeed(null);
                  setOpenBlockDialog(true);
                }}
              >
                <Ban /> Block time
              </Button>
            )}
            {can("session:create") && (
              <Button variant="outline" className=" text-sm font-medium" onClick={() => setOpenDuplicateRange(true)}>
                <CopyPlus /> Duplicate
              </Button>
            )}
            {can("session:create") && (
              <Button className=" text-sm font-medium" onClick={() => router.push("session/create")}>
                <CirclePlus /> Create New Session
              </Button>
            )}
          </div>
        </div>
      </div>

      {view === "calendar" && (
        <PendingGoLiveSection
          startDate={selectedRange.from ?? undefined}
          endDate={selectedRange.to ?? undefined}
          onChanged={refetch}
        />
      )}
      <Card className="border-brand-100 w-full">
        <CardHeader className="flex flex-row w-full justify-between items-center">
          <div className="flex flex-col gap-1">
            <h3 className="text-2xl text-brand-999 font-medium">Sessions</h3>
            <p className="text-sm text-gray-500">Manage class schedules and sessions</p>
          </div>
          <div className="flex items-center flex-row gap-2">
            <div>
              <Select
                value={visibility}
                onValueChange={(v) => {
                  setVisibility(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36 min-h-[42px]">
                  <SelectValue placeholder="Visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Visibility</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select
                value={branch}
                onValueChange={(v) => {
                  setBranch(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44 min-h-[42px]">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {SEHELA_BRANCH.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {view === "list" && (
              <>
                <div>
                  <DateRangePicker
                    mode="range"
                    onDateRangeChange={handleDateRangeChangeDual}
                    startDate={selectedRange.from as string}
                    endDate={selectedRange.to as string}
                    allowFutureDates
                    allowPastDates
                  />
                </div>
                <div>
                  <SearchInput className="border-brand-100 min-h-[42px]" onSearch={handleSearch} search={search} />
                </div>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {view === "list" ? (
            <CustomTable
              data={data?.data ?? []}
              headers={headers}
              numberOptions={numberOptions}
              isLoading={isLoading}
              // setSelectedData={setSelectedData}
              // selectedData={selectedData}

              actionOptions={actionOptions}
            />
          ) : (
            <>
              {calendarLoading && <p className="px-1 py-2 text-sm text-gray-500">Loading all sessions…</p>}
              <SessionsCalendarView
                sessions={calendarData?.data ?? []}
                blocks={blocksData?.data ?? []}
                onRangeChange={handleCalendarRangeChange}
                onSelectSession={(s) => {
                  setSlotPopup(null);
                  setQuickSlot(null);
                  setSelectedSession(s);
                }}
                onSelectBlock={(b) => {
                  setSlotPopup(null);
                  setQuickSlot(null);
                  setSelectedBlock(b);
                }}
                onSlotClick={handleSlotClick}
              />
            </>
          )}
        </CardContent>
        {view === "list" && (
          <CardFooter className="flex w-full">
            <CustomPagination
              onPageChange={(e) => setPage(e)}
              currentPage={page}
              showTotal
              // nextPage={data?.pagination?.}
              hasNextPage={data?.pagination?.has_next}
              hasPrevPage={data?.pagination?.has_prev}
              // previousPage={data?.pagination?.previousPage}
              totalItems={data?.pagination?.total_items as number}
              totalPages={data?.pagination?.total_pages as number}
              limit={10}
            />
          </CardFooter>
        )}
      </Card>

      <DuplicateRangeDialog open={openDuplicateRange} onOpenChange={setOpenDuplicateRange} onDuplicated={refetch} />
      <RoomBlockDialog open={openBlockDialog} onOpenChange={setOpenBlockDialog} onChanged={refetchBlocks} initial={blockSeed} />
      {selectedBlock && (
        <BaseDialogConfirmation
          image="warning-1"
          onCancel={() => setSelectedBlock(null)}
          open={!!selectedBlock}
          title="Delete time block?"
          subtitle={`${selectedBlock.title} · ${formatDateHelper(selectedBlock.start_date, "dd MMM yyyy")} ${selectedBlock.time_start}–${selectedBlock.time_end}. The room becomes bookable again at this time.`}
          onConfirm={onConfirmDeleteBlock}
          cancelText="Keep"
          confirmText="Delete block"
        />
      )}
      <SessionDetailSheet session={selectedSession} open={!!selectedSession} onOpenChange={(o) => !o && setSelectedSession(null)} onChanged={refetch} />
      {slotPopup && view === "calendar" && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSlotPopup(null)} />
          <div
            className="fixed z-50 w-64 rounded-xl border border-brand-100 bg-white p-1.5 shadow-lg"
            style={{
              left: Math.max(8, Math.min(slotPopup.x, window.innerWidth - 272)),
              top: Math.max(8, Math.min(slotPopup.y, window.innerHeight - 280)),
            }}
          >
            <p className="px-2 pt-1 pb-1.5 font-serif text-[13px] text-gray-500">
              {format(slotPopup.date, "EEEE, d MMM yyyy")}
              {!slotPopup.allDay && slotPopup.end
                ? ` · ${format(slotPopup.date, "h:mm a")} – ${format(slotPopup.end, "h:mm a")}`
                : ""}
            </p>
            <button
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-brand-25"
              onClick={() => {
                setQuickSlot({ date: slotPopup.date, end: slotPopup.end, allDay: slotPopup.allDay });
                setSlotPopup(null);
              }}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "#EBF2FE", color: "#3B82F6" }}
              >
                <CalendarPlus className="size-4" />
              </span>
              <span>
                <strong className="block text-sm">New session</strong>
                <small className="text-xs text-gray-500">Bookable, with capacity</small>
              </span>
            </button>
            <button
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-brand-25"
              onClick={() => {
                setBlockSeed(blockInitial);
                setOpenBlockDialog(true);
                setSlotPopup(null);
              }}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "#FDF2F2", color: "#B91C1C" }}
              >
                <Ban className="size-4" />
              </span>
              <span>
                <strong className="block text-sm">Block time</strong>
                <small className="text-xs text-gray-500">Room unusable, no booking</small>
              </span>
            </button>
          </div>
        </>
      )}
      <SessionQuickCreateSheet
        slot={quickSlot}
        open={!!quickSlot}
        onOpenChange={(o) => !o && setQuickSlot(null)}
        onCreated={() => {
          setQuickSlot(null);
          refetch();
        }}
      />
      {openDialogConfirm && (
        <CancelSessionDialog
          sessionId={selectedId}
          sessionName={data?.data?.find((s) => s.id === selectedId)?.session_name}
          open={openDialogConfirm}
          onClose={() => {
            setOpenDialogConfirm(false);
            setSelectedId("");
          }}
          onCommitted={() => refetch()}
        />
      )}
    </div>
  );
};
