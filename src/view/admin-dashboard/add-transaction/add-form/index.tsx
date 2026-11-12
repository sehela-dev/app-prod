import { buildNumber, CustomTable } from "@/components/general/custom-table";
import { GeneralTabComponent } from "@/components/general/tabs-component";

import { CreditPackageTabComponent, OrderCustomerSectionComponent } from "@/components/page/orders";
import { Button } from "@/components/ui/button";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

import { SearchInput } from "@/components/ui/search-input";
import { useAdminManualTransaction } from "@/context/admin/add-transaction.ctx";
import { defaultDate, formatCurrency, formatDateHelper } from "@/lib/helper";
import { cn } from "@/lib/utils";

import { ListFilter } from "lucide-react";
import { useState } from "react";
import { OrdersCartComponent } from "../order-card";
import { useGetSessions } from "@/hooks/api/queries/admin/class-session";
import { ISessionItem } from "@/types/class-sessions.interface";
import { CustomPagination } from "@/components/general/pagination-component";
import { DateRangePicker } from "@/components/base/date-range-picker";
import { useDebounce } from "@/hooks";
import { useAdminPermission } from "@/hooks/use-role-access";
import { ProductSectionTabComponent } from "@/components/page/orders/product-section";
import { RentProductSectionTabComponent } from "@/components/page/orders/rent-product-section";

const tableTabOption = [
  {
    value: "class",
    name: "Class",
  },
  {
    value: "credit_package",
    name: "Credit Package",
  },
  {
    value: "buy_product",
    name: "Buy Product",
  },
  {
    value: "rent_product",
    name: "Rent Product",
  },
];

export const AddTransactionFOrm = () => {
  const { isManager } = useAdminPermission();
  const { cartItems, addItem, removeItem, updateQuantity, customerData } = useAdminManualTransaction();

  const [tableTab, setTableTab] = useState("class");
  const [limit] = useState(10);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debounceClass = useDebounce(search, 300);

  const [selectedRange, setSelectedRange] = useState<string | null>(defaultDate().formattedToday ?? null)
  const handleSearch = (query: string) => {
    setSearch(query);
    setPage(1);
  };

  const { data, isLoading, refetch } = useGetSessions({
    page,
    limit,

    search: debounceClass,
    is_credit_only: false,
    date: selectedRange as string,
    // status: "scheduled",
  });
  const handleDateRangeChangeDual = (startDate?: string) => {
    setSelectedRange(startDate as string);
    refetch();
  };

  // alwasy match/check cart data and table data for quantity
  const headers = [
    {
      id: "class",
      text: "Class",
      value: (row: ISessionItem) => row.class.class_name,
    },
    {
      id: "session_name",
      text: "Session",
      value: "session_name",
    },
    {
      id: "instructor_name",
      text: "Instructor",
      value: "instructor_name",
    },
    {
      id: "time",
      text: "Time",
      value: (row: ISessionItem) => `${row.time_start} - ${row.time_end}`
    },
    {
      id: "date",
      text: "Date",
      value: (row: ISessionItem) => formatDateHelper(row.start_date, "dd/MM/yyyy"),
    },

    {
      id: "slot",
      text: "Slot",
      value: (row: ISessionItem) => {
        const isFull = row.slots_booked === row.slots_total;

        return (
          <p
            className={cn("text-brand-999 font-semibold text-xs", {
              "text-red-500": isFull,
            })}
          >
            {row.slots_booked}/{row.slots_total}
          </p>
        );
      },
    },
    {
      id: "price",
      text: "Price",
      value: (row: ISessionItem) => formatCurrency(row.price_idr),
    },
    {
      id: "status",
      text: "Status",
      value: (row: ISessionItem) => (
        <p
          className={cn("capitalize font-semibold", {
            "text-green-500": row.status === "ongoing",
            "text-blue-500": row.status === "scheduled",
            "text-red-500": row.status === "ended",
            "text-yellow-500": row.status === "canceled",
          })}
        >
          {row.status}
        </p>
      ),
    },
  ];

  const numberOptions = {
    text: "No",
    show: false,
    render: (_: unknown, idx: number) => buildNumber(idx, limit, page),
  };

  const actionOptions = {
    text: "Qty",
    show: true,
    render: (row: ISessionItem) => {
      const qty = cartItems?.find((item) => item.id === row.id)?.quantity;

      //count should taken from cartctx

      // update cart context state
      // cartdata is always empty from the start
      const onModifyQty = (id: number | string, type: "+" | "-") => {
        const item = cartItems?.find((item) => item.id === id);
        const currentQty = item?.quantity || 0;
        const newQty = type === "+" ? currentQty + 1 : currentQty - 1;

        const availableSlots = row.slots_total - row.slots_booked;
        if (type === "+" && newQty > availableSlots) {
          return;
        }

        if (newQty < 0) return;

        if (newQty === 0) {
          removeItem(id);
        } else if (item) {
          updateQuantity(id, newQty);
        } else {
          addItem({
            id: row.id,
            name: row.class.class_name,
            description: row.session_name,
            price: row.price_idr,
            quantity: 1,
            type: tableTab,
            session_type: row.type,
            ...(row.branch ? { branch: row.branch } : null),
          });
        }
      };
      // const onModifyQty = (index: number, type: "+" | "-") => {
      //   //  1 customer 1 session id
      //   // check if there any index on cart ctx -- update
      //   // if count === 0 dont add to cartctx
      //   // if count > 0 add to cartctx
      //   //else there is none add new

      //   setCartData((prev) =>
      //     prev.map((item) => {
      //       if (item.id !== index) return item;

      //       const newQty = type === "+" ? item.quantity + 1 : item.quantity - 1;
      //       if (newQty < 1) return item;

      //       return { ...item, quantity: newQty };
      //     }),
      //   );
      // };

      return (
        <div className="text-brand-999 font-medium text-sm text-center col-span-1">
          {" "}
          <div className="flex flex-row gap-2 items-center justify-center">
            <Button variant={"outline"} className="bg-transparent w-8 h-8" onClick={() => onModifyQty(row.id, "-")}>
              -
            </Button>
            <div className="w-8 h-8 flex items-center justify-center bg-brand-100 rounded-md">{qty ?? 0}</div>

            <Button variant={"outline"} className="bg-transparent w-8 h-8" onClick={() => onModifyQty(row.id, "+")}>
              +
            </Button>
          </div>
        </div>
      );
    },
  };
  return (
    <div className="grid grid-cols-3 gap-2 w-full pt-4">
      <div className="flex flex-col gap-4 col-span-2">
        <div className="flex w-full">
          <OrderCustomerSectionComponent />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-row justify-between w-full">
            <div className="max-w-fit w-auto">
              <GeneralTabComponent tabs={tableTabOption} selecetedTab={tableTab} setTab={setTableTab} />
            </div>
            <Button variant={"outline"} className="text-brand-999 text-sm font-medium">
              <ListFilter /> Filter
            </Button>
          </div>
          {tableTab === "class" && (
            <Card className="border-brand-100 w-full">
              <CardHeader className="flex flex-row justify-between w-ful items-center">
                <div className="flex flex-col gap-1">
                  <h3 className="text-2xl text-brand-999 font-medium">Classes</h3>
                  <p className="text-sm text-gray-500">Enter customer information to book a class</p>
                </div>
                <div className="flex flex-row gap-2">
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
                  <div className="flex w-full">
                    <SearchInput className="border-brand-100" search={search} onSearch={handleSearch} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="">
                <CustomTable
                  headers={headers}
                  data={data?.data ?? []}
                  numberOptions={numberOptions}
                  actionOptions={actionOptions}
                  isLoading={isLoading}
                />
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
          )}
          {tableTab === "credit_package" && <CreditPackageTabComponent />}
          {tableTab === "buy_product" && <ProductSectionTabComponent />}
          {tableTab === "rent_product" && <RentProductSectionTabComponent />}
        </div>
      </div>
      <OrdersCartComponent customerData={customerData} cartItems={cartItems} />
    </div>
  );
};
