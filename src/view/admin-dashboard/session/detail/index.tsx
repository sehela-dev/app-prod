"use client";

import { DateRangePicker } from "@/components/base/date-range-picker";
import { BaseDialogComponent } from "@/components/general/base-dialog-component";
import { CustomTable } from "@/components/general/custom-table";
import { CustomPagination } from "@/components/general/pagination-component";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { useDebounce } from "@/hooks";
import {
  useCancelBooking,
  useChangeAttendanceStatus,
  useEditCustomer,
  usePublishSession,
  useRescheduleSession,
  useSendReminderSession,
  useUnpublishSession,
} from "@/hooks/api/mutations/admin";
import { useGetSessionBookings, useGetSessionDetail, useGetSessions } from "@/hooks/api/queries/admin/class-session";
import { getSessionParticipants } from "@/api-req/class-session";
import { formatPublishCountdown, isScheduled } from "@/utils/session-badge";
import { defaultDate, formatCurrency, formatDateHelper, normalizePhoneNumber, reminderMessage, sendReminder } from "@/lib/helper";
import { cn } from "@/lib/utils";
import { IParticipantsSession, ISessionItem } from "@/types/class-sessions.interface";
import { IAttendanceStatus } from "@/types/orders.interface";
import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Banknote,
  BellRing,
  Copy,
  CopyPlus,
  Ellipsis,
  Loader2,
  LucideIcon,
  PenIcon,
  RotateCcw,
  WalletCards,
} from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import { CardSession } from "../../enrol-students";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BaseDialogConfirmation } from "@/components/general/dialog-confirnation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { BANK_LIST, branchLabel, SEHELA_BANKS, SEHELA_BRANCH } from "@/constants/sample-data";
import { BackButtonComponent } from "@/components/general/back-button";
import { DuplicateSessionDialog } from "@/components/page/session/duplicate-session-dialog";
import { SessionWaitlistPanel } from "@/components/page/session/waitlist-panel";
import Select from "react-select";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useAdminPermission } from "@/hooks/use-role-access";
import { Separator } from "@radix-ui/react-separator";
type RefundType = "none" | "credit_return" | "credit_issue_new" | "manual_external";
type FeeMethod = "cash" | "edc" | "transfer" | "midtrans";

const refundOptions: {
  value: RefundType;
  title: string;
  description: string;
  icon: React.ReactElement;
}[] = [
    {
      value: "none",
      title: "No refund",
      description: "For no-shows or policy violations",
      icon: <Ban />,
    },
    {
      value: "credit_return",
      title: "Return package credits",
      description: "Restore the credit to the original package",
      icon: <ArrowLeftRight />,
    },
    {
      value: "credit_issue_new",
      title: "Issue new credits",
      description: "Create fresh credits with an expiry date",
      icon: <WalletCards />,
    },
    {
      value: "manual_external",
      title: "External cash refund",
      description: "Record a refund handled outside the platform",
      icon: <Banknote />,
    },
  ];

export const SessionDetailPage = () => {
  const router = useRouter();
  const { isManager } = useAdminPermission();
  const params = useParams();
  const { id } = params;
  const { data, isLoading, refetch: refetchDetail } = useGetSessionDetail(id as string);
  const [page, setPage] = useState(1);
  const [openDialog, setOpenDialog] = useState(false);
  const [validityDays, setValidityDays] = useState(15);
  const [refundAmount, setRefundAmount] = useState(0);
  // resechedule
  const [limit] = useState(6);
  const [pageSession, setPageSession] = useState(1);
  const [selectedSession, setSelectedSession] = useState<ISessionItem | null>(null);
  const [selectedRange, setSelectedRange] = useState({
    from: defaultDate().formattedToday,
    to: defaultDate().formattedOneMonthLater,
    // from: "2026-01-01",
    // to: "2026-02-01",
  });
  const [search, setSearch] = useState("");
  const debounceClass = useDebounce(search, 300);
  const [rescheduleNotes, setRescheduleNotes] = useState("");
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [openCancel, setOpenCancel] = useState(false);
  const [refundType, setRefundTYpe] = useState("none");
  const [selectedDataCancel, setSelectedDataCancel] = useState<IParticipantsSession | null>(null);
  const [pendingAttendance, setPendingAttendance] = useState<{ id: string; status: IAttendanceStatus } | null>(null);
  const [isLateCancel, setIsLateCancel] = useState(false);
  const [chargeFee, setChargeFee] = useState(false);
  const [feeMethod, setFeeMethod] = useState<FeeMethod>("cash");
  const [feeAmount, setFeeAmount] = useState<number | "">(75000);
  const [transferFromName, setTransferFromName] = useState("");
  const [transferBankFrom, setTransferBankFrom] = useState<{ label: string; value: string } | null>(null);
  const [transferBankTo, setTransferBankTo] = useState<{ label: string; value: string } | null>(null);
  const [feeBranch, setFeeBranch] = useState<{ label: string; value: string } | null>(null);
  const [feePendingMsg, setFeePendingMsg] = useState<string | null>(null);
  const [feePendingUrl, setFeePendingUrl] = useState<string | null>(null);
  const [feeWaMessage, setFeeWaMessage] = useState<string>("");

  const { mutateAsync: rescheduleSession } = useRescheduleSession();

  const handleSearch = (query: string) => {
    setSearch(query);
    setPage(1);
  };

  const handleDateRangeChangeDual = (startDate: string, endDate?: string) => {
    setSelectedRange((prev) => ({ ...prev, from: startDate, to: endDate ?? "" }));
  };
  const { data: session, isLoading: loadingSession, refetch } = useGetSessionBookings({ id: id as string, page, limit: 10 });

  const { mutateAsync, isPending } = useChangeAttendanceStatus();
  const { mutateAsync: cancelBooking } = useCancelBooking();
  const [openReminder, setOpenReminder] = useState(false);
  const { mutateAsync: remindAll } = useSendReminderSession();
  const { mutateAsync: publishAsync, isPending: isPublishing } = usePublishSession();
  const { mutateAsync: unpublishAsync, isPending: isUnpublishing } = useUnpublishSession();
  const [openDuplicate, setOpenDuplicate] = useState(false);
  const [openRemark, setOpenRemark] = useState(false);
  const [selectedRemarkRow, setSelectedRemarkRow] = useState<IParticipantsSession | null>(null);
  const [remarkValue, setRemarkValue] = useState("");
  const [remarkError, setRemarkError] = useState<string | null>(null);
  const { mutateAsync: updateCustomerRemark, isPending: isUpdatingRemark } = useEditCustomer();

  // Lapor daftar peserta ke guru via WhatsApp (copy chat)
  const [openWaReport, setOpenWaReport] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [waTotal, setWaTotal] = useState(0);
  const [loadingWa, setLoadingWa] = useState(false);

  const onOpenWaReport = async () => {
    setOpenWaReport(true);
    setWaMessage("");
    setLoadingWa(true);
    try {
      const res = await getSessionParticipants(id as string);
      setWaTotal(res?.data?.total ?? 0);
      const list = (res?.data?.participants ?? [])
        .filter((p) => p.name)
        .map((p, i) => `${i + 1}. ${p.name}`)
        .join("\n");
      const d = data?.data;
      const sched = d?.start_date
        ? `${formatDateHelper(d.start_date as string, "dd MMM yyyy")} ${d?.time_start ?? ""}-${d?.time_end ?? ""}`
        : (d?.session_name ?? "");
      setWaMessage(
        `hi kak ${d?.instructor_name ?? ""}, mau infokan untuk murid kelas ${sched} di ${d?.location ?? branchLabel(d?.branch ?? null) ?? "studio"} yaa kakk\n` +
        `sebagai berikut\n${list}\n\n` +
        `untuk next update akan admin infokan kembali yaa kakk, terima kasihhh`,
      );
    } catch {
      toast.error("Gagal memuat daftar peserta", { position: "top-center" });
      setOpenWaReport(false);
    } finally {
      setLoadingWa(false);
    }
  };

  const onConfirmAttendance = async (id: string, status: IAttendanceStatus) => {
    try {
      const payload = {
        id,
        attendance_status: status,
      };
      const res = await mutateAsync(payload);
      if (res) {
        refetch();
      }
    } catch (error) {
      console.log(error);
    }
  };

  const onRequestAttendanceChange = (id: string, status: IAttendanceStatus) => {
    setPendingAttendance({ id, status });
  };
  const onConfirmAttendanceChange = async () => {
    if (!pendingAttendance) return;
    await onConfirmAttendance(pendingAttendance.id, pendingAttendance.status);
    setPendingAttendance(null);
  };

  const getHoursUntilSession = () => {
    const iso = data?.data?.start_datetime;
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    if (Number.isNaN(ms)) return null;
    return ms / 3600000;
  };

  // Penalty policy fee comes from the already-fetched session detail (no extra call).
  const policyFeeIdr = data?.data?.cancellation_fee_idr ?? data?.data?.class?.cancellation_fee_idr ?? 75000;

  const resetCancelState = () => {
    setOpenCancel(false);
    setSelectedDataCancel(null);
    setRescheduleNotes("");
    setRefundTYpe("none");
    setValidityDays(15);
    setRefundAmount(0);
    setIsLateCancel(false);
    setChargeFee(false);
    setFeeMethod("cash");
    setFeeAmount(policyFeeIdr);
    setTransferFromName("");
    setTransferBankFrom(null);
    setTransferBankTo(null);
    setFeeBranch(null);
    setFeePendingMsg(null);
    setFeePendingUrl(null);
    setFeeWaMessage("");
  };

  const buildFeeWaMessage = (snapUrl: string) => {
    const name = selectedDataCancel?.customer_name ?? "Kak";
    const sessionName = data?.data?.session_name ?? "kelas";
    const schedule = data?.data?.start_date
      ? `${formatDateHelper(data.data.start_date as string, "dd MMM yyyy")} ${data?.data?.time_start ?? ""}-${data?.data?.time_end ?? ""}`.trim()
      : `${data?.data?.time_start ?? ""}-${data?.data?.time_end ?? ""}`.trim();
    const place = data?.data?.location ?? data?.data?.branch ?? "studio";
    const amount = feeAmount !== "" ? Number(feeAmount) : policyFeeIdr;
    return `Hi Kak ${name}!\n\nKamu late cancel untuk kelas ${sessionName} (${schedule} di ${place}), jadi ada penalty fee sebesar ${formatCurrency(Number.isNaN(amount) ? policyFeeIdr : amount)}.\n\nKredit kamu akan otomatis kembali setelah fee lunas. Silakan selesaikan pembayaran di link berikut:\n${snapUrl}\n\nTerima kasih!`;
  };

  const onTriggerCancel = (row: IParticipantsSession) => {
    setSelectedDataCancel(row);
    const hoursUntil = getHoursUntilSession();
    const late = hoursUntil !== null && hoursUntil < 6;
    setIsLateCancel(late);
    setFeePendingMsg(null);
    setFeePendingUrl(null);
    setFeeWaMessage("");
    setTransferFromName(row?.customer_name ?? "");
    setTransferBankFrom(null);
    setTransferBankTo(null);
    setFeeBranch(null);
    setFeeMethod("cash");
    setFeeAmount(policyFeeIdr);
    const isCredits = row?.paid_with?.type === "credits" || row?.payment_method === "credits";
    if (late) {
      // Late (<6h): penalty fee checkbox. Auto-checked for admin, manager opts in. Fee 0 = free, no penalty.
      setRefundTYpe(isCredits ? "credit_return" : "none");
      setChargeFee(isCredits && !isManager && policyFeeIdr > 0);
    } else if (isCredits) {
      setRefundTYpe("credit_return");
      setChargeFee(false);
    } else {
      setRefundTYpe("credit_issue_new");
      setChargeFee(false);
    }
    // cash/midtrans amount prefill for external refund; credits use package expiry
    const isCash = row?.payment_method === "cash" || row?.payment_method === "midtrans" || row?.paid_with?.type === "cash";
    setRefundAmount(isCash ? row?.paid_with?.revenue_idr ?? 0 : 0);
    const packageExpiry = row?.paid_with?.package_expires_at;
    setValidityDays(packageExpiry ? Math.max(differenceInCalendarDays(new Date(packageExpiry), new Date()), 0) : 15);
    setOpenCancel(true);
  };
  const onCancelBooking = async () => {
    let keepOpenForPending = false;
    try {
      setFeePendingMsg(null);
      setFeePendingUrl(null);
      setFeeWaMessage("");
      const payload = {
        id: selectedDataCancel?.id as string,
        refund_type: refundType,
        cancel_reason: rescheduleNotes.trim(),
        ...(refundType === "credit_issue_new" && {
          refund_validity_days: Number(validityDays),
        }),
        ...(refundType === "manual_external" && {
          refund_amount_idr: Number(refundAmount),
        }),
        ...(isLateCancel &&
          chargeFee && {
          charge_fee: true,
          ...(feeAmount !== "" && { fee_amount_idr: Number(feeAmount) }),
          fee_payment_method: feeMethod,
          // Same shape as manual bank-transfer order: stored as-is in payments.provider_payload.transfer_details
          ...(feeMethod === "transfer" && {
            transfer_details: {
              ...(transferFromName.trim() && { account_name_from: transferFromName.trim() }),
              ...(transferBankFrom?.label && { account_bank_from: transferBankFrom.label }),
              ...(transferBankTo?.label && { account_bank_to: transferBankTo.label }),
            },
          }),
          // Fee branch override; BE falls back to booking's branch when omitted
          ...(feeBranch?.value && { fee_branch: feeBranch.value }),
        }),
      };
      const res = await cancelBooking(payload);
      const feePayment = (res as { data?: { fee_payment?: { status?: string; snap_token?: string; snap_redirect_url?: string }; booking_status?: string; message?: string } })
        ?.data?.fee_payment;
      if (feePayment?.status === "pending" && (feePayment.snap_redirect_url || feePayment.snap_token)) {
        // Midtrans penalty: no auto redirect. Admin copies the WA text below and sends it manually.
        const url = feePayment.snap_redirect_url ?? "";
        toast.info("Fee payment pending", {
          id: "fee-pending",
          description: "Copy pesan WA di bawah dan kirim ke customer. Booking batal otomatis setelah fee lunas.",
          position: "top-center",
        });
        setFeePendingUrl(url || null);
        setFeeWaMessage(url ? buildFeeWaMessage(url) : "");
        setFeePendingMsg("Fee payment pending. Kirim link berikut ke customer via WhatsApp. Booking batal otomatis setelah Midtrans lunas.");
        refetch();
        keepOpenForPending = true;
        return;
      }
      if (res) {
        refetch();
        resetCancelState();
      }
    } catch (error) {
      console.log(error);
    } finally {
      // keep dialog open on midtrans-pending so admin sees the waiting state
      if (!keepOpenForPending && !feePendingMsg) {
        setOpenCancel(false);
        setSelectedDataCancel(null);
      }
    }
  };

  const onOpenRemark = (row: IParticipantsSession) => {
    setSelectedRemarkRow(row);
    setRemarkValue(row.remark ?? "");
    setRemarkError(null);
    setOpenRemark(true);
  };
  const onCloseRemark = () => {
    setOpenRemark(false);
    setSelectedRemarkRow(null);
    setRemarkValue("");
    setRemarkError(null);
  };
  const onSaveRemark = async () => {
    if (remarkValue.length > 2000) {
      setRemarkError("Remark must be ≤2000 characters");
      return;
    }
    if (!selectedRemarkRow) return;
    try {
      setRemarkError(null);
      await updateCustomerRemark({ id: selectedRemarkRow.user_id, data: { remark: remarkValue } });
      refetch();
      onCloseRemark();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { details?: { remark?: string[] }; message?: string } } } };
      const msg = err?.response?.data?.error?.details?.remark?.[0] || err?.response?.data?.error?.message;
      if (msg) setRemarkError(msg);
    }
  };

  const onOpenDuplicate = () => {
    setOpenDuplicate(true);
  };

  const onTogglePublish = async () => {
    try {
      if (data?.data?.is_published === false) await publishAsync(id as string);
      else await unpublishAsync(id as string);
      refetchDetail();
    } catch (error) {
      console.log(error);
    }
  };

  const headers = [
    {
      id: "customer_name",
      text: "Customer Name",
      value: (row: IParticipantsSession) => (
        <div className="flex flex-row gap-2 w-full">
          <p>{row?.customer_name}</p>
          <Button
            className="w-6 h-6"
            variant={"outline"}
            onClick={() => {
              navigator.clipboard.writeText(row?.customer_name);
              return toast.success("Name copied!", {
                id: "error",
                position: "top-center",
              });
            }}
          >
            <Copy />
          </Button>
        </div>
      ),
    },

    {
      id: "payment_method",
      text: "Payment",
      value: (row: IParticipantsSession) => {
        const provider = (row.paid_with?.provider || "").toLowerCase();
        const type = (row.paid_with?.type || "").toLowerCase();
        const method = (row.payment_method || type || "-").toLowerCase();
        const isCredits = type === "credits" || method === "credits";
        let label: string;
        if (isCredits) label = "Credits";
        else if (provider === "third_party") label = "3rd Party";
        else if (provider === "midtrans" || method === "midtrans") label = "Midtrans";
        else if (method === "cash" || type === "cash") label = "Cash";
        else label = row.payment_method || "-";
        return (
          <Badge
            variant="outline"
            className={cn(
              "capitalize whitespace-nowrap",
              isCredits
                ? "border-brand-200 bg-brand-25 text-brand-700"
                : provider === "third_party"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}
          >
            {label}
          </Badge>
        );
      },
    },
    {
      id: "paid_with",
      text: "Package / Paid",
      value: (row: IParticipantsSession) => {
        if (!row.paid_with) return <span className="text-muted-foreground">-</span>;
        if (row.paid_with.type === "credits") {
          return (
            <div className="flex flex-col leading-tight">
              <span className="font-medium whitespace-nowrap">{row.paid_with.package_name ?? "Package"}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {row.paid_with.credits_used ?? 1} cr
                {row.paid_with.package_expires_at ? ` · exp ${formatDateHelper(row.paid_with.package_expires_at, "dd MMM yy")}` : ""}
              </span>
            </div>
          );
        }
        return (
          <div className="flex flex-col leading-tight">
            <span className="font-medium whitespace-nowrap">{formatCurrency(row.paid_with.revenue_idr ?? 0)}</span>
            {row.payment_status && <span className="text-xs text-muted-foreground capitalize">{row.payment_status}</span>}
          </div>
        );
      },
    },
    {
      id: "photo_consent",
      text: "Photo Consent",
      value: (row: IParticipantsSession) => <p>{row?.photo_consent ? "Yes" : "No"}</p>,
    },
    {
      id: "instagram_username",
      text: "Instagram",
      value: (row: IParticipantsSession) => <p>{row?.instagram_username ?? "-"}</p>,
    },
    {
      id: "medical_notes",
      text: "Medical Notes",
      value: (row: IParticipantsSession) => <p>{row?.medical_notes ?? "-"}</p>,
    },
    {
      id: "remark",
      text: "Admin Remarks",
      value: (row: IParticipantsSession) =>
        row?.remark ? (
          <span className="block max-w-[200px] truncate" title={row.remark}>
            {row.remark}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "edit_remark",
      text: "Edit Remark",
      value: (row: IParticipantsSession) => (
        <Button variant="outline" size="sm" className="h-7 whitespace-nowrap" onClick={() => onOpenRemark(row)}>
          <PenIcon className="h-3.5 w-3.5" />
          Edit
        </Button>
      ),
    },
    {
      id: "attendance_status",
      text: "Attendance",
      value: (row: IParticipantsSession) => (
        <div className="">
          {!row.attendance_status ? (
            <p className="italic text-gray-500">No Confirmation</p>
          ) : (
            <p
              className={cn({
                "text-green-500": row.attendance_status === "attended",
                "text-red-500": row.attendance_status === "no_show",
              })}
            >
              {row.attendance_status === "attended" ? "Checked In" : "No Show"}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "reminder",
      text: "Send Reminder",
      value: (row: IParticipantsSession) => (
        <div className="flex w-full items-center justify-center">
          <Button
            className="w-8 h-8"
            onClick={() => {
              const msg = reminderMessage(
                row.customer_name,
                data?.data?.session_name as string,
                `${data?.data?.time_start} - ${data?.data?.time_end}`,
                `${data?.data?.location}`,
              );
              sendReminder(row?.customer_phone.trim(), msg);
            }}
            disabled={data?.data?.status === "ended" || data?.data?.status === "cancelled"}
          >
            <BellRing />
          </Button>
        </div>
      ),
    },
  ];

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setPageSession(1);
    setRescheduleNotes("");
    setSelectedRow(null);
    setSelectedSession(null);
    refetch();
    refetchSession();
    setSearch("");
  };
  const onRemindAll = async () => {
    try {
      const res = await remindAll(id as string);
      if (res) {
        console.log(res);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setOpenReminder(false);
    }
  };

  const {
    data: sessionList,
    isLoading: loadingSessionReschedule,
    refetch: refetchSession,
  } = useGetSessions({
    page: pageSession,
    limit: 6,
    startDate: selectedRange.from,
    endDate: selectedRange.to,
    search: debounceClass,
    status: "scheduled",
  });

  const actionOptions = {
    text: "Action",
    // show: data?.data?.status !== "ended",
    show: true,
    render: (row: IParticipantsSession) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="data-[state=open]:bg-muted text-muted-foreground flex size-8" size="icon">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem onClick={() => onRequestAttendanceChange(row.id, "attended")} disabled={isPending}>
            Check In
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onRequestAttendanceChange(row.id, "no_show")} className="text-red-500" disabled={isPending}>
            No Show
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setOpenDialog(true);
              setSelectedRow(row.id);
            }}
          >
            Reschedule
          </DropdownMenuItem>
          {row.booking_status !== "cancelled" &&
            row.booking_status !== "canceled" &&
            row.payment_status !== "voided" &&
            ((row.attendance_status === "attended" && isManager) || !row.attendance_status) ? (
            <DropdownMenuItem onClick={() => onTriggerCancel(row)} className="text-red-500" disabled={isPending}>
              Cancel Booking
            </DropdownMenuItem>
          ) : (
            ""
          )}
          <Divider className="my-1" />
          {isManager ? (
            <DropdownMenuItem onClick={() => onRequestAttendanceChange(row.id, null)} className="bg-brand-50" disabled={isPending}>
              <RotateCcw /> Reset
            </DropdownMenuItem>
          ) : (
            ""
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };

  const onResheduleSession = async () => {
    try {
      const payload = {
        id: selectedRow as string,
        new_session_id: selectedSession?.id as string,
        notes: rescheduleNotes as string,
      };
      const res = await rescheduleSession(payload);
      if (res) {
        console.log(res);
      }
    } catch (error) {
      console.log(error);
    } finally {
      handleCloseDialog();
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-center w-full justify-between">
          <BackButtonComponent page="/admin/session">
            <div className="flex flex-col">
              <div className="flex flex-row items-center gap-4">
                <h3 className="text-2xl font-semibold items-center">Session Detail</h3>
                <Badge
                  className={cn("capitalize font-bold", {
                    "text-green-500": data?.data?.status === "ongoing",
                    "text-blue-500": data?.data?.status === "scheduled",
                    "text-red-500": data?.data?.status === "ended",
                    "text-yellow-500": data?.data?.status === "canceled",
                  })}
                  variant={"outline"}
                >
                  {data?.data?.status}
                </Badge>
                {data?.data?.is_credit_only ? <Badge variant="secondary">Credit Only</Badge> : null}
                {data?.data?.is_published === false ? (
                  <Badge variant="secondary">
                    {isScheduled(data?.data) ? `Scheduled ${formatPublishCountdown(data?.data?.publish_at)}` : "Draft"}
                  </Badge>
                ) : null}
              </div>

              <p className="text-sm text-gray-500">Review all session details and make updates as needed</p>
            </div>
          </BackButtonComponent>

          <div className="flex flex-row items-center gap-2">
            <div>
              <Button variant="outline" onClick={onOpenDuplicate}>
                <CopyPlus /> Duplicate
              </Button>
            </div>
            <div>
              <Button variant="outline" onClick={onTogglePublish} disabled={isPublishing || isUnpublishing}>
                {data?.data?.is_published === false ? "Publish" : "Unpublish"}
              </Button>
            </div>
            <div>
              <Button onClick={() => router.push(`${id}/edit`)}>
                <PenIcon /> Edit
              </Button>
            </div>
          </div>
        </div>
        <Divider className="my-2" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold">Basic Information</h4>
            <div className="grid grid-cols-12 gap-4">
              <div className="grid col-span-3 text-gray-500">Session ID</div>
              <div className="grid col-span-9">{data?.data?.session_id}</div>
              <div className="grid col-span-3 text-gray-500">Session Name</div>
              <div className="grid col-span-9">{data?.data?.session_name}</div>
              <div className="grid col-span-3 text-gray-500">Capacity</div>
              <div className="grid col-span-9">{data?.data?.capacity}</div>
              <div className="grid col-span-3 text-gray-500">Class Category</div>
              <div className="grid col-span-9">{data?.data?.class?.class_name}</div>
              <div className="grid col-span-3 text-gray-500">Instructor</div>
              <div className="grid col-span-9">{data?.data?.instructor_name}</div>
              <div className="grid col-span-3 text-gray-500">Description</div>
              <div className="grid col-span-9">{data?.data?.session_description}</div>
            </div>
          </div>
          <Divider className="my-2" />

          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold">Date & Time</h4>
            <div className="grid grid-cols-12 gap-4">
              <div className="grid col-span-3 text-gray-500">Start Date</div>
              <div className="grid col-span-9">{formatDateHelper(data?.data?.start_date as string, "dd MMM yyyy")}</div>
              <div className="grid col-span-3 text-gray-500">Time</div>
              <div className="grid col-span-9">
                {data?.data?.time_start} - {data?.data?.time_end}
              </div>
              <div className="grid col-span-3 text-gray-500">Location Type</div>
              <div className="grid col-span-9 capitalize">{data?.data?.place}</div>
              <div className="grid col-span-3 text-gray-500">Branch</div>
              <div className="grid col-span-9">{branchLabel(data?.data?.branch ?? null)}</div>
              <div className="grid col-span-3 text-gray-500">Location Details</div>
              <div className="grid col-span-9">{data?.data?.location}</div>
              <div className="grid col-span-3 text-gray-500">Location Maps Url</div>
              <div className="grid col-span-9">
                <a href={data?.data.location_maps_url} target="_blank" className="text-blue-500 underline">
                  {data?.data?.location_address ?? data?.data?.location}
                </a>
              </div>
            </div>
          </div>
          <Divider className="my-2" />

          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold">Pricing</h4>
            <div className="grid grid-cols-12 gap-4">
              <div className="grid col-span-3 text-gray-500">Payment</div>
              <div className="grid col-span-9">{data?.data?.is_credit_only ? "Credit Only" : "Cash + Credit"}</div>
              <div className="grid col-span-3 text-gray-500">Regular Price</div>
              <div className="grid col-span-9">{formatCurrency(data?.data?.price_idr)}</div>
              <div className="grid col-span-3 text-gray-500">Credit Price</div>
              <div className="grid col-span-9">{data?.data?.price_credit_amount} Credit</div>
              {data?.data?.photo_url ? (
                <>
                  <div className="grid col-span-3 text-gray-500">Photo</div>
                  <div className="grid col-span-9">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.data.photo_url} alt="session" className="h-32 w-32 rounded object-cover border" />
                  </div>
                </>
              ) : null}
              <div className="grid col-span-3 text-gray-500">Discount</div>
              {/* <div className="grid col-span-9">{data?.data?.place}</div> */}
              <div className="grid col-span-9">-</div>
              <div className="grid col-span-3 text-gray-500">Discount Price</div>
              {/* <div className="grid col-span-9">Value</div> */}
              <div className="grid col-span-9">-</div>
            </div>
          </div>
          <Divider className="my-2" />
          <div className="flex flex-col gap-4">
            <div className="flex flex-row items-center justify-between">
              <h4 className="text-sm font-semibold">Participants</h4>
              <Button variant="outline" onClick={onOpenWaReport} disabled={loadingWa}>
                <Copy /> Lapor ke Guru
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <CustomTable
                data={session?.data ?? []}
                headers={headers}
                // numberOptions={numberOptions}
                isLoading={loadingSession}
                // setSelectedData={setSelectedData}
                // selectedData={selectedData}
                actionOptions={actionOptions}
              />
              <CustomPagination
                onPageChange={(e) => {
                  setPage(e);
                }}
                currentPage={page}
                showTotal
                hasPrevPage={session?.pagination?.has_prev}
                hasNextPage={session?.pagination?.has_next}
                totalItems={session?.pagination?.total_items as number}
                totalPages={session?.pagination?.total_pages as number}
                limit={10}
              />
            </div>
          </div>
          <Divider className="my-2" />
          <SessionWaitlistPanel sessionId={id as string} />
        </div>
      </CardContent>
      {openDialog && (
        <BaseDialogComponent
          title="Reschedule"
          isOpen={openDialog}
          btnConfirm="Proceed"
          onClose={() => {
            handleCloseDialog();
          }}
          onConfirm={onResheduleSession}
        >
          <div className="flex flex-col gap-2">
            <SearchInput className="border-brand-100" search={search} onSearch={handleSearch} />
            <div className="flex flex-row items-center gap-4">
              <div className="w-full flex flex-col gap-1">
                <p className="text-sm font-medium">Date From</p>
                <DateRangePicker
                  mode="single"
                  onDateRangeChange={(e) => handleDateRangeChangeDual(e)}
                  startDate={selectedRange.from}
                  allowFutureDates
                  allowPastDates={false}
                />
              </div>
              <div className="w-full">
                <p className="text-sm font-medium">Date to</p>
                <DateRangePicker
                  mode="single"
                  onDateRangeChange={(e) => handleDateRangeChangeDual(selectedRange.from, e)}
                  startDate={selectedRange.to}
                  allowFutureDates
                  allowPastDates={false}
                />
              </div>
            </div>
            <div className="w-full flex-col gap-2">
              {loadingSessionReschedule ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (sessionList?.data?.length as number) > 0 ? (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {sessionList?.data?.map((item) =>
                    item.id !== id ? (
                      <CardSession
                        key={item.id}
                        date={formatDateHelper(item.start_datetime, "dd/MM/yyyy")}
                        instructor={item.instructor_name}
                        time={`${item.time_start} - ${item.time_end}`}
                        slot={item.slots_display}
                        title={`[${item?.class?.class_name}] - ${item.session_name}`}
                        onSelect={() => setSelectedSession(item)}
                        status={item.location}
                        isSelected={item.id === selectedSession?.id}
                      />
                    ) : null,
                  )}
                </div>
              ) : (
                <div className="italic flex flex-row items-center justify-center w-full">No Data Found</div>
              )}
            </div>
            <CustomPagination
              onPageChange={(e) => {
                setPageSession(e);
              }}
              currentPage={pageSession}
              showTotal
              hasPrevPage={sessionList?.pagination?.has_prev}
              hasNextPage={sessionList?.pagination?.has_next}
              totalItems={sessionList?.pagination?.total_items as number}
              totalPages={sessionList?.pagination?.total_pages as number}
              limit={limit}
            />
            {selectedSession && (
              <div className="flex flex-col gap-2">
                <Label>Notes</Label>
                <Textarea
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                  placeholder="Type here.."
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                />
              </div>
            )}
          </div>
        </BaseDialogComponent>
      )}
      {openCancel && (
        <BaseDialogComponent
          isOpen={openCancel}
          title="Cancel Booking"
          buttonTriggerText="Cancel Booking"
          onConfirm={onCancelBooking}
          btnConfirm={isLateCancel && chargeFee && refundType !== "none" ? "Record Fee & Return Credit" : "Cancel Booking"}
          onClose={resetCancelState}
        >
          {(() => {
            const hoursUntil = (() => {
              const iso = data?.data?.start_datetime;
              if (!iso) return null;
              const ms = new Date(iso).getTime() - Date.now();
              return Number.isNaN(ms) ? null : ms / 3600000;
            })();
            const isCredits = selectedDataCancel?.paid_with?.type === "credits" || selectedDataCancel?.payment_method === "credits";
            const provider = (selectedDataCancel?.paid_with?.provider || "").toLowerCase();
            const isThirdParty = provider === "third_party";
            const isCash =
              selectedDataCancel?.payment_method === "cash" ||
              selectedDataCancel?.payment_method === "midtrans" ||
              selectedDataCancel?.paid_with?.type === "cash";
            const feeMethods: FeeMethod[] = ["cash", "edc", "transfer", "midtrans"];
            return (
              <>
                <div
                  className={cn(
                    "flex gap-3 rounded-lg border p-3 text-sm font-sans",
                    isLateCancel ? "border-amber-300 bg-amber-50 text-amber-900" : "border-brand-100 bg-brand-25 text-brand-900",
                  )}
                >
                  <AlertTriangle className={cn("h-5 w-5 shrink-0", isLateCancel ? "text-amber-600" : "text-brand-500")} />
                  <div>
                    <p className="font-semibold">{isLateCancel ? "Late cancellation — less than 6 hours" : "On-time cancellation"}</p>
                    {selectedDataCancel && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedDataCancel.customer_name} ·{" "}
                        {isCredits
                          ? `Package: ${selectedDataCancel.paid_with?.package_name ?? "-"} (${selectedDataCancel.paid_with?.credits_used ?? 1} cr)`
                          : `Cash: ${formatCurrency(selectedDataCancel.paid_with?.revenue_idr ?? data?.data?.price_idr)} · ${isThirdParty ? "3rd Party" : isCash ? "Midtrans/cash" : selectedDataCancel.payment_method
                          }`}
                        {hoursUntil !== null && ` · starts in ${hoursUntil.toFixed(1)}h`}
                      </p>
                    )}
                    {isLateCancel && (
                      <p className="text-xs mt-1">
                        Per T&C the credit is forfeited. To return it, the customer must pay the penalty fee.
                      </p>
                    )}
                  </div>
                </div>

                <RadioGroup
                  value={refundType}
                  onValueChange={(v) => {
                    setRefundTYpe(v);
                  }}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {refundOptions.map((option) => {
                      // Credit bookings can only return to their original package; cash bookings have no package to return to.
                      const disabled =
                        (option.value === "credit_return" && !isCredits) ||
                        (option.value === "credit_issue_new" && isCredits);
                      return (
                        <div
                          key={option.value}
                          className={cn("flex items-center space-x-2 border border-brand-400 rounded-xl p-4", {
                            "border-2 bg-brand-50": refundType === option.value,
                            "opacity-40": disabled,
                          })}
                        >
                          <RadioGroupItem value={option.value} id={option.value} disabled={disabled} />
                          <Label
                            htmlFor={option.value}
                            className={cn("text-sm font-medium text-brand-999", disabled ? "cursor-not-allowed" : "cursor-pointer")}
                          >
                            <div className="flex flex-row items-center gap-4">
                              {option.icon}
                              <div className="flex flex-col gap-2">
                                <p className="font-bold text-xl">{option.title}</p>
                                <p className="font-normal">{option.description}</p>
                              </div>
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </RadioGroup>

                {refundType === "credit_issue_new" && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="validity-days">Credit validity</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="validity-days"
                        type="number"
                        min="0"
                        value={validityDays}
                        readOnly={!!selectedDataCancel?.paid_with?.package_expires_at}
                        onChange={(event) => setValidityDays(parseInt(event.target.value))}
                        className="max-w-32"
                      />
                      <span className="text-sm text-muted-foreground">days from cancellation</span>
                    </div>
                    {selectedDataCancel?.paid_with?.package_expires_at && (
                      <p className="text-xs text-muted-foreground">
                        Expiry matches original package: {formatDateHelper(selectedDataCancel.paid_with.package_expires_at, "dd MMM yyyy")}
                      </p>
                    )}
                  </div>
                )}

                {refundType === "manual_external" && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="refund-amount">Refund amount</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">IDR</span>
                      <Input
                        id="refund-amount"
                        type="number"
                        min="1"
                        placeholder="150000"
                        value={refundAmount || ""}
                        readOnly={selectedDataCancel?.payment_method === "cash"}
                        onChange={(event) => setRefundAmount(parseInt(event.target.value))}
                      />
                    </div>
                    {selectedDataCancel?.payment_method === "cash" && (
                      <p className="text-xs text-muted-foreground">Refund amount is prefilled from the cash payment received.</p>
                    )}
                  </div>
                )}

                {isLateCancel && (
                  <div className="flex flex-col gap-3 rounded-xl border border-brand-200 p-4 font-sans">
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chargeFee}
                        disabled={policyFeeIdr === 0}
                        onChange={(e) => setChargeFee(e.target.checked)}
                        className="h-4 w-4 accent-teal-700"
                      />
                      Charge penalty fee
                      {policyFeeIdr === 0 ? (
                        <span className="text-xs text-muted-foreground">Free, no penalty for this class</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{formatCurrency(policyFeeIdr)} set by policy</span>
                      )}
                    </label>
                    {chargeFee && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="fee-amount">Amount (IDR)</Label>
                            <Input
                              id="fee-amount"
                              type="number"
                              min="1"
                              placeholder={`${policyFeeIdr} (policy default)`}
                              value={feeAmount}
                              readOnly={!isManager}
                              onChange={(e) => setFeeAmount(e.target.value === "" ? "" : Number(e.target.value))}
                            />
                            <p className="text-xs text-muted-foreground">
                              {isManager ? "Empty = policy default (class fee)." : "Nominal dikunci policy, hanya manager yang bisa ubah."}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label>Payment method</Label>
                            <div className="flex flex-wrap gap-1">
                              {feeMethods.map((m) => (
                                <Button
                                  key={m}
                                  type="button"
                                  variant={feeMethod === m ? "default" : "outline"}
                                  size="sm"
                                  className="capitalize"
                                  onClick={() => setFeeMethod(m)}
                                >
                                  {m === "edc" ? "EDC" : m === "transfer" ? "Transfer" : m.charAt(0).toUpperCase() + m.slice(1)}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {feeMethod === "transfer" && (
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                              <Label htmlFor="fee-transfer-from">Transfer from (name)</Label>
                              <Input
                                id="fee-transfer-from"
                                placeholder="Sender name..."
                                value={transferFromName}
                                onChange={(e) => setTransferFromName(e.target.value)}
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <Label>Transfer from (bank)</Label>
                              <Select
                                options={BANK_LIST as never}
                                value={transferBankFrom as never}
                                placeholder="Select sender bank..."
                                onChange={(e) => setTransferBankFrom(e as unknown as { label: string; value: string })}
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <Label>Transfer to (Sehela account)</Label>
                              <Select
                                options={SEHELA_BANKS as never}
                                value={transferBankTo as never}
                                placeholder="Select destination..."
                                onChange={(e) => setTransferBankTo(e as unknown as { label: string; value: string })}
                              />
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <Label>Fee branch</Label>
                          <Select
                            options={SEHELA_BRANCH as never}
                            value={
                              (feeBranch ??
                                (data?.data?.branch
                                  ? SEHELA_BRANCH.find((b) => b.value === data.data.branch)
                                  : null)) as never
                            }
                            placeholder="Booking branch (auto)"
                            isClearable
                            onChange={(e) => setFeeBranch((e as unknown as { label: string; value: string }) ?? null)}
                          />
                          <p className="text-xs text-muted-foreground">Empty = booking branch. Set only to override.</p>
                        </div>
                        {feeMethod === "midtrans" && !feePendingUrl && (
                          <p className="text-xs text-muted-foreground">
                            Tidak ada redirect otomatis. Setelah konfirmasi, salin pesan WA di bawah dan kirim ke customer.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {feePendingMsg && (
                  <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <p>{feePendingMsg}</p>
                    {feePendingUrl && (
                      <div className="flex flex-col gap-1">
                        <Label className="text-amber-900">Link pembayaran</Label>
                        <div className="flex items-center gap-2">
                          <Input value={feePendingUrl} readOnly className="bg-white text-xs" />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(feePendingUrl);
                              toast.success("Link copied!");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                    {feeWaMessage && (
                      <div className="flex flex-col gap-1">
                        <Label className="text-amber-900">Pesan WA untuk customer</Label>
                        <Textarea value={feeWaMessage} readOnly rows={7} className="bg-white text-xs" />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(feeWaMessage);
                              toast.success("Pesan copied!");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy pesan
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!selectedDataCancel?.customer_phone}
                            onClick={() => {
                              const phone = normalizePhoneNumber(selectedDataCancel?.customer_phone?.trim() ?? "");
                              window.open(`https://wa.me/${phone}?text=${encodeURIComponent(feeWaMessage)}`, "_blank", "noopener");
                            }}
                          >
                            Kirim via WhatsApp
                          </Button>
                        </div>
                        {!selectedDataCancel?.customer_phone && (
                          <p className="text-xs">Nomor WA customer kosong, copy pesan manual.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label>Notes</Label>
                  <Textarea
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                    placeholder="Type here.."
                    onChange={(e) => setRescheduleNotes(e.target.value)}
                  />
                </div>
              </>
            );
          })()}
        </BaseDialogComponent>
      )}
      {openReminder && (
        <BaseDialogConfirmation
          open={openReminder}
          title="Send Reminder to all participants?"
          subtitle="Participants will be receive email according this session"
          onConfirm={onRemindAll}
          confirmText="Remind All"
          onCancel={() => setOpenReminder(false)}
          image="warning-1"
        />
      )}
      {pendingAttendance && (
        <BaseDialogConfirmation
          open={!!pendingAttendance}
          title={
            pendingAttendance.status === "attended"
              ? "Confirm Check In"
              : pendingAttendance.status === "no_show"
                ? "Confirm No Show"
                : "Confirm Reset Attendance"
          }
          subtitle={
            pendingAttendance.status === "attended"
              ? "Mark this participant as attended?"
              : pendingAttendance.status === "no_show"
                ? "Mark this participant as no show?"
                : "Reset this participant's attendance status? This action cannot be undone."
          }
          onConfirm={onConfirmAttendanceChange}
          confirmText={pendingAttendance.status ? "Confirm" : "Reset"}
          onCancel={() => setPendingAttendance(null)}
          image="warning-1"
        />
      )}
      {openDuplicate && (
        <DuplicateSessionDialog
          source={data?.data ?? null}
          open={openDuplicate}
          onOpenChange={setOpenDuplicate}
        />
      )}
      {openWaReport && (
        <BaseDialogComponent
          isOpen={openWaReport}
          title="Lapor Daftar Peserta ke Guru (WhatsApp)"
          btnConfirm="Copy Pesan"
          onClose={() => setOpenWaReport(false)}
          onConfirm={() => {
            navigator.clipboard.writeText(waMessage);
            toast.success("Pesan copied! Tempel di chat WhatsApp guru.", { position: "top-center" });
          }}
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {data?.data?.class?.class_name} · {data?.data?.session_name} · {waTotal} peserta confirmed
            </p>
            {loadingWa ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Textarea
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                rows={12}
                placeholder="Daftar peserta..."
                className="font-sans text-sm"
              />
            )}
          </div>
        </BaseDialogComponent>
      )}
      {openRemark && (
        <BaseDialogComponent
          isOpen={openRemark}
          title={selectedRemarkRow ? `Remark — ${selectedRemarkRow.customer_name}` : "Remark"}
          btnConfirm="Save"
          isDisabled={isUpdatingRemark}
          onClose={onCloseRemark}
          onConfirm={onSaveRemark}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="remark-input">Internal notes (only admin can see)</Label>
            <Textarea
              id="remark-input"
              value={remarkValue}
              onChange={(e) => setRemarkValue(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Internal notes (only admin can see)"
              className="min-h-[96px]"
            />
            <div className="flex justify-between">
              {remarkError ? <p className="text-sm text-destructive">{remarkError}</p> : <span />}
              <p className="text-xs text-muted-foreground ml-auto">{remarkValue.length}/2000</p>
            </div>
          </div>
        </BaseDialogComponent>
      )}
    </Card>
  );
};
