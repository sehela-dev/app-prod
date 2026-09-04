"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Divider } from "@/components/ui/divider";

import { ScrollArea } from "@radix-ui/react-scroll-area";
import { useAdminManualTransaction } from "@/context/admin/add-transaction.ctx";
import { formatCurrency } from "@/lib/helper";
import { BaseDialogConfirmation } from "@/components/general/dialog-confirnation";
import { useCreateNewManualTrx } from "@/hooks/api/mutations/admin/use-create-manual-order";
import { IAdminCartItemData, IPackages, IProduct, ISession } from "@/types/orders.interface";
import { useRouter } from "next/navigation";
import { useApplyDiscountVoucher } from "@/hooks/api/mutations/admin";
import { IApplyDiscountResponse, IVouchersListItem } from "@/types/discount-voucher.interface";
import { DiscountSelectComponent } from "@/components/page/orders/discount-code-select";
import { MapPin, Plus, UserPlus2, Users2, XIcon } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BANK_LIST, SEHELA_BANKS, SEHELA_BRANCH } from "@/constants/sample-data";
import Select from "react-select";
import { BaseDialogComponent } from "@/components/general/base-dialog-component";
import { useDebounce } from "@/hooks";
import { useGetCustomers } from "@/hooks/api/queries/admin/customers";
import { ICustomerData } from "@/types/customers.interface";
import { parseProductCartItemId } from "@/components/page/orders/product-section";

export const PAYMENT_METHODS = [
  {
    label: "Cash",
    value: "cash",
  },
  {
    label: "EDC",
    value: "edc",
  },
  {
    label: "Bank Transfer",
    value: "transfer",
  },
];
export const DetailFormAddTransaction = () => {
  const router = useRouter();

  const { cartItems, updateItem, updateStepper, customerData, removeItem, updateQuantity, clearCart, addCustomer } = useAdminManualTransaction();
  const [selectedVoucher, setSelectedVoucher] = useState<IVouchersListItem | null>(null);
  const [discountData, setDiscountData] = useState<IApplyDiscountResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedPaymentMethod, setSelectPaymentMethod] = useState("cash");
  const [selectedBank, setSelectedBank] = useState<{ label: string; value: string } | null>(null);
  const [selectedBankTo, setSelectedBankTo] = useState<{ label: string; value: string } | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<{ label: string; value: string } | null>(null);

  useEffect(() => {
    if (customerData?.branch && !selectedBranch) {
      const found = SEHELA_BRANCH.find((b) => b.value === customerData.branch);
      if (found) setSelectedBranch(found as { label: string; value: string });
    }
  }, [customerData?.branch, selectedBranch]);

  const [nameFrom, setNameFrom] = useState(customerData?.name ?? "");
  const [openModalSharing, setOpenModalSharing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<IAdminCartItemData | null>(null);
  const [search, setSearch] = useState("");
  const debounceSearch = useDebounce(search, 300);
  const [selectedUser, setSelectedUser] = useState<ICustomerData | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<ICustomerData[]>([]);
  const [openSessionSharing, setOpenSessionSharing] = useState(false);



  const onSearch = (e: string) => {
    setSearch(e);
  };

  const { data, isLoading, refetch } = useGetCustomers({ search: debounceSearch, status: "true" });

  const optionData = useCallback(() => {
    const custData = data?.data?.filter((item) => item.id !== customerData?.id);
    return custData?.map((item) => ({
      ...item,
      label: `${item.full_name} - ${item.phone}`,
    }));
  }, [customerData?.id, data?.data]);

  const shareSessionWithOption = useCallback(() => {
    const selectedIds = new Set(selectedUsers?.map((u) => u.id));

    return optionData()?.filter((item) => !selectedIds.has(item.id));
  }, [optionData, selectedUsers]);

  const { mutateAsync, isPending } = useCreateNewManualTrx();
  const onModifyQty = (id: number | string, type: "+" | "-") => {
    const item = cartItems?.find((item) => item.id === id);
    const currentQty = item?.quantity || 0;
    const newQty = type === "+" ? currentQty + 1 : currentQty - 1;

    if (newQty < 0) return;

    if (newQty === 0) {
      removeItem(id);
    } else if (item) {
      updateQuantity(id, newQty);
    }
  };

  const { mutateAsync: applyDiscountCode } = useApplyDiscountVoucher();
  const totalPrice = useMemo(() => {
    let tempTp = 0;
    cartItems?.map((item) => (tempTp = tempTp + item.subtotal));
    return tempTp ?? 0;
  }, [cartItems]);

  const onCancel = () => {
    setOpen(false);
    router.push("/admin/orders");
  };
  const onConfirm = async () => {
    const sessions: ISession[] = [];
    const products: IProduct[] = [];
    const packages: IPackages[] = [];

    cartItems?.forEach((item) => {
      if (item.type === "class") {
        sessions.push({
          class_session_id: item.id as string,
          ...((item?.share_with_users?.length as number) > 0 ? { additional_user_ids: item?.share_with_user_ids } : null),
        });
      } else if (item.type === "buy_product" || item.type === "rent_product") {
        products.push({
          variant_id: parseProductCartItemId(item?.id as string).variantId, quantity: item.quantity,
          location_id: item.location_id as string,
        });
      } else if (item.type === "packages") {
        packages.push({
          package_id: item.id as string,
          ...(item.badge === "Sharing"
            ? {
              share_with_user_id: item.share_with_user_id,
            }
            : null),
        });
      }
    });

    const payload = {
      customer_name: customerData?.name as string,
      customer_email: customerData?.email as string,
      customer_phone: customerData?.phone as string,
      sessions: sessions ?? [],
      products: products ?? [],
      ...(products?.length as number > 0 ? { location_id: products?.[0].location_id } : null),
      packages: packages ?? [],
      notes: "Combined purchase",
      status: "paid",
      payment_method: selectedPaymentMethod,

      ...(selectedPaymentMethod === "transfer"
        ? {
          transfer_details: {
            // account_name_from: nameFrom as string,
            // account_bank_from: selectedBank?.label as string,
            account_bank_to: selectedBankTo?.label as string,
          },
        }
        : {
          branch: (selectedBranch?.value ?? customerData?.branch) as string,
        }),
      user_id: customerData?.id as string,
      branch: (selectedBranch?.value ?? customerData?.branch) as string,
      ...(discountData ? { voucher_code: selectedVoucher?.code } : null),
    };
    // console.log(payload)
    // return

    try {
      const res = await mutateAsync(payload);
      if (res) {
        setOpen(true);
        clearCart();
        addCustomer(undefined);
      }
    } catch (error) {
      console.log(error);
    }

    // updateStepper();
    // clearCart();
    // addCustomer(undefined);
    // setOpen(false);
  };

  const onSuccessDialog = () => {
    setOpen(false);
    clearCart();
    addCustomer(undefined);
    updateStepper();
  };

  const getCategoryFromItems = useCallback(() => {
    // Get unique types from the array
    const uniqueTypes = new Set(cartItems?.map((item) => item.type));

    // Map each unique type to its corresponding category
    const categories = Array.from(uniqueTypes)
      .map((type) => {
        switch (type) {
          case "class":
            return "booking";
          case "package":
            return "package_purchase";
          case "product":
            return "order";
          default:
            return "booking";
        }
      })
      .filter(Boolean); // Remove null/undefined values

    // Return unique categories
    return [...new Set(categories)];
  }, [cartItems]);

  const onApplyDiscount = async () => {
    try {
      const payload = {
        code: selectedVoucher?.code as string,
        transaction_type: selectedVoucher?.category as string,
        cart_total_idr: totalPrice,
        categories: getCategoryFromItems(),
        ...(customerData?.id ? { user_id: customerData.id as string } : null),
      };
      const res = await applyDiscountCode(payload);
      if (res) {
        setDiscountData(res?.data);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const onSaveShareWithUser = () => {
    if (!selectedUser || !selectedItem) return;

    // Find the item to update

    updateItem(selectedItem?.id, {
      share_with_user_id: selectedUser.id,
      shared_with_user: {
        id: selectedUser.id,
        name: selectedUser.full_name,
        phone: selectedUser.phone,
        email: selectedUser.email,
      },
    });
    setOpenModalSharing(false);
    setSelectedUser(null);
    setSelectedItem(null);
    setSearch("");
  };

  const onsSaveShareSession = () => {
    updateItem(selectedItem?.id as string, {
      share_with_user_ids: selectedUsers?.map((item) => item.id),
      share_with_users: selectedUsers?.map((item) => ({
        email: item.email,
        id: item.id,
        name: item.full_name,
        phone: item.phone,
      })),
    });

    setSelectedUsers([]);
    setSelectedItem(null);
    setSearch("");
    setOpenSessionSharing(false);
  };

  const onOpenSharingSessiong = (data: IAdminCartItemData) => {
    setSelectedItem(data);
    setOpenSessionSharing(true);
  };

  return (
    <div className="flex w-full">
      <div className="flex mt-2 w-full">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8 flex flex-col gap-4 w-full">
            <Card className="border-brand-100 w-full pb-0 ">
              <CardHeader>
                <h3 className=" text-brand-999 text-2xl font-semibold">Detail Order</h3>
                <p className="text-sm font-normal text-gray-500">Review class and product and choose how to pay</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col">
                  <div className="grid gap-2">
                    <hr style={{ color: "var(--color-brand-100" }} className="my-1" />
                    <div className="grid grid-cols-2">
                      <p className="text-brand-999 font-semibold text-sm">Customer Information</p>
                    </div>
                    <div className="grid grid-cols-2">
                      <p className="text-gray-500  text-sm">Customer</p>
                      <p className="text-brand-999 text-right text-sm">{customerData?.name}</p>
                    </div>
                    <div className="grid grid-cols-2">
                      <p className="text-gray-500  text-sm">Phone</p>
                      <p className="text-brand-999 text-right text-sm">{customerData?.phone}</p>
                    </div>
                    <div className="grid grid-cols-2">
                      <p className="text-gray-500  text-sm">Email</p>
                      <p className="text-brand-999 text-right text-sm">{customerData?.email}</p>
                    </div>
                    <Divider className="my-2" />
                  </div>

                  <div className="flex flex-col w-full">
                    <p className="text-brand-999 font-semibold text-sm mb-2">Ordered Items</p>
                    <div className="grid grid-cols-9">
                      <p className="text-gray-500 font-medium text-sm col-span-4">Item</p>
                      <p className="text-gray-500 font-medium text-sm col-span-1">Type</p>
                      <p className="text-gray-500 font-medium text-sm col-span-2">Share with</p>

                      <p className="text-gray-500 font-medium text-sm col-span-1 text-center flex justify-center items-center">Action</p>
                      <p className="text-gray-500 font-medium text-sm text-right col-span-1">Price & Qty</p>
                    </div>
                    <Divider className="my-2" />
                    <div className="flex flex-col gap-2 itm">
                      <ScrollArea>
                        {cartItems?.map((item) => (
                          <div key={item.id}>
                            <div className="grid grid-cols-9 items-center">
                              <div className="col-span-4 items-center">
                                <p className="text-brand-999 font-medium text-sm">{item.name}</p>
                                {item?.description && <p className="text-gray-500 font-medium text-sm">{item.description}</p>}

                                {item?.type === "buy_product" || item?.type === 'rent_product' ? <Badge><MapPin />{item.location_name}</Badge> : ""}

                                {/* <p className="text-sm font-semibold text-brand-200 flex-1">
                              {item?.variant?.map((v: { name: string; value: string }) => v.value).join(", ")}
                            </p> */}
                              </div>

                              <p className="text-brand-999 font-medium text-sm col-span-1 flex flex-col">
                                {item.badge ? (
                                  <Badge className="border bg-brand-100 min-w-[18px] h-[18px] text-[10px] border-brand-400 !p-1.5 ">
                                    {item.badge}
                                  </Badge>
                                ) : (
                                  <Badge variant={"default"} className="uppercase">
                                    {item.type}
                                  </Badge>
                                )}
                              </p>
                              <div className="text-brand-999 font-medium text-sm col-span-2 flex flex-col">
                                {item?.type === "packages" && item.badge === "Sharing" ? (
                                  <>
                                    {item?.share_with_user_id ? (
                                      <div className="flex flex-row items-center gap-4">
                                        <div className="flex flex-col">
                                          <p>{item?.shared_with_user?.name}</p>
                                          <p>{item?.shared_with_user?.phone}</p>
                                        </div>
                                        <Button
                                          size={"icon"}
                                          variant={"outline"}
                                          onClick={() => {
                                            updateItem(item.id, {
                                              share_with_user_id: undefined,
                                              shared_with_user: null,
                                            });
                                          }}
                                        >
                                          <XIcon color="var(--color-red-500)" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        size={"icon"}
                                        onClick={() => {
                                          setSelectedItem(item);
                                          setOpenModalSharing(true);
                                        }}
                                      >
                                        <Plus size={12} />
                                      </Button>
                                    )}
                                  </>
                                ) : item?.type === "class" && item.quantity > 1 ? (
                                  (item?.share_with_users?.length as number) > 0 ? (
                                    <div className="flex flex-row gap-1 items-center">
                                      <ul className="flex flex-col gap-1 text-xs">
                                        {item?.share_with_users?.map((item) => (
                                          <li key={item.id}>
                                            {item.name} - {item?.phone}
                                          </li>
                                        ))}
                                      </ul>
                                      <div>
                                        <Button
                                          size={"icon"}
                                          variant={"outline"}
                                          onClick={() => {
                                            updateItem(item.id, {
                                              share_with_user_ids: undefined,
                                              share_with_users: null,
                                            });
                                          }}
                                        >
                                          <XIcon />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-row gap-1 w-auto items-center">
                                      <Button
                                        className="w-fit text-sm"
                                        size={"sm"}
                                        variant={"outline"}
                                        onClick={() => {
                                          // updateItem(item.id, {
                                          //   share_with_user_id: undefined,
                                          //   shared_with_user: null,
                                          // });'
                                          onOpenSharingSessiong(item);
                                        }}
                                      >
                                        <UserPlus2 />
                                      </Button>
                                      <p className="text-[8px] text-gray-500 flex-wrap italic w-auto max-w-[150px]">
                                        *)You can share session with your friends up to {item.quantity - 1} person
                                      </p>
                                    </div>
                                  )
                                ) : (
                                  ""
                                )}
                              </div>


                              <div className="text-brand-999 font-medium text-sm text-center col-span-1">
                                {" "}
                                <div className="flex flex-row gap-2 items-center justify-center">
                                  <Button variant={"outline"} className="bg-transparent w-8 h-8" onClick={() => onModifyQty(item.id as number, "-")}>
                                    -
                                  </Button>
                                  <div className="w-8 h-8 flex items-center justify-center bg-brand-100 rounded-md">{item.quantity}</div>

                                  <Button variant={"outline"} className="bg-transparent w-8 h-8" onClick={() => onModifyQty(item.id as number, "+")}>
                                    +
                                  </Button>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-brand-999">
                                  {item.price.toLocaleString("id-ID", {
                                    currency: "IDR",
                                    style: "currency",
                                    maximumFractionDigits: 0,
                                  })}
                                </p>
                                <p className="text-brand-999 font-medium text-sm text-right col-span-1">x{item.quantity}</p>
                              </div>
                            </div>
                            <Divider className="my-2" />
                          </div>
                        ))}
                      </ScrollArea>
                      <div className="grid grid-cols-9">
                        <p className="text-brand-999 font-medium text-sm col-span-8">Sub Total</p>
                        <p className="text-brand-999 font-medium text-sm text-right col-span-1">{formatCurrency(totalPrice)}</p>
                      </div>
                      <Divider className="my-2" />
                      <div className="grid grid-cols-2">
                        <p className="text-brand-999 font-semibold text-sm">Discount Code</p>
                      </div>

                      {!discountData ? (
                        <div className="flex flex-row w-full gap-2 items-center">
                          <div className="flex w-full">
                            <DiscountSelectComponent
                              selecteValue={selectedVoucher}
                              setSelectedVoucher={setSelectedVoucher}
                              status={getCategoryFromItems()}
                            />
                            {/* <Input className="w-full border-brand-100" placeholder="Input discount code here..." /> */}
                          </div>
                          <div className="col-span-2">
                            <Button className="text-brand-999" variant={"secondary"} onClick={onApplyDiscount}>
                              Apply
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-row w-full gap-2 items-center">
                          <div className="flex w-full">
                            <Badge className="border bg-brand-500  text-[10px] border-brand-400 !px-4 rounded-[999px] text-gray-50 ">
                              <p className="font-semibold text-lg">
                                {selectedVoucher?.code}{" "}
                                {selectedVoucher?.discount_type === "percentage"
                                  ? `(${selectedVoucher?.discount_value}%)`
                                  : formatCurrency(selectedVoucher?.discount_value)}
                              </p>
                            </Badge>
                          </div>
                          <div className="col-span-2">
                            <Button
                              className="text-brand-999"
                              variant={"ghost"}
                              onClick={() => {
                                setSelectedVoucher(null);
                                setDiscountData(null);
                              }}
                            >
                              <XIcon />
                            </Button>
                          </div>
                        </div>
                      )}

                      <Divider className="!my-4" />
                      <div className="grid grid-cols-9">
                        <p className="text-brand-999  text-sm col-span-8">Sub Total</p>
                        <p className="text-brand-999  text-sm text-right col-span-1">{formatCurrency(totalPrice)}</p>
                      </div>
                      <Divider />
                      <div className="grid grid-cols-9">
                        <p className="text-brand-999  text-sm col-span-8">Discount</p>
                        <p className="text-brand-999  text-sm text-right col-span-1">
                          -
                          {!discountData
                            ? formatCurrency(0)
                            : discountData?.discount_type === "percentage"
                              ? `${formatCurrency(discountData?.calculated_discount)} (${discountData?.discount_value}%)`
                              : formatCurrency(discountData?.discount_value)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-brand-25 rounded-b-xl min-h-[56px] w-full">
                <div className="flex flex-row w-full font-bold text-xl">
                  <p className="text-brand-999  text-sm w-[80%]">Total Payment</p>
                  <p className="text-brand-999  text-sm text-right w-full">
                    {!discountData ? formatCurrency(totalPrice) : formatCurrency(discountData?.final_amount)}
                  </p>
                </div>
              </CardFooter>
            </Card>
            <div className="flex w-full gap-2 pt-4">
              <div className="flex w-full">
                <Button variant={"secondary"} className="w-full" onClick={updateStepper}>
                  Add Other Items
                </Button>
              </div>
              <div className="flex w-full">
                <Button className="w-full" onClick={() => onConfirm()} disabled={!!isPending}>
                  Save
                </Button>
              </div>
            </div>
          </div>
          <div className="col-span-4">
            <Card className="flex flex-col w-full border border-brand-100  h-fit col-span-2 pt-2">
              <CardHeader className="text-center font-semibold text-lg ">
                Payment Method
                <Divider />
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 w-full">
                  <RadioGroup
                    className="flex flex-row items-center justify-between"
                    value={selectedPaymentMethod}
                    onValueChange={(e) => setSelectPaymentMethod(e)}
                  >
                    {PAYMENT_METHODS.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={option.value} />
                        <Label htmlFor={option.value} className="text-sm font-medium text-brand-999 cursor-pointer">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1 mt-2">
                      <Label className="text-gray-500">Pay Amount</Label>
                      <Input
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-lg text-gray-999  placeholder-gray-400 focus:outline-none focus:border-brand-500 transition-colors h-[42px]"
                        value={!discountData ? formatCurrency(totalPrice) : formatCurrency(discountData?.final_amount)}
                        readOnly
                      />
                    </div>
                    {selectedPaymentMethod === "transfer" && (
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-col gap-1 mt-2">
                          <Label className="text-gray-500">Transfer To</Label>
                          <Select
                            options={SEHELA_BANKS as never}
                            className="basic-multi-select "
                            classNames={{
                              control: () =>
                                "w-full !border-2 !border-gray-200 rounded-lg text-gray-999  focus:outline-none focus:border-brand-500 transition-colors h-[42px] !rounded-md !bg-transparent shadow-xs",
                              placeholder: () => "placeholder-gray-400",
                              singleValue: () => "text-brand-999",
                              input: () => "text-brand-999 bg-none",
                            }}
                            onChange={(e) => {
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              setSelectedBankTo(e as any);
                            }}
                          />
                        </div>

                      </div>
                    )}
                    <div className="flex flex-col gap-1 mt-2">
                      <Label className="text-gray-500">Branch</Label>
                      <Select
                        options={SEHELA_BRANCH as never}
                        value={selectedBranch as never}
                        className="basic-multi-select "
                        classNames={{
                          control: () =>
                            "w-full !border-2 !border-gray-200 rounded-lg text-gray-999  focus:outline-none focus:border-brand-500 transition-colors h-[42px] !rounded-md !bg-transparent shadow-xs",
                          placeholder: () => "placeholder-gray-400",
                          singleValue: () => "text-brand-999",
                          input: () => "text-brand-999 bg-none",
                        }}
                        placeholder="Select branch..."
                        onChange={(e) => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          setSelectedBranch(e as any);
                        }}
                      />
                    </div>

                    {/* {selectedPaymentMethod === "bank_transfer" &&} */}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {open && (
        <BaseDialogConfirmation
          image="success-2"
          onCancel={onCancel}
          subtitle="Manual transaction added to your records."
          title="Transaction Added Successfully"
          onConfirm={onSuccessDialog}
          open={open}
          cancelText="Order List"
          confirmText="Create More"
        />
      )}

      {openModalSharing && (
        <BaseDialogComponent
          onConfirm={onSaveShareWithUser}
          isOpen={openModalSharing}
          title="Select User to share package"
          btnConfirm="Save"
          onClose={() => {
            setOpenModalSharing(false);
            setSelectedUser(null);
            setSelectedItem(null);
            setSearch("");
          }}
        >
          <Select
            options={optionData()}
            value={selectedUser}
            classNames={{
              control: () =>
                "w-full !border-2 !border-gray-200 rounded-lg text-gray-999  focus:outline-none focus:border-brand-500 transition-colors !rounded-md !bg-transparent shadow-xs h-[42px]",
              placeholder: () => "placeholder-gray-400",
              singleValue: () => "text-brand-999",
              input: () => "text-brand-999 bg-none",
            }}
            isLoading={isLoading}
            // getOptionLabel={(opt) => opt.full_name ?? opt.phone}
            // formatOptionLabel={(opt) => (
            //   <div className="flex flex-col gap-1">
            //     <p className="font-semibold">{opt.full_name}</p>
            //     <p className="text-gray-500 text-sm">{opt.phone}</p>
            //   </div>
            // )}

            getOptionValue={(opt) => opt.id}
            onInputChange={onSearch}
            inputValue={search}
            onChange={(e) => {
              setSelectedUser(e);
            }}
          />
          {selectedUser && (
            <div className="flex flex-col gap-2">
              <p className="text-lg">Share with:</p>
              <div className="flex flex-col gap-2 border border-brand-400 rounded-xl  p-4">
                <p>{selectedUser?.full_name}</p>
                <p>{selectedUser?.phone}</p>
                <p>{selectedUser?.email}</p>
              </div>
            </div>
          )}
        </BaseDialogComponent>
      )}
      {openSessionSharing && (
        <BaseDialogComponent
          onConfirm={onsSaveShareSession}
          isOpen={openSessionSharing}
          title="Select User to share class/session"
          btnConfirm="Save"
          onClose={() => {
            setOpenSessionSharing(false);
            setSelectedUsers([]);
            setSelectedItem(null);
            setSearch("");
          }}
        >
          <div>
            <Select
              options={shareSessionWithOption?.()}
              value={selectedUsers}
              isMulti
              classNames={{
                control: () =>
                  "w-full !border-2 !border-gray-200 rounded-lg text-gray-999  focus:outline-none focus:border-brand-500 transition-colors !rounded-md !bg-transparent shadow-xs h-[42px]",
                placeholder: () => "placeholder-gray-400",
                singleValue: () => "text-brand-999",
                input: () => "text-brand-999 bg-none",
              }}
              isLoading={isLoading}
              // getOptionLabel={(opt) => opt.full_name ?? opt.phone}
              // formatOptionLabel={(opt) => (
              //   <div className="flex flex-col gap-1">
              //     <p className="font-semibold">{opt.full_name}</p>
              //     <p className="text-gray-500 text-sm">{opt.phone}</p>
              //   </div>
              // )}

              getOptionValue={(opt) => opt.id}
              onInputChange={onSearch}
              inputValue={search}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={(e: any) => {
                // setSelectedUsers((prev) => ({ ...prev, e }));
                if (e.length <= (selectedItem?.quantity as number) - 1) {
                  setSelectedUsers(e);
                }
              }}
            />
            {selectedUsers?.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-lg">Share with:</p>
                {selectedUsers?.map((item) => (
                  <div className="flex flex-col gap-2 border border-brand-400 rounded-xl  p-4" key={item.id}>
                    <p>{item?.full_name}</p>
                    <p>{item?.phone}</p>
                    <p>{item?.email}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </BaseDialogComponent>
      )}
    </div>
  );
};
