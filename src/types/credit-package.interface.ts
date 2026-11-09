import { IResponseData } from "@/lib/config";
import { ICommonParams } from "./general.interface";

export interface ICreditPackageItem {
  id: string;
  name: string;
  description: string;
  credits: number;
  price_idr: number;
  validity_days: number;
  class_ids_restriction: {
    name: string;
    id: string;
  }[];
  instructor_ids_restriction?: {
    name: string;
    id: string;
  }[] | null;
  eligible_start_time?: string | null;
  eligible_end_time?: string | null;
  place_restriction: string;
  package_type: string;
  parent_package_id: string;
  is_active: boolean;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  price_per_credit_idr: number;
  is_shareable?: boolean;
  max_purchases_per_user?: number | null;
  only_for_new_users?: boolean;
}

export interface ICreatePackagePayload {
  name: string;
  description: string;
  credits: number;
  price_idr: number;
  validity_days: number;
  class_ids_restriction: string | string[];
  instructor_ids_restriction?: string[] | null;
  eligible_start_time?: string | null;
  eligible_end_time?: string | null;
  place_restriction?: string;
  session_type_restriction?: string;
  package_type: string;
  is_active: boolean;
  is_visible?: boolean;
  is_shareable: boolean;
  max_purchases_per_user?: number | null;
  only_for_new_users?: boolean;
}

export interface ICreditPackageDetail {
  id: string;
  name: string;
  description: string;
  credits: number;
  price_idr: number;
  validity_days: number;
  class_type_restriction: string | null;
  place_restriction: string | null;
  package_type: string;
  parent_package_id: string | null;
  is_active: boolean;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  price_per_credit_idr: number;
  session_type_restriction: string | null;
  max_purchases_per_user?: number | null;
  only_for_new_users?: boolean;
  class_id_restriction: string | null;
  class_ids_restriction: {
    name: string;
    id: string;
  }[];
  instructor_ids_restriction?: {
    name: string;
    id: string;
  }[] | null;
  eligible_start_time?: string | null;
  eligible_end_time?: string | null;
  is_shareable: boolean;
}

export interface IPackageFormValues {
  name: string;
  credits: string;
  price_idr: string;
  validity_days: string;
  description: string;
  session_type_restriction: string;
  place_restriction: string;
  class_ids_restriction: string[];
  has_instructor_restriction: boolean;
  instructor_ids_restriction: string[];
  has_time_restriction: boolean;
  eligible_start_time: string;
  eligible_end_time: string;
  package_type: string;
  is_active: boolean;
  is_visible: boolean;
  is_shareable: boolean;
  max_purchases_per_user: string;
  only_for_new_users: boolean;
}
export type TCreatePackage = (data: ICreatePackagePayload) => Promise<IResponseData<ICreditPackageItem>>;
export type TEditPackage = ({ id, data }: { id: string; data: ICreatePackagePayload }) => Promise<IResponseData<ICreditPackageItem>>;

export type TCreditPackages = (params: ICommonParams) => Promise<IResponseData<ICreditPackageItem[]>>;
export type TCreditPackageDetail = (id: string) => Promise<IResponseData<ICreditPackageDetail>>;
