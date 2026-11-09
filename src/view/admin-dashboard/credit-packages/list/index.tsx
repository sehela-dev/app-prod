"use client";

import { buildNumber, CustomTable } from "@/components/general/custom-table";
import { CustomPagination } from "@/components/general/pagination-component";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

import { SearchInput } from "@/components/ui/search-input";
import { useDebounce } from "@/hooks";
import { useGetCreditPackage } from "@/hooks/api/queries/admin/credit-package";

import { formatCurrency } from "@/lib/helper";
import { formatEligibleTime, formatInstructorNames } from "@/lib/credit-package";
import { ICreditPackageItem } from "@/types/credit-package.interface";
import { IOrderItem } from "@/types/orders.interface";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CirclePlus, Ellipsis } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDeleteCreditPackage, useEditCreditPackage } from "@/hooks/api/mutations/admin";
import { BaseDialogConfirmation } from "@/components/general/dialog-confirnation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetClassSessionsCategory } from "@/hooks/api/queries/admin/class-session";

export const CreditPackagePageView = () => {
  const router = useRouter();
  // const [selecetedTab, setSelectedTab] = useState("week");
  const [limit] = useState(10);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debounceSearch = useDebounce(search, 300);
  const [openDialogConfirm, setOpenDialogConfirm] = useState(false);
  const [selectedData, setSelectedData] = useState("");
  const [openNotif, setOpenNotif] = useState(false);
  const { mutateAsync } = useDeleteCreditPackage();
  const { mutateAsync: mutateVisibility, isPending: isTogglingVisibility } = useEditCreditPackage();
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({
    Class: "all",
    Visibility: "all",
    Status: "all",
    SessionType: "all",
    Place: "all",
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
        label: "Class",
        options: [{ id: "all", label: "All classes" }],
      },
      {
        title: "Visibility",
        label: "Visibility",
        options: [
          { id: "all", label: "All" },
          { id: "true", label: "Visible" },
          { id: "false", label: "Hidden" },
        ],
      },
      {
        title: "Status",
        label: "Status",
        options: [
          { id: "all", label: "All" },
          { id: "true", label: "Active" },
          { id: "false", label: "Inactive" },
        ],
      },
      {
        title: "SessionType",
        label: "Session type",
        options: [
          { id: "all", label: "All" },
          { id: "regular", label: "Regular" },
          { id: "private", label: "Private" },
          { id: "special", label: "Special" },
        ],
      },
      {
        title: "Place",
        label: "Place",
        options: [
          { id: "all", label: "All" },
          { id: "offline", label: "Offline" },
          { id: "online", label: "Online" },
        ],
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
    setPage(1);
  };

  const handleReset = () => {
    setSelectedValues({
      Class: "all",
      Visibility: "all",
      Status: "all",
      SessionType: "all",
      Place: "all",
    });
  };

  const hasActiveFilters = useMemo(() => Object.values(selectedValues).some((v) => v !== "all"), [selectedValues]);

  const { data, isLoading, refetch } = useGetCreditPackage({
    page,
    limit,
    search: debounceSearch,
    ...(selectedValues.Class !== "all" ? { class_id: selectedValues.Class } : {}),
    ...(selectedValues.Visibility !== "all" ? { is_visible: selectedValues.Visibility } : {}),
    ...(selectedValues.Status !== "all" ? { is_active: selectedValues.Status } : {}),
    ...(selectedValues.SessionType !== "all" ? { session_type: selectedValues.SessionType } : {}),
    ...(selectedValues.Place !== "all" ? { place: selectedValues.Place } : {}),
  });

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
      text: "Package Name",
      value: "name",
    },
    {
      id: "description",
      text: "Description",
      value: (row: ICreditPackageItem) => <p className="max-w-[70%] flex-wrap text-wrap">{row?.description}</p>,
    },
    {
      id: "class_ids_restriction",
      text: "Class",
      value: (row: ICreditPackageItem) => (
        <p className="capitalize max-w-[70%] flex-wrap text-wrap">
          {row.class_ids_restriction?.length > 0 ? row?.class_ids_restriction.map((item) => item.name).join(", ") : "All Class"}
        </p>
      ),
    },
    {
      id: "instructor_ids_restriction",
      text: "Instructors",
      value: (row: ICreditPackageItem) => (
        <p className="max-w-[70%] flex-wrap text-wrap">
          {formatInstructorNames(row.instructor_ids_restriction) ?? "Semua instructor"}
        </p>
      ),
    },
    {
      id: "eligible_time_window",
      text: "Time Window",
      value: (row: ICreditPackageItem) => (
        <p className="whitespace-nowrap">
          {formatEligibleTime(row.eligible_start_time, row.eligible_end_time) ?? "Tanpa batas jam"}
        </p>
      ),
    },
    {
      id: "credits",
      text: "Amount",
      value: (row: ICreditPackageItem) => <p>{row.credits} Credits</p>,
    },
    {
      id: "price_idr",
      text: "Regular Price",
      value: (row: ICreditPackageItem) => formatCurrency(row?.price_idr),
    },
    {
      id: "is_shareable",
      text: "Sharing",
      value: (row: ICreditPackageItem) => (row?.is_shareable ? "Yes" : "No"),
    },
    {
      id: "limits",
      text: "Limits",
      value: (row: ICreditPackageItem) => (
        <p>
          {[
            row?.max_purchases_per_user != null ? `${row.max_purchases_per_user}x max` : null,
            row?.only_for_new_users ? "New only" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
      ),
    },
    {
      id: "validity_days",
      text: "Valid for",
      value: (row: ICreditPackageItem) => <p>{row.validity_days} Days</p>,
    },
    {
      id: "status",
      text: "Status",
      value: (row: ICreditPackageItem) => (
        <p className={row?.is_active ? "text-green-400 uppercase" : "text-red-500 uppercasex"}>{row?.is_active ? "Active" : "Inactive"}</p>
      ),
    },
    {
      id: "is_visible",
      text: "Visibility",
      value: (row: ICreditPackageItem) => (
        <p className={row?.is_visible !== false ? "text-green-400 uppercase" : "text-gray-500 uppercase"}>
          {row?.is_visible !== false ? "Visible" : "Hidden"}
        </p>
      ),
    },
  ];
  const onToggleVisibility = async (row: ICreditPackageItem) => {
    try {
      await mutateVisibility({ id: row.id, data: { is_visible: !(row.is_visible !== false) } as never });
      refetch();
    } catch (error) {
      console.log(error);
    }
  };
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
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => router.push(`credit-packages/${row.id}/edit`)}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onToggleVisibility(row as unknown as ICreditPackageItem)}
            disabled={isTogglingVisibility}
          >
            {(row as unknown as ICreditPackageItem)?.is_visible !== false ? "Hide from catalog" : "Show in catalog"}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" className="" onClick={() => onDelete(row.id)}>
            Retire
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
      <div className="flex w-full flex-row justify-end items-center">
        <Button className=" text-sm font-medium" onClick={() => router.push("credit-packages/create")}>
          <CirclePlus /> Add Credit Package
        </Button>
      </div>
      <Card className="rounded-lg border-brand-100">
        <CardHeader className="flex flex-row w-full justify-between items-center">
          <div className="flex flex-col">
            <h3 className="text-brand-999 text-2xl font-semibold">Credit Packages</h3>
            <p className="text-sm text-gray-500 font-normal">Credit package for the customer</p>
          </div>
          <div className="flex flex-row  gap-2">
            <SearchInput className="border-brand-100" search={search} onSearch={handleSearch} />
          </div>
        </CardHeader>
        <div className="flex flex-wrap items-end gap-2 px-6">
          {filterSections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">{section.label}</span>
              <Select value={selectedValues[section.title]} onValueChange={(v) => handleSelectionChange(section.title, v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {section.options.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-destructive hover:bg-destructive/10">
              Reset
            </Button>
          )}
        </div>
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
          title="Retire Credit Package?"
          subtitle="This package will be unlisted and can no longer be purchased (is_active=false). Existing purchases and balances are unaffected."
          onConfirm={onConfirmDelete}
          cancelText="Cancel"
          confirmText="Retire"
        />
      )}
      {openNotif && (
        <BaseDialogConfirmation
          image="trash-success"
          onCancel={() => onDelete("")}
          hideCancel
          open={openNotif}
          title="Credit Package Retired"
          subtitle="The package is unlisted and no longer purchasable. Use the Status filter to review retired items."
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
