"use client";

import { buildNumber, CustomTable } from "@/components/general/custom-table";
import { CustomPagination } from "@/components/general/pagination-component";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

import { SearchInput } from "@/components/ui/search-input";
import { useDebounce } from "@/hooks";

import { formatCurrency, formatDateHelper } from "@/lib/helper";

import { IOrderItem } from "@/types/orders.interface";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CirclePlus, Ellipsis } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BaseDialogConfirmation } from "@/components/general/dialog-confirnation";
import { DropdownFilter } from "@/components/general/table-filter";
import { useGetClassSessionsCategory } from "@/hooks/api/queries/admin/class-session";
import { useGetDiscountVouchers } from "@/hooks/api/queries/admin/discount-voucher/use-get-discount-vouchers";
import { IVouchersListItem } from "@/types/discount-voucher.interface";
import { useDeleteDiscountVoucher } from "@/hooks/api/mutations/admin/use-delete-discount-voucher";
import { formatSessionTypes } from "@/lib/voucher";

export const DiscountVoucherListPageView = () => {
  const router = useRouter();
  // const [selecetedTab, setSelectedTab] = useState("week");
  const [limit] = useState(10);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debounceSearch = useDebounce(search, 300);
  const [openDialogConfirm, setOpenDialogConfirm] = useState(false);
  const [selectedData, setSelectedData] = useState("");
  const [openNotif, setOpenNotif] = useState(false);
  const { mutateAsync } = useDeleteDiscountVoucher();
  const [selectedValues, setSelectedValues] = useState({
    Class: "all",
  });
  const { data: dataClass, isLoading: isLoadingClass } = useGetClassSessionsCategory({ page: 1, limit: 999, status: "true" });

  const onDelete = (id: string) => {
    setOpenDialogConfirm(!openDialogConfirm);
    setSelectedData(id);
  };

  const filterSections = useMemo(() => {
    const filter = [
      {
        title: "Class",
        options: [{ id: "all", label: "All" }],
      },
    ];

    if (!dataClass?.data) return filter;
    else {
      dataClass?.data.forEach((item) => {
        filter[0].options.push({
          id: item.id,
          label: item.class_name,
        });
      });
    }
    return filter;
  }, [dataClass?.data]);

  const handleSelectionChange = (section: string, optionId: string) => {
    setSelectedValues((prev) => ({
      ...prev,
      [section]: optionId,
    }));
  };

  const handleReset = () => {
    setSelectedValues({
      Class: "all",
    });
  };

  const { data, isLoading, refetch } = useGetDiscountVouchers({ page, limit, search: debounceSearch });

  const numberOptions = {
    text: "No",
    show: false,
    render: (_: unknown, idx: number) => buildNumber(idx, limit, page),
  };

  const handleSearch = (query: string) => {
    setSearch(query);
    setPage(1);
  };

  const headers = [
    {
      id: "name",
      text: "Discount Name",
      value: "name",
    },
    {
      id: "discount_type",
      text: "Type",
      value: (row: IVouchersListItem) => <p className="uppercase">{row.discount_type}</p>,
    },
    {
      id: "code",
      text: "Discount Code",
      value: "code",
    },
    {
      id: "category",
      text: "Discount Category",
      value: (row: IVouchersListItem) => <p className="capitalize">{row?.categories.length === 3 ? "Universal" : row.categories?.join(", ")}</p>,
    },
    {
      id: "session_types",
      text: "Session Types",
      value: (row: IVouchersListItem) => <p>{formatSessionTypes(row.session_types)}</p>,
    },
    {
      id: "usage",
      text: "Usage",
      value: (row: IVouchersListItem) => (
        <p>
          {row.usage_count}/{row.usage_limit}
        </p>
      ),
    },
    {
      id: "valid_until",
      text: "End Date",
      value: (row: IVouchersListItem) => formatDateHelper(row?.valid_until, "dd/MM/yyyy"),
    },
    {
      id: "discount_value",
      text: "Discount Value",
      value: (row: IVouchersListItem) => <p>{row?.discount_type === "fixed" ? formatCurrency(row.discount_value) : `${row.discount_value}%`}</p>,
    },
    {
      id: "is_active",
      text: "Status",
      value: (row: IVouchersListItem) => (
        <p className={row?.is_active ? "text-green-400 uppercase" : "text-red-500 uppercase"}>{row?.is_active ? "Active" : "Inactive"}</p>
      ),
    },
  ];
  const actionOptions = {
    text: "Action",
    show: true,
    render: (row: IOrderItem) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="data-[state=open]:bg-muted text-muted-foreground flex size-8" size="icon">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem onClick={() => router.push(`discount-voucher/${row.id}/edit`)}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" className="" onClick={() => onDelete(row.id)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };

  const onConfirmDelete = async () => {
    try {
      const res = await mutateAsync(selectedData);
      if (res) {
        setOpenNotif(true);
        onDelete("");
      }
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <div className="flex flex-col w-full h-full gap-2">
      <div className="flex  w-full flex-row justify-between items-center">
        <div>{/* <GeneralTabComponent tabs={tabOptions} selecetedTab={selecetedTab} setTab={setSelectedTab} /> */}</div>
        <div className="flex flex-row items-center gap-2">
          <div className="flex w-full">
            <DropdownFilter
              sections={filterSections}
              selectedValues={selectedValues}
              onSelectionChange={handleSelectionChange}
              onReset={handleReset}
            />
          </div>

          <div className="flex w-full">
            <Button className=" text-sm font-medium" onClick={() => router.push("discount-voucher/create")}>
              <CirclePlus /> Add Discount Voucher
            </Button>
          </div>
        </div>
      </div>
      <Card className="rounded-lg border-brand-100">
        <CardHeader className="flex flex-row w-full justify-between items-center">
          <div className="flex flex-col">
            <h3 className="text-brand-999 text-2xl font-semibold">Discounts</h3>
            <p className="text-sm text-gray-500 font-normal">Discounts for your credit packages/product/sessiom</p>
          </div>
          <div className="flex flex-row  gap-2">
            <SearchInput className="border-brand-100" search={search} onSearch={handleSearch} />
          </div>
        </CardHeader>
        <CardContent>
          <CustomTable
            data={data?.data ?? []}
            headers={headers}
            numberOptions={numberOptions}
            isLoading={isLoading || isLoadingClass}
            // setSelectedData={setSelectedData}
            // selectedData={selectedData}

            actionOptions={actionOptions}
          />
        </CardContent>
        <CardFooter className="flex w-full">
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
      {openDialogConfirm && (
        <BaseDialogConfirmation
          image="trash-1"
          onCancel={() => onDelete("")}
          open={openDialogConfirm}
          title="Delete Discount Voucher?"
          subtitle="This discount voucher will be permanently deleted from the system and cannot be restored."
          onConfirm={onConfirmDelete}
          cancelText="Cancel"
          confirmText="Delete"
        />
      )}
      {openNotif && (
        <BaseDialogConfirmation
          image="trash-success"
          onCancel={() => onDelete("")}
          hideCancel
          open={openNotif}
          title="Discount Voucher Deleted Successfully"
          subtitle="Your Discount Voucher has been successfully removed from the system."
          onConfirm={() => {
            setOpenNotif(false);
            refetch();
          }}
          cancelText="Cancel"
          confirmText="Ok"
        />
      )}
    </div>
  );
};
