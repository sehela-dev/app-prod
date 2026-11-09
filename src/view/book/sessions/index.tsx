"use client";

import { useState } from "react";

import { useParams, useRouter } from "next/navigation";
import {
  CalendarMinus2,
  ChevronLeft,
  Clock4,
  ExternalLink,
  Gem,
  Loader2,
  MapPin,
  Users,
  Video,
} from "lucide-react";

import { StickyContainerComponent } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePaymentMethodCtx } from "@/context/payment-method.ctx";
import { useAuthMember } from "@/context/member.ctx";
import { useGetPublicSession } from "@/hooks/api/queries/customer/public";
import { useGetWaitlistStatus } from "@/hooks/api/queries/customer/profile";
import { useJoinWaitlist } from "@/hooks/api/mutations/customers";
import { formatDateHelper } from "@/lib/helper";
import { getSessionLevelBadge, getSessionTypeBadge } from "@/utils/session-badge";
import { toast } from "sonner";

const getDuration = (start: string, end: string): string => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const total = eh * 60 + em - (sh * 60 + sm);
  return total > 0 ? `${total} min` : "";
};

const InfoCard = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-brand-100 bg-brand-25 p-4">
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-extrabold uppercase tracking-wider">{title}</h3>
    </div>
    <div className="mt-3 flex flex-col gap-3">{children}</div>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3">
    <p className="text-sm text-brand-500/70">{label}</p>
    <div className="text-right text-sm font-semibold">{value}</div>
  </div>
);

export const SessionDetailView = () => {
  const router = useRouter();
  const { id } = useParams();
  const sessionId = typeof id === "string" ? id : undefined;
  const { onChangePaymentMethod } = usePaymentMethodCtx();
  const { isAuthenticated, isAuthReady } = useAuthMember();

  const { data: session, isLoading, isError } = useGetPublicSession(sessionId);

  const [justJoined, setJustJoined] = useState(false);

  const { data: waitlist } = useGetWaitlistStatus(sessionId, isAuthReady && isAuthenticated);
  const { mutate: joinWaitlist, isPending: joinPending } = useJoinWaitlist();

  const handleNotify = () => {
    if (!isAuthenticated) {
      router.push(`/auth/login?next=${encodeURIComponent(`/book/session/${sessionId}`)}`);
      return;
    }
    setJustJoined(true); // optimistic — flip back on failure
    joinWaitlist(sessionId!, {
      onSuccess: () => {
        toast.success("You're on the list", {
          description: "We'll email you if a slot opens up.",
          position: "top-center",
        });
      },
      onError: (err: unknown) => {
        setJustJoined(false);
        const resp = (err as { response?: { data?: { error?: { code?: string; message?: string } } } })?.response?.data?.error;
        const isGone = resp?.code === "SESSION_STARTED" || resp?.code === "SESSION_CANCELED" || resp?.code === "CLASS_INACTIVE";
        toast.error("Failed to join waitlist", {
          description: isGone ? "This session is no longer available." : resp?.message ?? "Please try again later.",
          position: "top-center",
        });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center gap-4 font-serif text-brand-500">
        <p className="font-semibold">{isError ? "Something went wrong while loading this session." : "Session not found."}</p>
        <p className="text-sm text-brand-500/70">It may have started or is no longer available.</p>
        <Button onClick={() => router.push("/book")}>Back to Book</Button>
      </div>
    );
  }

  const isOnline = session.place === "online";
  const isCreditOnly = !!session.is_credit_only || session.price_idr === 0;
  const allowCredit = !!session.allow_credit && (session.price_credit_amount ?? 0) > 0;
  const isFree = !session.price_idr && !allowCredit && !isCreditOnly;
  const bookedPercent = session.slots_total ? Math.min(100, (session.slots_booked / session.slots_total) * 100) : 0;
  const duration = getDuration(session.time_start, session.time_end);
  const levelBadge = getSessionLevelBadge(session.level);
  const typeBadge = getSessionTypeBadge(session.type);
  const isBookable = session.status?.toLowerCase() !== "canceled" && new Date(session.start_datetime).getTime() > Date.now();
  const isWaitlisted = justJoined || !!waitlist?.data?.is_waitlisted;
  const myBookingStatus = waitlist?.data?.is_booked ? (waitlist.data.booking_status ?? "") : "";

  const onCheckoutSession = () => {
    // Normal sessions start on Pay online; credit-only sessions start on credits.
    onChangePaymentMethod(isCreditOnly && allowCredit ? "credit" : "cash");
    router.push(`/checkout/${sessionId}`);
  };

  return (
    <>
      <div className="flex w-full flex-col gap-6 px-4 pb-8 pt-6 font-serif text-brand-500 min-h-full">
        {/* back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm font-semibold w-fit cursor-pointer hover:opacity-70"
        >
          <ChevronLeft size={18} /> Back
        </button>

        {/* banner — session photo only, no fallback */}
        {session.photo_url ? (
          <div className="relative w-full overflow-hidden rounded-xl border border-brand-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={session.photo_url} alt={session.session_name} className="h-[200px] w-full object-cover" />
          </div>
        ) : null}

        {/* title */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge className={`rounded-full text-xs ${typeBadge.className}`}>{typeBadge.label}</Badge>
            {levelBadge && <Badge className={`rounded-full text-xs ${levelBadge.className}`}>{levelBadge.label}</Badge>}
          </div>
          <h2 className="text-[28px] font-extrabold leading-[110%]">{session.session_name}</h2>
          <p className="text-sm text-brand-500/70">{session.class_name}</p>
        </div>

        {/* Date & Time */}
        <InfoCard title="Date & Time" icon={<CalendarMinus2 size={16} />}>
          <InfoRow
            label="Date"
            value={formatDateHelper(session.start_date, "EEEE, dd MMM yyyy")}
          />
          <InfoRow
            label="Time"
            value={
              <span>
                {session.time_start} - {session.time_end} WIB{duration && <span className="text-brand-500/60"> · {duration}</span>}
              </span>
            }
          />
        </InfoCard>

        {/* Place */}
        <InfoCard title="Location" icon={isOnline ? <Video size={16} /> : <MapPin size={16} />}>
          {isOnline ? (
            <>
              <InfoRow label="Place" value="Online session" />
              {session.meeting_link ? (
                <a
                  href={session.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-brand-100 bg-brand-00 py-2.5 text-sm font-bold hover:border-brand-500"
                >
                  <ExternalLink size={16} /> Open meeting link
                </a>
              ) : (
                <p className="text-xs text-brand-500/60">Meeting link will be shared after booking.</p>
              )}
            </>
          ) : (
            <>
              <InfoRow label="Place" value={session.location_name ?? "Offline"} />
              {session.location_address && <InfoRow label="Address" value={session.location_address} />}
              {session.location_maps_url && (
                <a
                  href={session.location_maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-brand-100 bg-brand-00 py-2.5 text-sm font-bold hover:border-brand-500"
                >
                  <ExternalLink size={16} /> Open in Maps
                </a>
              )}
            </>
          )}
        </InfoCard>

        {/* Instructor */}
        <InfoCard title="Instructor" icon={<Users size={16} />}>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-brand-500 text-gray-50">
              <Users size={18} />
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-bold">{session.instructor_name ?? "To be announced"}</p>
              <p className="text-xs text-brand-500/70">Instructor</p>
            </div>
          </div>
        </InfoCard>

        {/* Availability */}
        <InfoCard title="Availability" icon={<Users size={16} />}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-brand-500/70">
              {session.slots_booked} of {session.slots_total} booked
            </p>
            <Badge
              className={
                session.is_full
                  ? "rounded-full bg-red-500/10 text-red-800 border-red-500/20 text-xs"
                  : "rounded-full border-brand-100 bg-brand-500/10 text-xs"
              }
            >
              {session.is_full ? "Fully booked" : `${session.slots_available} seats left`}
            </Badge>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${bookedPercent}%` }} />
          </div>
        </InfoCard>

        {/* Price */}
        <InfoCard title="Price" icon={<Gem size={16} />}>
          {isFree ? (
            <p className="text-lg font-extrabold">Free</p>
          ) : isCreditOnly ? (
            <>
              {allowCredit && (
                <InfoRow
                  label="Credit"
                  value={
                    <span className="flex items-center justify-end gap-1">
                      <Gem size={15} /> {session.price_credit_amount} Credit
                    </span>
                  }
                />
              )}
              <p className="text-xs text-brand-500/60">Credit only — online payment is not available.</p>
            </>
          ) : (
            <>
              {session.price_idr > 0 && <InfoRow label="Price" value={`Rp ${session.price_idr.toLocaleString("id-ID")}`} />}
              {allowCredit && (
                <InfoRow
                  label="Credit"
                  value={
                    <span className="flex items-center justify-end gap-1">
                      <Gem size={15} /> {session.price_credit_amount} Credit
                    </span>
                  }
                />
              )}
              {allowCredit && session.price_idr > 0 && (
                <p className="text-xs text-brand-500/60">Pay with money or credits — whichever suits you.</p>
              )}
            </>
          )}
        </InfoCard>

        {/* Description */}
        <InfoCard title="Description" icon={<Clock4 size={16} />}>
          <p className="text-sm leading-[150%]">
            {session.session_description ?? "No description available for this session."}
          </p>
        </InfoCard>
      </div>

      <StickyContainerComponent>
        <div className="flex flex-col gap-4 p-4 font-serif text-brand-500">
          {isAuthReady && !isBookable
            ? null
            : !isAuthReady ? (
                <Button className="h-12 w-full" disabled>
                  Loading...
                </Button>
              ) : myBookingStatus === "confirmed" ? (
                <>
                  <Button className="font-extrabold !text-gray-50 h-12 w-full" onClick={() => router.push("/profile/my-sessions")}>
                    {"You're booked"}
                  </Button>
                  <p className="text-xs text-brand-500/60">You already have a booking for this session.</p>
                </>
              ) : myBookingStatus === "pending_payment" ? (
                <>
                  <Button className="font-extrabold !text-gray-50 h-12 w-full" onClick={() => router.push("/profile/my-sessions")}>
                    Complete payment
                  </Button>
                  <p className="text-xs text-brand-500/60">Your payment is pending — finish it before the booking expires.</p>
                </>
              ) : session.is_full ? (
                <>
                  <Button
                    className="font-extrabold !text-gray-50 h-12 w-full"
                    onClick={handleNotify}
                    disabled={isWaitlisted || joinPending}
                  >
                    {isWaitlisted ? "You're on the list" : "Join Waiting List"}
                  </Button>
                  <p className="text-xs text-brand-500/60">{"No slot is held — you'll be emailed if one opens up."}</p>
                </>
              ) : !isAuthenticated ? (
                <Button
                  className="font-extrabold !text-gray-50 h-12 w-full"
                  onClick={() => router.push(`/auth/login?next=${encodeURIComponent(`/book/session/${id as string}`)}`)}
                >
                  Book Session
                </Button>
              ) : (
                <Button className="font-extrabold !text-gray-50 h-12 w-full" onClick={onCheckoutSession}>
                  Book Session
                </Button>
              )}
        </div>
      </StickyContainerComponent>
    </>
  );
};