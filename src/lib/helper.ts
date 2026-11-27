import { NavItem } from "@/components/nav-main";
import { IOverallResultByClass } from "@/types/dashboard.interface";
import { addMonths, format, parseISO, subDays, subMonths } from "date-fns";
import { tz } from "@date-fns/tz";
import { id } from "date-fns/locale";

export const TRANSACTION_TERMINAL_STATUSES = ["voided", "refunded", "cancelled", "canceled"] as const;

export const isTransactionVoidable = (status?: string | null): boolean =>
  !!status && !TRANSACTION_TERMINAL_STATUSES.includes(status.toLowerCase() as (typeof TRANSACTION_TERMINAL_STATUSES)[number]);

export function formatCurrency(amount?: string | number, currencyCode = "IDR", locale = "id-ID") {
  // Create a new Intl.NumberFormat object
  const data = parseInt(amount as string);
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0, // Ensure at least two decimal places
    maximumFractionDigits: 0, // Ensure at most two decimal places
  });

  // Format the amount and return the string
  return formatter.format(data);
}

/**
 * Format date, always in WIB (Asia/Jakarta) regardless of the viewer's device timezone.
 * Date-only strings ("YYYY-MM-DD") are WIB calendar dates — pinned at WIB midnight so
 * they can't roll to a neighbouring day on devices in other timezones.
 * @param date - Date string or Date object
 * @param formatStr - Format pattern (default: 'dd/MM/yyyy')
 * @returns Formatted date string
 */
export const formatDateHelper = (date: string | Date, formatStr: string = "dd/MM/yyyy"): string => {
  try {
    // time pattern → append literal WIB ('WIB' quoted so date-fns doesn't parse W as ISO-week)
    const fmt = /[hms]/.test(formatStr) ? `${formatStr} 'WIB'` : formatStr;
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return format(parseISO(`${date}T00:00:00+07:00`), fmt, { in: tz("Asia/Jakarta") });
    }
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    return format(dateObj, fmt, { in: tz("Asia/Jakarta") });
  } catch (error) {
    console.error("Date formatting error:", error);
    return "";
  }
};

/** Today's date in WIB, for date-input bounds and API filters keyed on Jakarta days. */
export const todayWIB = (): string => format(new Date(), "yyyy-MM-dd", { in: tz("Asia/Jakarta") });

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore?tab=readme-ov-file#_flatten
 * https://github.com/you-dont-need-x/you-dont-need-lodash
 */

// ----------------------------------------------------------------------

// export function flattenArray<T>(list: T[], key = "children"): T[] {
//   let children: T[] = [];

//   const flatten = list?.map((item: any) => {
//     if (item[key] && item[key].length) {
//       children = [...children, ...item[key]];
//     }
//     return item;
//   });

//   return flatten?.concat(children.length ? flattenArray(children, key) : children);
// }

// ----------------------------------------------------------------------

// export function flattenDeep(array: any): any[] {
//   const isArray = array && Array.isArray(array);

//   if (isArray) {
//     return array.flat(Infinity);
//   }
//   return [];
// }

// ----------------------------------------------------------------------

// export function orderBy<T>(array: T[], properties: (keyof T)[], orders?: ("asc" | "desc")[]): T[] {
//   return array.slice().sort((a, b) => {
//     for (let i = 0; i < properties.length; i += 1) {
//       const property = properties[i];
//       const order = orders && orders[i] === "desc" ? -1 : 1;

//       const aValue = a[property];
//       const bValue = b[property];

//       if (aValue < bValue) return -1 * order;
//       if (aValue > bValue) return 1 * order;
//     }
//     return 0;
//   });
// }

// ----------------------------------------------------------------------

// export function keyBy<T>(
//   array: T[],
//   key: keyof T
// ): {
//   [key: string]: T;
// } {
//   return (array || []).reduce((result, item) => {
//     const keyValue = key ? item[key] : item;

//     return { ...result, [String(keyValue)]: item };
//   }, {});
// }

// ----------------------------------------------------------------------

// export function sumBy<T>(array: T[], iteratee: (item: T) => number): number {
//   return array.reduce((sum, item) => sum + iteratee(item), 0);
// }

// ----------------------------------------------------------------------

export function isEqual(a: any, b: any): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (typeof a === "string" || typeof a === "number" || typeof a === "boolean") {
    return a === b;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((item, index) => isEqual(item, b[index]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a!);
    const keysB = Object.keys(b!);

    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every((key) => isEqual(a[key], b[key]));
  }

  return false;
}

// ----------------------------------------------------------------------

function isObject(item: any) {
  return item && typeof item === "object" && !Array.isArray(item);
}

export const merge = (target: any, ...sources: any[]): any => {
  if (!sources.length) return target;

  const source = sources.shift();

  for (const key in source) {
    if (isObject(source[key])) {
      if (!target[key]) Object.assign(target, { [key]: {} });
      merge(target[key], source[key]);
    } else {
      Object.assign(target, { [key]: source[key] });
    }
  }

  return merge(target, ...sources);
};

export const createFormData = (values: any) => {
  const payload = new FormData();

  Object.entries(values).forEach(([key, value]: any) => {
    if (value === "" || value === null || value === undefined) return;

    // Files
    if (value instanceof File || value instanceof Blob) {
      payload.append(key, value);
      return;
    }

    // Arrays
    if (Array.isArray(value)) {
      if (value.length === 0) return;

      // ✅ Handles your PhotoItem structure
      if (value[0]?.file instanceof File) {
        value.forEach((item) => payload.append(key, item.file));
        return;
      }

      // Handles other file arrays
      if (value[0] instanceof File) {
        value.forEach((f) => payload.append(key, f));
        return;
      }

      // Stringify objects (variants)
      if (typeof value[0] === "object") {
        payload.append(key, JSON.stringify(value));
        return;
      }
    }

    // Objects - stringify
    if (typeof value === "object") {
      payload.append(key, JSON.stringify(value));
      return;
    }

    // Primitives
    payload.append(key, String(value));
  });

  return payload;
};
export function bytesToMegabytes(bytes: number) {
  if (bytes === null || bytes === undefined) {
    return "N/A"; // Handle cases of null or undefined input
  }
  if (typeof bytes !== "number") {
    return "Invalid Input"; // Handle non-numeric input
  }

  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(2)} MB`; // Format to two decimal places and append 'MB'
}

export const ACCEPTED_TYPES = [
  "application/pdf", // PDF
  // "application/msword", // .doc
  // "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  // "application/vnd.ms-powerpoint", // .ppt
  // "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
];

export const TEXT_HELPER = {
  completed: "Menyelesaikan ",
  assigned: "Menerima",
  canceled: "Membatalkan",
};

export const STATUS_TEXT_HELPER = {
  completed: "Sukses",
  canceled: "Dibatalkan",
  ongoing: "Sedang Berjalan",
};
export function getRandomDarkColor(): string {
  let color;
  do {
    color = `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")}`;
  } while (getLuminance(color) > 0.6 || isRed(color)); // skip too light or too red
  return color;
}

function getLuminance(hex: string): number {
  const r = parseInt(hex.substr(1, 2), 16) / 255;
  const g = parseInt(hex.substr(3, 2), 16) / 255;
  const b = parseInt(hex.substr(5, 2), 16) / 255;

  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));

  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; // W3C formula
}

function isRed(hex: string): boolean {
  const r = parseInt(hex.substr(1, 2), 16);
  const g = parseInt(hex.substr(3, 2), 16);
  const b = parseInt(hex.substr(5, 2), 16);

  // Heuristic: red channel much stronger than green & blue
  return r > 150 && g < 80 && b < 80;
}

export function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} Hari`);
  if (hours > 0) parts.push(`${hours} Jam`);
  if (minutes > 0) parts.push(`${minutes} Menit`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} Detik`);

  return parts.join(" ");
}

export const defaultDate = () => {
  const today = new Date();

  // Get date from one month ago
  const oneMonthAgo = subDays(today, 30);
  const oneMonthForward = addMonths(today, 1);
  const twoWeeksAdvance = addMonths(today, 14);
  const twoWeeksBefore = subDays(today, 14);

  // Format the dates in WIB (filters are keyed on Jakarta days)
  const formattedToday = format(today, "yyyy-MM-dd", { in: tz("Asia/Jakarta") });
  const formattedOneMonthAgo = format(oneMonthAgo, "yyyy-MM-dd", { in: tz("Asia/Jakarta") });
  const formattedOneMonthLater = format(oneMonthForward, "yyyy-MM-dd", { in: tz("Asia/Jakarta") });
  const formattedTwoWeeksAdvance = format(twoWeeksAdvance, "yyyy-MM-dd", { in: tz("Asia/Jakarta") });
  const formattedTwoWeeksBefore = format(twoWeeksBefore, "yyyy-MM-dd", { in: tz("Asia/Jakarta") });

  return { formattedToday, formattedOneMonthAgo, formattedOneMonthLater, formattedTwoWeeksAdvance, formattedTwoWeeksBefore };
};

export function combineToISOString(date: string, time: string): string {
  // Combine date and time strings (admin picks WIB wall-clock)
  const dateTimeString = `${date}T${time}:00+07:00`;

  // Create a Date object
  const dateTime = new Date(dateTimeString);

  // Convert to ISO string and remove milliseconds
  return dateTime.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function splitArray(array: any, chunkSize: number) {
  const chunks = [];
  for (let i = 0; i < array?.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export const previewURLHelper = (data: any) => {
  console.log(data);
  const previewUrl = data ? URL.createObjectURL(data) : "/assets/user-placeholder.png";
  return previewUrl;
};

export function filterNavItems(items: NavItem[], can: (p: string) => boolean): NavItem[] {
  return items
    .map((item) => {
      if (item.permission && !can(item.permission)) return null;

      if (item.items) {
        const filteredChildren = item.items.filter((child) => !child?.permission || can(child?.permission));

        if (filteredChildren.length === 0) return null;

        return { ...item, items: filteredChildren };
      }

      return item;
    })
    .filter(Boolean) as NavItem[];
}
export function getDurationInMinutes(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const diffMs = end.getTime() - start.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  return String(diffMinutes);
}

// export const reminderMessage = (name: string, session: string, schedule: string, studio: string) => {
//   const msg = `Hi kak *${name}*! Kami ingin mengingatkan bahwa Kakak terdaftar di kelas  *${session.toUpperCase()}*  *${schedule}* di *${studio}*, yang akan dimulai dalam 60 menit!

// Mohon hadir 10 menit sebelum jadwal kelas sehingga Kakak dapat mempersiapkan diri di studio.
// Pastikan Kakak sudah melakukan registrasi di meja resepsionis sebelum masuk kelas Kami ingatkan kembali, maksimal waktu keterlambatan untuk mengikuti kelas adalah 10 menit setelah kelas dimulai.

// Untuk matras tersedia di dalam studio dan harap merapikan kembali setelah pemakain
// Terima kasih dan sampai jumpa :)`;
//   return msg;
// };

// export const sendReminder = (phone: string, msg: string) => {
//   const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
//   window.open(url, "_blank");
// };

export const reminderMessage = (name: string, session: string, schedule: string, studio: string) => {
  return `Hi Kak ${name}
Kelas ${session} mulai 30 menit lagi (${schedule}, ${studio}).

Quick reminder ya Kak:
• Datang 10 menit lebih awal & check-in di resepsionis
• Toleransi telat maks. 10 menit setelah kelas mulai
• Matras studio tersedia, tapi boleh bawa sendiri juga ya

See you!`;
};

export const sendReminder = (phone: string, msg: string) => {
  const url = `https://wa.me/${normalizePhoneNumber(phone)}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
};

/**
 * True when now is at/after session end and still within 1 hour after end.
 * Past that window → enrollment should not proceed.
 */
export const checkIsinHour = (endDateTime: string | Date): boolean => {
  const end = typeof endDateTime === "string" ? new Date(endDateTime) : endDateTime;
  if (Number.isNaN(end.getTime())) return false;

  const now = Date.now();
  const endMs = end.getTime();
  const oneHourAfterEnd = endMs + 60 * 60 * 1000;

  return now >= endMs && now <= oneHourAfterEnd;
};

/**
 * Normalize Indonesian phone numbers for wa.me links.
 * Converts 08…, 8…, and +62… into 62… (digits only).
 */
export const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return "";

  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;

  return digits;
};

export const normalizeOrderId = (id?: string | null): string => (id ? String(id).replace(/^#+/, "").trim() : "");
export const displayOrderId = (id?: string | null): string => {
  const clean = normalizeOrderId(id);
  return clean ? `#${clean}` : "-";
};
