/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { CustomTable } from "@/components/general/custom-table";
import { CustomPagination } from "@/components/general/pagination-component";
import { CardRevenueComponent } from "@/components/page/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Divider } from "@/components/ui/divider";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGetDashboardOverview, useGetDashboardProductPerformance } from "@/hooks/api/queries/admin/dashboard";
import { useGetDashboardSessionPerformance } from "@/hooks/api/queries/admin/dashboard/use-get-dashboard-session-performance";
import { useGetDashboardNearlyExpired } from "@/hooks/api/queries/admin/dashboard/use-get-nearly-expired";
import { useAdminPermission } from "@/hooks/use-role-access";

import { formatCurrency, formatDateHelper, splitArray } from "@/lib/helper";
import { cn } from "@/lib/utils";
import { INearlyExpiredCreditPackage, IOverallResultByClass } from "@/types/dashboard.interface";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, CircleDollarSign, File, Loader2, Package, Users, WalletCards } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";

const filterOption = [
  {
    name: "Today",
    value: "last_1_day",
  },
  {
    name: "7D",
    value: "last_7_days",
  },
  {
    name: "1M",
    value: "last_1_months",
  },
  {
    name: "6M",
    value: "last_6_months",
  },
  {
    name: "All",
    value: "all",
  },
];

export const DashboardPage = () => {
  const router = useRouter();
  const { data: dashboardOverView, isLoading: isLoadingOverview, isError: isErrorOverview } = useGetDashboardOverview();
  const { data: dashboardOverViewPerformance, isLoading: isLoadingOverviewPerformance } = useGetDashboardSessionPerformance();
  const { data: dashboardOverViewProduct, isLoading: isLoadingOverviewProduct } = useGetDashboardProductPerformance();
  const [selectedFilter, setSelectedFilter] = useState("last_1_day");
  const [selectedFilterProduct, setSelectedFilterProduct] = useState("last_1_day");
  const [performacePagination, setPerformancePagination] = useState(0);
  const [productPagination, setProductPagination] = useState(0);
  const [page, setPage] = useState(1);

  const {
    data: nearlyExpired,
    isLoading: isLoadingNearlyExpired,
    refetch: refetchNearlyExpired,
  } = useGetDashboardNearlyExpired({ within_days: 7, page: page, limit: 10 });

  console.log(nearlyExpired);

  const classList = useMemo(() => {
    const temp: string[] = [];
    dashboardOverViewPerformance?.data?.by_class?.forEach((element) => {
      temp.push(element?.class_name as string);
    });
    const moreClass = temp.length - 3;

    return { temp, moreClass };
  }, [dashboardOverViewPerformance?.data?.by_class]);

  const d = useMemo(() => {
    const data = splitArray(dashboardOverViewPerformance?.data?.by_class, 3);
    return {
      data,
      total: data.length,
    };
  }, [dashboardOverViewPerformance?.data?.by_class]);

  const categoryList = useMemo(() => {
    const temp: string[] = [];
    dashboardOverViewProduct?.data?.by_category?.forEach((element) => {
      temp.push(element?.category_name as string);
    });
    const moreClass = temp.length - 3;

    return { temp, moreClass };
  }, [dashboardOverViewProduct?.data?.by_category]);

  const c = useMemo(() => {
    const data = splitArray(dashboardOverViewProduct?.data?.by_category, 3);
    return {
      data,
      total: data.length,
    };
  }, [dashboardOverViewProduct?.data?.by_category]);

  const handlePaginationClass = (type: string) => {
    if (type === "-") {
      if (performacePagination === 0) {
        setPerformancePagination(d.total - 1);
      } else {
        setPerformancePagination((prev) => prev - 1);
      }
    } else {
      if (performacePagination === d.total - 1) {
        setPerformancePagination(0);
      } else {
        setPerformancePagination((prev) => prev + 1);
      }
    }
  };
  const handlePaginationProduct = (type: string) => {
    if (type === "-") {
      if (productPagination === 0) {
        setProductPagination(d.total - 1);
      } else {
        setProductPagination((prev) => prev - 1);
      }
    } else {
      if (productPagination === d.total - 1) {
        setProductPagination(0);
      } else {
        setProductPagination((prev) => prev + 1);
      }
    }
  };

  const birthdaysToday = dashboardOverView?.data?.birthdays_today ?? [];

  const headers = [
    {
      id: "student_name",
      text: "Name",
      value: "student_name",
    },
    {
      id: "package_name",
      text: "Package Name",
      value: "package_name",
    },

    {
      id: "credits_total",
      text: "Total Credit",
      value: "credits_total",
    },
    {
      id: "credits_used",
      text: "Total Credit Used",
      value: "credits_used",
    },
    {
      id: "credits_remaining",
      text: "Total Credit Remaining",
      value: "credits_remaining",
    },
    {
      id: "outstanding_value_idr",
      text: "Total Outstanding (IDR)",
      value: (row: INearlyExpiredCreditPackage) => formatCurrency(row?.outstanding_value_idr ?? 0),
    },
    {
      id: "days_until_expiry",
      text: "Days until Expiry",
      value: "days_until_expiry",
    },

    {
      id: "expired_at",
      text: "Expired at",
      value: (row: INearlyExpiredCreditPackage) => (row?.expires_at ? formatDateHelper(row.expires_at as string, "EEEE, dd MMM yyyy") : "-"),
    },
  ];

  if (isLoadingOverview || isLoadingOverviewPerformance)
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row w-full justify-between">
          <div className="flex flex-row items-center justify-between w-full">
            <div className="flex flex-col">
              <h3 className="text-2xl font-semibold">Overview</h3>
              <p className="text-gray-400 text-sm">A quick summary of your business performance in one view.</p>
            </div>
            <div className="justify-end">
              <Button className="" variant={"outline"}>
                <File /> Export
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-flex-row items-center justify-between gap-8">
          <CardRevenueComponent
            icon={
              <CircleDollarSign
                style={{
                  color: "var(--color-gray-400)",
                }}
                size={18}
              />
            }
            title="Total Revenue"
            amount={formatCurrency(dashboardOverView?.data?.revenue?.all_time_total_idr)}
            // percentage={20}
          />
          <CardRevenueComponent
            icon={
              <Package
                style={{
                  color: "var(--color-gray-400)",
                }}
                size={18}
              />
            }
            title="Total Product Orders"
            amount={String(dashboardOverView?.data?.orders?.all_time_total)}
            // percentage={-30}
          />
          <CardRevenueComponent
            icon={
              <Users
                style={{
                  color: "var(--color-gray-400)",
                }}
                size={18}
              />
            }
            title="Total Customers"
            amount={String(dashboardOverView?.data?.members?.all_time_total)}

            // percentage={10}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col">
          <h3 className="text-2xl font-semibold">Birthdays Today</h3>
          <p className="text-gray-500 text-sm">Active students celebrating a birthday today, in WIB.</p>
        </div>
        <Card>
          <CardContent>
            {isErrorOverview ? (
              <p className="text-sm text-red-600">Could not load birthdays. Refresh the page to try again.</p>
            ) : birthdaysToday.length === 0 ? (
              <p className="text-sm text-gray-500">No student birthdays today.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Birth date</TableHead>
                    <TableHead className="text-right">Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {birthdaysToday.map((student) => (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/admin/member/${student.id}`)}
                    >
                      <TableCell className="whitespace-normal">
                        <Link
                          href={`/admin/member/${student.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {student.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatDateHelper(student.date_of_birth, "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right text-gray-500">{student.age}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col">
          <h3 className="text-2xl font-semibold">Class Sales Perfomance</h3>
          <p className="text-gray-400 text-sm">Monitor the performance of Yoga, Ballet, and Pilates classes by bookings and revenue.</p>
        </div>
        {/* session */}
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between w-full">
              <h4 className="text-[20px] font-semibold">Class Overall Results</h4>
              <div className="flex flex-row items-center gap-2">
                {filterOption?.map((f) => (
                  <div key={f.value}>
                    <Button
                      variant={selectedFilter === f.value ? "default" : "ghost"}
                      onClick={() => {
                        setSelectedFilter(f.value);
                        setPerformancePagination(0);
                      }}
                    >
                      {f.name}
                    </Button>
                  </div>
                ))}
              </div>
            </CardHeader>
            <CardContent className="flex flex-row items-start justify-between">
              <div className="flex flex-col gap-4 w-[75%]">
                <div className="flex flex-col gap-1">
                  <p className="text-gray-500 ">Class Revenue</p>
                  <div className="flex flex-row items-center gap-4">
                    <p className="text-[36px] font-medium">{formatCurrency(dashboardOverViewPerformance?.data?.summary?.all_time_total_idr)}</p>
                    {/* <div className="flex flex-row items-center gap-1">
                      <ArrowUpRight size={18} color={true ? "var(--color-green-400)" : "var(--color-red-500)"} />
                      <p
                        className={cn("text-sm", {
                          "text-green-400": true,
                          "text-red-500": false,
                        })}
                      >
                        20%
                      </p>
                    </div> */}
                  </div>
                  <div className="text-gray-500 text-wrap  flex-wrap max-w-[75%] ">
                    <p className="w-full ">{classList?.temp.slice(0, 3)?.join(", ")},</p>
                    <span>and {classList.moreClass} other class</span>
                  </div>

                  {/* <p className="text-gray-500 capitalize text-wrap flex-wrap max-w-[75%] ">{classList?.join(", ")}</p> */}
                </div>
              </div>
              <div className="min-h-[250px] h-[250px]">
                <Separator
                  orientation="vertical"
                  style={{
                    margin: "0 24px 0 0",
                  }}
                />
              </div>

              <div className="flex flex-col gap-2 w-full justify-between min-h-[250px]">
                <div className="flex flex-col gap-2 w-full h-full">
                  {d.data[performacePagination]?.map((item: IOverallResultByClass) => (
                    <Fragment key={item.class_id}>
                      <div className="flex flex-row items-center justify-between w-full">
                        <div className="flex flex-col w-full">
                          <p className="text-sm font-medium">{item?.class_name}</p>

                          <p className="text-xs text-gray-500">Last Month</p>
                        </div>
                        <div className="flex flex-row items-center w-full gap-4">
                          {/* <div>..</div> */}
                          <div className="flex flex-col gap-1 w-full justify-end text-right">
                            <p className="font-medium">
                              {formatCurrency(
                                selectedFilter === "all" ? item.all_time_total_idr : (item.trends as any)[selectedFilter]?.revenue_idr ?? 0,
                              )}
                            </p>
                            <div className="flex flex-row items-center justify-end text-right">
                              <div>
                                {(item.trends as any)[selectedFilter]?.percentage_change > 0 ? (
                                  <ArrowUpRight color="var(--color-green-500)" size={18} />
                                ) : (
                                  <ArrowDownRight color="var(--color-red-500)" size={18} />
                                )}
                              </div>
                              <p
                                className={cn("text-sm font-medium text-red-500", {
                                  "text-green-400": (item.trends as any)[selectedFilter]?.percentage_change >= 1,
                                  "text-red-500": (item.trends as any)[selectedFilter]?.percentage_change <= 0,
                                })}
                              >
                                {(item.trends as any)[selectedFilter]?.percentage_change ?? 0}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Divider className="w-full" />
                    </Fragment>
                  ))}
                </div>
                <div className="flex flex-row justify-center items-center gap-2">
                  <div>
                    <Button variant={"outline"} size={"icon"} onClick={() => handlePaginationClass("-")}>
                      <ChevronLeft />
                    </Button>
                  </div>
                  <div>
                    <Button variant={"outline"} size={"icon"} onClick={() => handlePaginationClass("+")}>
                      <ChevronRight />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4 pt-8">
          <div className="flex flex-col">
            <h3 className="text-2xl font-semibold">Nearly Expired Credits</h3>
            <p className="text-gray-400 text-sm">Track customers credits that are expiring soon.</p>
          </div>

          <div className="flex flex-flex-row items-center justify-between gap-8">
            <CardRevenueComponent
              icon={
                <WalletCards
                  style={{
                    color: "var(--color-gray-400)",
                  }}
                  size={18}
                />
              }
              title="Total Credits Remaining"
              amount={String(nearlyExpired?.data?.summary?.total_credits_remaining)}
              // percentage={20}
            />
            <CardRevenueComponent
              icon={
                <Package
                  style={{
                    color: "var(--color-gray-400)",
                  }}
                  size={18}
                />
              }
              title="Total Packages"
              amount={String(nearlyExpired?.data?.summary?.total_packages)}
              // percentage={20}
            />{" "}
            <CardRevenueComponent
              icon={
                <CircleDollarSign
                  style={{
                    color: "var(--color-gray-400)",
                  }}
                  size={18}
                />
              }
              title="Total Outstanding (IDR)"
              amount={formatCurrency(nearlyExpired?.data?.summary?.total_outstanding_value_idr)}
              // percentage={20}
            />
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between w-full">
              <h4 className="text-[20px] font-semibold">Nearly Expired Credits</h4>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <CustomTable headers={headers} data={nearlyExpired?.data?.packages ?? []} isLoading={isLoadingNearlyExpired} />
              </div>
            </CardContent>
            <CardFooter>
              <CustomPagination
                onPageChange={(e) => {
                  setPage(e);
                }}
                currentPage={page}
                hasPrevPage={nearlyExpired?.pagination?.has_prev}
                hasNextPage={nearlyExpired?.pagination?.has_next}
                totalItems={nearlyExpired?.pagination?.total_items as number}
                totalPages={nearlyExpired?.pagination?.total_pages as number}
                limit={10}
              />
            </CardFooter>
          </Card>
        </div>
        {/* product */}
  
      </div>
    </div>
  );
};


// <div className="flex flex-col gap-4 pt-8">
// <div className="flex flex-col">
//   <h3 className="text-2xl font-semibold">Product Sales Perfomance</h3>
//   <p className="text-gray-400 text-sm">Track product sales by category including Sports Wear, Equipment, and Merchandise.</p>
// </div>
// <Card>
//   <CardHeader className="flex flex-row items-center justify-between w-full">
//     <h4 className="text-[20px] font-semibold">Product Overall Results</h4>
//     <div className="flex flex-row items-center gap-2">
//       {filterOption?.map((f) => (
//         <div key={f.value}>
//           <Button
//             variant={selectedFilterProduct === f.value ? "default" : "ghost"}
//             onClick={() => {
//               setSelectedFilterProduct(f.value);
//               setProductPagination(0);
//             }}
//           >
//             {f.name}
//           </Button>
//         </div>
//       ))}
//     </div>
//   </CardHeader>
//   <CardContent className="flex flex-row items-start justify-between">
//     <div className="flex flex-col gap-4 w-[75%]">
//       <div className="flex flex-col gap-1">
//         <p className="text-gray-500 ">Product Revenue</p>
//         <div className="flex flex-row items-center gap-4">
//           <p className="text-[36px] font-medium">{formatCurrency(dashboardOverViewProduct?.data?.summary?.all_time_total_idr)}</p>
        
//         </div>
//         <div className="text-gray-500 text-wrap  flex-wrap max-w-[75%] ">
//           <p className="w-full ">{categoryList?.temp.slice(0, 3)?.join(", ")}</p>
//           {categoryList.moreClass > 0 && <span>, and {categoryList.moreClass} other category</span>}
//         </div>

//         {/* <p className="text-gray-500 capitalize text-wrap flex-wrap max-w-[75%] ">{classList?.join(", ")}</p> */}
//       </div>
//     </div>
//     <div className="min-h-[250px] h-[250px]">
//       <Separator
//         orientation="vertical"
//         style={{
//           margin: "0 24px 0 0",
//         }}
//       />
//     </div>

//     <div className="flex flex-col gap-2 w-full justify-between min-h-[250px]">
//       <div className="flex flex-col gap-2 w-full h-full">
//         {c?.data[performacePagination]?.map((item: IOverallResultByClass) => (
//           <Fragment key={item.category_id}>
//             <div className="flex flex-row items-center justify-between w-full">
//               <div className="flex flex-col w-full">
//                 <p className="text-sm font-medium">{item.category_name}</p>

//                 {/* <p className="text-xs text-gray-500">Last Month</p> */}
//               </div>
//               <div className="flex flex-row items-center w-full gap-4">
//                 {/* <div>..</div> */}
//                 <div className="flex flex-col gap-1 w-full justify-end text-right">
//                   <p className="font-medium">
//                     {formatCurrency(
//                       selectedFilter === "all" ? item.all_time_total_idr : (item.trends as any)[selectedFilter]?.revenue_idr ?? 0,
//                     )}
//                   </p>
//                   <div className="flex flex-row items-center justify-end text-right">
//                     <div>
//                       {(item.trends as any)[selectedFilter]?.percentage_change > 0 ? (
//                         <ArrowUpRight color="var(--color-green-500)" size={18} />
//                       ) : (
//                         <ArrowDownRight color="var(--color-red-500)" size={18} />
//                       )}
//                     </div>
//                     <p
//                       className={cn("text-sm font-medium text-red-500", {
//                         "text-green-400": (item.trends as any)[selectedFilter]?.percentage_change >= 1,
//                         "text-red-500": (item.trends as any)[selectedFilter]?.percentage_change <= 0,
//                       })}
//                     >
//                       {(item.trends as any)[selectedFilter]?.percentage_change ?? 0}%
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             </div>
//             <Divider className="w-full" />
//           </Fragment>
//         ))}
//       </div>
//       <div className="flex flex-row justify-center items-center gap-2">
//         <div>
//           <Button variant={"outline"} size={"icon"} onClick={() => handlePaginationProduct("-")}>
//             <ChevronLeft />
//           </Button>
//         </div>
//         <div>
//           <Button variant={"outline"} size={"icon"} onClick={() => handlePaginationProduct("+")}>
//             <ChevronRight />
//           </Button>
//         </div>
//       </div>
//     </div>
//   </CardContent>
// </Card>
// </div>