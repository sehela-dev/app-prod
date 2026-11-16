import { IResponseData } from "@/lib/config";
import { ICommonParams } from "./general.interface";

export interface IRevenue {
  all_time_total_idr: number;
  breakdown: IBreakdown;
  monthly_total_idr: string;
  monthly_percentage_change: string;
  previous_month_total_idr: string;
}

export interface IBreakdown {
  class_bookings_idr: number;
  product_sales_idr: number;
  package_purchases_idr: number;
}

export interface IOrders {
  all_time_total: number;
  monthly_total: string;
  monthly_percentage_change: string;
  previous_month_total: string;
}

export interface IMembers {
  all_time_total: number;
  filter_active_only: boolean;
  monthly_new: string;
  monthly_percentage_change: string;
  previous_month_new: string;
}

export interface IBirthdayStudent {
  id: string;
  full_name: string;
  date_of_birth: string;
  age: number;
}

export interface IOverviewDashboard {
  revenue: IRevenue;
  orders: IOrders;
  members: IMembers;
  birthdays_today: IBirthdayStudent[];
}

export interface IOverallResult {
  summary: IOverallResultSummary;
  by_class?: IOverallResultByClass[];
  by_category?: IOverallResultByClass[];
}

export interface IOverallResultSummary {
  all_time_total_idr: number;
  trends: IOverallResultSummaryTrends;
}
export interface IOverallResultSummaryTrends {
  last_7_days: IOverallResultSummaryTrendsItem;
  last_1_month: IOverallResultSummaryTrendsItem;
  last_6_months: IOverallResultSummaryTrendsItem;
}
export interface IOverallResultSummaryTrendsItem {
  revenue_idr: number;
  previous_period_idr: number;
  percentage_change: number;
}

export interface IOverallResultByClass {
  class_id?: string;
  class_name?: string;
  category_name?: string;
  category_id?: string;

  all_time_total_idr: number;
  trends: IOverallResultSummaryTrends;
}

export interface INearlyExpiredCreditResponse {
  within_days: number;
  summary: ISummary;
  packages: INearlyExpiredCreditPackage[];
}
export interface ISummary {
  total_packages: number;
  total_credits_remaining: number;
  total_outstanding_value_idr: number;
}
export interface INearlyExpiredCreditPackage {
  package_purchase_id: string;
  user_id: string;
  student_name: string;
  student_phone: string;
  package_name: string;
  package_type: string;
  credits_total: number;
  credits_remaining: number;
  credits_used: number;
  actual_amount_paid_idr: number;
  outstanding_value_idr: number;
  purchased_at: string;
  first_used_at: string;
  expires_at: string;
  days_until_expiry: number;
  is_shared: boolean;
  shared_with_name?: string;
}

export interface IParamsNearlyExpiredCredit extends ICommonParams {
  within_days: number;
}

export type TOverviewDashboard = () => Promise<IResponseData<IOverviewDashboard>>;
export type TSessionPerformance = () => Promise<IResponseData<IOverallResult>>;
export type TNearlyExpiredCreditResponse = (data: IParamsNearlyExpiredCredit) => Promise<IResponseData<INearlyExpiredCreditResponse>>;
