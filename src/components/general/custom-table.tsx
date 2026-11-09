/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { Checkbox } from "../ui/checkbox";

import { TableBody, TableCell, TableHead, TableHeader, TableRow, Table } from "../ui/table";
import { TableContentProps } from "@/types/table.interface";

// Simple Radio Button Component
const RadioButton = ({ checked, onChange, id }: { checked: boolean; onChange: () => void; id: string }) => (
  <input
    type="radio"
    checked={checked}
    onChange={onChange}
    id={id}
    className="text-sobat-primary focus:ring-sobat-primary h-4 w-4 border-gray-300 bg-white focus:ring-2"
  />
);

export const CustomTable = (props: TableContentProps) => {
  const {
    headers,
    data,
    actionOptions,
    numberOptions,
    showCheckbox = false,
    setSelectedData,
    selectedAction,
    reverseAction = false,
    tableHeadClass = "",
    hover = true,
    objectKey,
    selectedData,
    isMultiple,
    setSort,
  } = props;

  // Handle sort state (sorting itself is done by the API)
  const [sortState, setSortState] = useState<{ key?: string; direction?: "asc" | "desc" }>({});

  const handleSort = (key: string) => {
    if (!setSort) return;
    const next: { key: string; direction: "asc" | "desc" } =
      sortState.key === key && sortState.direction === "asc" ? { key, direction: "desc" } : { key, direction: "asc" };
    setSortState(next);
    setSort(next);
  };

  // Handle row selection
  const handleRowSelect = (row: Record<string, unknown>) => {
    if (setSelectedData) {
      setSelectedData(row);
    }
  };
  // multiSelect
  const onSelectRow = useCallback(
    (inputValue: string | number) => {
      const list = Array.isArray(selectedData) ? (selectedData as Array<string | number>) : [];
      const next = list.includes(inputValue) ? list.filter((v) => v !== inputValue) : [...list, inputValue];
      setSelectedData?.(next);
    },
    [selectedData, setSelectedData],
  );

  // Check if a row is selected (for single selection, compare the entire row or use id)

  const isRowSelected = (row: Record<string, unknown>) => {
    if (!objectKey) return false;
    // Compare by the configured key in single-select mode
    return (row as any)[objectKey] === (selectedData as any)?.[objectKey];
  };

  return (
    <div className="w-full overflow-auto">
      <Table className="w-full table-auto">
        <TableHeader className={`bg- border-brand-100 sticky top-0 z-0 text-gray-500 ${tableHeadClass}`}>
          <TableRow>
            {/* Radio button column for single selection */}
            {(showCheckbox || isMultiple) && (
              <TableHead className="w-auto">
                <span className="sr-only">Select</span>
              </TableHead>
            )}

            {/* Number column */}
            {numberOptions?.show && <TableHead className="w-2">{numberOptions?.text}</TableHead>}

            {/* Table headers */}
            {headers?.map((head, headIdx) => {
              const sortKey = head.sortKey ?? head.id;
              return (
                <TableHead
                  key={`${head.id}-${headIdx}`}
                  style={{
                    width: head.width || "fit-content",

                    whiteSpace: head.whiteSpace as "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line" | "break-spaces" | undefined,
                  }}
                  className={` ${head.span ? `col-span-${head.span}` : ""} ${!head.width ? "w-fit" : ""} `}
                >
                  {head.sortable ? (
                    <div
                      className={`flex items-center gap-1 ${setSort ? "cursor-pointer select-none" : ""}`}
                      onClick={() => head.sortable && handleSort(sortKey)}
                    >
                      {head.text}
                      {setSort &&
                        (sortState.key === sortKey ? (
                          sortState.direction === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-sobat-primary" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-sobat-primary" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-gray-300" />
                        ))}
                    </div>
                  ) : (
                    head.text
                  )}
                </TableHead>
              );
            })}

            {/* Action column header */}
            {actionOptions?.show && <TableHead className="w-fit">{actionOptions?.text || "Actions"}</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {!props?.isLoading ? (
            <>
              {Number(data?.length) > 0 ? (
                data?.map((row, rowNumber) => (
                  <TableRow
                    key={rowNumber}
                    className={` ${hover ? "hover:bg-brand-25" : ""} ${
                      isRowSelected(row) && !isMultiple ? "!bg-brand-25 !font-medium" : ""
                    } cursor-pointer`}
                    onClick={() => (isMultiple ? onSelectRow(row.id) : handleRowSelect(row))}
                  >
                    {/* Radio button for single selection */}
                    {showCheckbox && (
                      <TableCell className="w-auto">
                        <RadioButton checked={isRowSelected(row)} onChange={() => handleRowSelect(row)} id={`row-${rowNumber}`} />
                      </TableCell>
                    )}
                    {isMultiple && (
                      <TableCell key={`check-${row?.id}`} onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          id={row.id}
                          checked={selectedData?.includes?.(row?.id)}
                          onClick={() => onSelectRow(row?.id)}
                          className="data-[state=checked]:bg-sobat-primary data-[state=checked]:border-sobat-primary focus-visible:ring-sobat-primary cursor-pointer"
                        />
                      </TableCell>
                    )}

                    {/* Number column */}
                    {numberOptions?.show && (
                      <TableCell className={`w-2 ${isRowSelected(row) ? "!text-sobat-primary font-semibold" : "text-dashboard-200"}`}>
                        {numberOptions?.render(row, rowNumber)}
                      </TableCell>
                    )}

                    {/* Table cells with custom rendering */}
                    {headers?.map((head, headIdx) => (
                      <TableCell
                        key={`${head.id}-${headIdx}`}
                        style={{
                          width: head.width || "auto",
                          whiteSpace: head.whiteSpace as "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line" | "break-spaces" | undefined,
                        }}
                        className={` ${isRowSelected(row) ? "!text-sobat-primary font-semibold" : "text-dashboard-200"}${
                          head.span ? `col-span-${head.span}` : ""
                        } ${!head.width ? "w-auto" : ""} `}
                      >
                        {typeof head.value === "function" ? head.value(row, rowNumber) : row[head.value] ?? "-"}
                      </TableCell>
                    ))}

                    {/* Action column */}
                    {actionOptions?.show && (
                      <TableCell
                        key={`action-${row?.id || rowNumber}`}
                        className="w-fit justify-end"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()} // Prevent row click when clicking actions
                        style={{
                          width: "100px",
                          whiteSpace: "normal",
                        }}
                      >
                        {actionOptions?.render && actionOptions.render(row, rowNumber)}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="w-full items-center justify-center text-center" colSpan={9999}>
                    Tidak ada Data
                  </TableCell>
                </TableRow>
              )}
            </>
          ) : (
            <TableRow>
              <TableCell className="items-center justify-center text-center" colSpan={100}>
                {/* <Skeleton className="h-3 w-full" /> */}
                <p>Loading....</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Selected action bar */}
      {selectedAction && <div className={`bg-muted mt-4 rounded-lg p-4 ${reverseAction ? "order-first" : ""}`}>{selectedAction}</div>}
    </div>
  );
};

export const buildNumber = (
  // Assume start with index 0
  idx: number,
  perPage: number,
  currentPage: number,
) => (currentPage - 1) * perPage + idx + 1;
