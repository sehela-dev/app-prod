import { TFulfillmentStatus } from "@/types/customer-app/order.interface";

export const FULFILLMENT_LABEL: Record<TFulfillmentStatus, string> = {
  pending: "Pending",
  ready_for_pickup: "Ready for pickup",
  shipped: "Shipped",
  completed: "Completed",
  canceled: "Canceled",
};

export const FULFILLMENT_STYLE: Record<TFulfillmentStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  ready_for_pickup: "bg-sky-50 text-sky-700 border-sky-200",
  shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  canceled: "bg-gray-100 text-gray-600 border-gray-200",
};

export const fulfillmentLabel = (status?: string | null) =>
  FULFILLMENT_LABEL[(status ?? "") as TFulfillmentStatus] ?? status ?? "-";

export const fulfillmentStyle = (status?: string | null) =>
  FULFILLMENT_STYLE[(status ?? "") as TFulfillmentStatus] ?? "bg-gray-100 text-gray-600 border-gray-200";
