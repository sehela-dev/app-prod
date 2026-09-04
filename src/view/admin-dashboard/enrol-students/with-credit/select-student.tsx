"use client";

import { DateRangePicker } from "@/components/base/date-range-picker";
import { CustomPagination } from "@/components/general/pagination-component";
import { GeneralTabComponent } from "@/components/general/tabs-component";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { SearchInput } from "@/components/ui/search-input";
import { useDebounce } from "@/hooks";
import { useGetSessions } from "@/hooks/api/queries/admin/class-session";
import { checkIsinHour, defaultDate, formatDateHelper } from "@/lib/helper";
import { cn } from "@/lib/utils";
import { ISessionItem } from "@/types/class-sessions.interface";
import { Calendar, Clock, Loader2, User, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SelectStudentWithCreditComponent } from "./with-credit/select-student";
import { useAdminManualTransaction } from "@/context/admin/add-transaction.ctx";
import { useBookingSession } from "@/hooks/api/mutations/admin";
import { OrderCustomerSectionComponent } from "@/components/page/orders";
import { useAdminPermission } from "@/hooks/use-role-access";
import { Badge } from "@/components/ui/badge";

const enrollmentType = [
  {
    name: "With Credit",
    value: "credit",
  },
  {
    name: "3rd Party",
    value: "3rd",
  },
];
export const EnrollStudentView = () => {
  const { isManager } = useAdminPermission();
  const { customerData, sessionData, onSelectSession: selectSession, addCustomer } = useAdminManualTransaction();
  const targetDivRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = () => {
    if (targetDivRef.current) {
      targetDivRef.current.scrollIntoView({
        behavior: "smooth", // Optional: adds smooth scrolling animation
        block: "center", // Optional: aligns the top of the element to the top of the viewport
      });
    }
  };

  const [tabs, setTabs] = useState("credit");
  const [selectedSession, setSelectedSession] = useState<ISessionItem | null>(sessionData as ISessionItem | null);
  const [limit] = useState(6);
  const [page, setPage] = useState(1);
  const { mutateAsync, isPending } = useBookingSession();

  const [search, setSearch] = useState("");
  const debounceClass = useDebounce(search, 300);

  const handleSearch = (query: string) => {
    setSearch(query);
    setPage(1);
  };

  const [selectedRange, setSelectedRange] = useState<string | null>(isManager ? null : defaultDate().formattedToday);

  const { data, isLoading, refetch } = useGetSessions({
    page,
    limit,
    // startDate: selectedRange.from as string,
    // endDate: selectedRange.to as string,
    search: debounceClass,
    date: selectedRange as string,
    // status: "scheduled",
  });

  const handleDateRangeChangeDual = (startDate?: string) => {
    setSelectedRange(startDate as string);
    refetch();
  };
  const onSelectSession = (data: ISessionItem) => {
    setSelectedSession((prev) => (prev?.id === data.id ? null : data));
    selectSession(data);
  };

  const canSelectSession = (item: ISessionItem) => {
    if (item.status === "cancelled" || item.status === "canceled") return false;
    if (isManager) return true;
    if (item.status === "scheduled" || item.status === "ongoing") return true;
    if (item.status === "ended") return checkIsinHour(item.end_datetime);
    return false;
  };

  useEffect(() => {
    if (sessionData) {
      handleScroll();
    }
  }, [sessionData]);

  const handleBookingSession = async () => {
    try {
      const payload = {
        class_session_id: sessionData?.id as string,
        ...(tabs === "credit"
          ? { user_id: customerData?.id as string, payment_method: "credits", package_purchase_id: customerData?.package?.package_purchase_id }
          : {
            third_party_id: customerData?.third_party?.id,
            booking_id: customerData?.booking_id,
            ...(customerData?.id ? { user_id: customerData?.id as string } : null),
            customer_name: customerData?.name,
            customer_phone: customerData?.phone,
            customer_email: customerData?.email,
            branch: customerData?.branch,
          }),
        status: "paid",

        // ...(customerData?.package?.package_purchase_id ? {})
      };
      // console.log(payload);

      const res = await mutateAsync(payload);
      if (res) {
        clearForm();
        refetch();
      }
    } catch (error) {
      console.log(error);
    }
  };

  const clearForm = () => {
    selectSession(null);
    addCustomer();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-fit">
        <GeneralTabComponent
          tabs={enrollmentType}
          setTab={(e) => {
            setTabs(e);
            setSelectedSession(null);
            selectSession(null);
          }}
          selecetedTab={tabs}
        />
      </div>
      <div className="grid grid-cols-12 gap-2 w-full pt-4">
        <div className="flex flex-col gap-4 w-full col-span-8 ">
          <Card>
            <CardHeader className="">
              <div className="flex flex-col gap-4">
                <p className="text-2xl font font-semibold">Session List</p>
                <div className="flex flex-col gap-2">
                  <SearchInput className="border-brand-100" search={search} onSearch={handleSearch} />
                  <div className="flex flex-row items-center gap-4">
                    <div className="w-full flex flex-col gap-1">
                      <DateRangePicker
                        mode="single"
                        startDate={selectedRange as string}
                        endDate={selectedRange as string}
                        onDateRangeChange={(e) => handleDateRangeChangeDual(e)}
                        allowFutureDates
                        allowPastDates={isManager}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="w-full flex-col gap-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (data?.data?.length as number) > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {data?.data?.map((item) => (
                      <CardSession
                        key={item.id}
                        date={formatDateHelper(item.start_datetime, "dd/MM/yyyy")}
                        instructor={item.instructor_name}
                        time={`${item.time_start} - ${item.time_end}`}
                        slot={item.slots_display}
                        title={`[${item?.class?.class_name}] - ${item.session_name}`}
                        onSelect={canSelectSession(item) ? () => onSelectSession(item) : undefined}
                        isSelected={item.id === sessionData?.id}
                        status={item.location}
                        disabled={!canSelectSession(item)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="italic flex flex-row items-center justify-center w-full">No Data Found</div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <CustomPagination
                onPageChange={(e) => {
                  setPage(e);
                }}
                currentPage={page}
                showTotal
                hasPrevPage={data?.pagination?.has_prev}
                hasNextPage={data?.pagination?.has_next}
                totalItems={data?.pagination?.total_items as number}
                totalPages={data?.pagination?.total_pages as number}
                limit={limit}
              />
            </CardFooter>
          </Card>
          <div ref={targetDivRef}>
            {sessionData && tabs === "credit" && <SelectStudentWithCreditComponent selectedSession={sessionData} />}
            {sessionData && tabs === "3rd" && (
              <>
                <OrderCustomerSectionComponent enroll />
              </>
            )}
          </div>
        </div>
        <div className="col-span-4">
          <Card>
            <CardHeader className="text-xl font-semibold">Summary</CardHeader>
            <CardContent>
              {sessionData ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-gray-500">Session name</p>
                    <p className="text-mdnpx shadcn@latest add progress font-semibold">
                      [{sessionData?.class?.class_name}] - {sessionData.session_name}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="text-md font-semibold">{formatDateHelper(sessionData?.start_datetime, "eeee, dd/MM/yyyy")}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-gray-500">Instructor</p>
                    <p className="text-md font-semibold">{sessionData?.instructor_name}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-gray-500">Time</p>
                    <p className="text-md font-semibold">
                      {sessionData?.time_start} - {sessionData.time_end}
                    </p>
                  </div>
                  <Divider />
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-gray-500">Capacity Status</p>
                    <div className="flex w-full flex-col gap-1">
                      <div className="flex justify-between text-sm mb-1 items-center pt-2">
                        <span className="text-muted-foreground ">Enrolled</span>
                        <span className="font-semibold">
                          {sessionData.slots_booked}/{sessionData.slots_total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${sessionData.slots_booked >= sessionData.slots_total ? "bg-red-500" : "bg-green-500"}`}
                          style={{
                            width: `${(sessionData.slots_booked / sessionData.slots_total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className={`font-semibold ${sessionData.slots_available === 0 ? "text-red-600" : "text-green-600"}`}>
                        {sessionData.slots_available} spots available
                      </span>
                    </div>
                  </div>
                  <Divider className="my-2" />
                  {(customerData?.name || customerData?.package) && (
                    <div className="flex flex-col gap-4">
                      <p className="text-sm text-gray-500">Student Details</p>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm text-gray-500">Student</p>
                        <p className="text-mdnpx shadcn@latest add progress font-semibold">{customerData?.name}</p>
                      </div>
                      {tabs === "credit" ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-sm text-gray-500">Credit</p>
                          <p className="text-mdnpx shadcn@latest add progress font-semibold">{customerData?.package?.package_name}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-col gap-1">
                            <p className="text-sm text-gray-500">Third Party App</p>
                            <p className="text-mdnpx shadcn@latest add progress font-semibold">{customerData?.third_party?.name}</p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-sm text-gray-500">Booking ID</p>
                            <p className="text-mdnpx shadcn@latest add progress font-semibold">{customerData?.booking_id}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-row items-center w-full gap-4">
                    <div className="flex w-full">
                      <Button className="w-full" variant={"secondary"} onClick={clearForm}>
                        Clear
                      </Button>
                    </div>
                    <div className="flex w-full">
                      <Button className="w-full" disabled={isPending} onClick={handleBookingSession}>
                        Proceed
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 text-sm">Select a session to see details and enroll</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

interface IProps {
  date: string;
  time: string;
  slot: string;
  instructor: string;
  title: string;
  isSelected?: boolean;
  status?: string;
  onSelect?: () => void;
  disabled?: boolean;
}
export const CardSession = (props: IProps) => {
  const isCancelled = props.status === "cancelled" || props.status === "canceled";
  const isDisabled = Boolean(props.disabled);

  return (
    <Card
      className={cn("gap-1 border-2 hover:bg-brand-100 hover:border-brand-500 cursor-pointer", {
        " bg-brand-100 border-brand-500": props.isSelected,
        "cursor-not-allowed bg-gray-200 hover:bg-gray-200 hover:border-gray-200 opacity-45 pointer-events-none": isDisabled,
      })}
      onClick={isDisabled ? undefined : props.onSelect}
    >
      <CardHeader className="font-semibold">
        <div className="flex flex-col gap-2">
          <div className="">
            <Badge className="capitalize text-xs" variant={props?.status === "ended" || isCancelled ? "destructive" : "default"}>
              {props?.status}
            </Badge>
          </div>
          <p>{props.title}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col">
          <div className="flex flex-row items-center gap-1">
            <Calendar size={12} color="var(--color-gray-600)" /> <p className="text-sm text-gray-600">{props.date}</p>
          </div>
          <div className="flex flex-row items-center gap-1">
            <Clock size={12} color="var(--color-gray-600)" /> <p className="text-sm text-gray-600">{props.time}</p>
          </div>
          <div className="flex flex-row items-center gap-1">
            <User size={12} color="var(--color-gray-600)" /> <p className="text-sm text-gray-600">{props.instructor}</p>
          </div>
          <div className="flex flex-row items-center gap-1">
            <Users size={12} color="var(--color-gray-600)" /> <p className="text-sm text-gray-600">{props.slot}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
