import {
  Store,
  Users,
  ShoppingCart,
  BarChart2,
  Receipt,
  Gem,
  CalendarCheck,
  PackageSearch,
  Tag,
  DollarSign,
  ChartNoAxesCombined,
  MapPin,
  LayoutGrid,
  UserCog,
  History,
  Settings,
  Undo2,
  Award,
  ScanLine,
} from "lucide-react";

export const dataNavMain = [
  { title: "Commerce", url: "#", icon: Store }, // 🛍️ icon visual → Store sudah mewakili group
  { title: "Attendence", url: "#", icon: Users },
  { title: "Orders", url: "#", icon: ShoppingCart },
];
export const dataNavMarketPlace = [
  { title: "Reporting and Analytics", url: "/admin/dashboard", icon: BarChart2, permission: "dashboard:view" },
  { title: "Orders", url: "/admin/orders", isActive: true, icon: Receipt, permission: "order:view" },
  { title: "Product Orders", url: "/admin/product-orders", icon: ShoppingCart, permission: "order:view" },
  {
    title: "Attendence",
    url: "#",
    icon: Users,
    items: [{ title: "Checked In", url: "/admin/attendance/checked-in", icon: ScanLine, permission: "session:view" }],
  },
  { title: "Credit Packages", url: "/admin/credit-packages", icon: Gem, permission: "credit_package:view" },
  {
    title: "Class",
    url: "#",
    icon: CalendarCheck,
    // permission: "class:view",

    items: [
      { title: "Classes", url: "/admin/class", icon: CalendarCheck, permission: "class:view" },
      { title: "Sessions", url: "/admin/session", icon: CalendarCheck, permission: "session:view" },
      { title: "Instructor", url: "/admin/instructor", icon: Users, permission: "instructor:view" },
      { title: "Locations", url: "/admin/locations", icon: MapPin, permission: "locations:view" },
    ],
  },
  {
    title: "Inventory",
    url: "#",
    icon: PackageSearch,
    items: [
      { title: "Inventory Management", url: "/admin/inventory", icon: PackageSearch, permission: "inventory:view" },
      { title: "Product Management", url: "/admin/products", icon: PackageSearch, permission: "products:view" },
    ],
  },
  { title: "Discount Voucher", url: "/admin/discount-voucher", icon: Tag, permission: "voucher:view" },
  // { title: "Discounts", url: "#", icon: Tag },
  { title: "Members", url: "/admin/member", icon: Users, permission: "member:view" },
];

export const dataNavReport = [
  { title: "All Reports", url: "/admin/report", icon: LayoutGrid, permission: "reports" },
  { title: "Cash Flow", url: "/admin/report/cash-flow", icon: ChartNoAxesCombined, permission: "cash-flow:view" },
];

// Cards for the /admin/report hub — All Reports (cash-flow is independent menu, visible via sidebar for both roles).
export const reportHubCards = [
  { title: "Orders Report", url: "/admin/report/orders", icon: Receipt, permission: "reports" },
  { title: "Stock Report", url: "/admin/report/stock", icon: PackageSearch, permission: "reports" },
  { title: "Outstanding Credit", url: "/admin/report/outstanding-credit", icon: DollarSign, permission: "reports" },
  { title: "Refund Report", url: "/admin/report/refund-report", icon: Undo2, permission: "reports" },
  { title: "Sales Summary", url: "/admin/report/sales-summary", icon: ChartNoAxesCombined, permission: "reports" },
  { title: "Customer Loyalty", url: "/admin/report/customer-loyalty", icon: Award, permission: "reports" },
  { title: "Teacher Report", url: "/admin/report/teacher", icon: Users, permission: "reports" },
];
export const settingsNav = [
  { title: "Admin Management", url: "/admin/admins", icon: UserCog, permission: "admin:view" },
  { title: "Refund Management", url: "/admin/refunds", icon: Undo2, permission: "refund:view" },
  { title: "Audit Logs", url: "/admin/audit-logs", icon: History, permission: "audit-log:view" },
  { title: "Settings", url: "/admin/settings", icon: Settings, permission: "settings:view" },
];

export const TNC_PARAGRAPHS = [
  "Seluruh ketentuan dalam dokumen ini terkait dengan keikutsertaan Saya pada kegiatan yang diselenggarakan oleh PT Ruang Bugar Sehela atau yang selanjutnya disebut sebagai “Sehela Space”.",
  "Saya mengerti dan setuju bahwa Saya diharapkan tiba di studio 10 menit sebelum jadwal kelas dimulai. Saya mengerti bahwa peserta yang datang terlambat lebih dari 10 menit setelah kelas dimulai, tidak dapat memasuki ruangan kelas dan pembayaran atas kelas tersebut tidak dapat dikembalikan (kredit kelas dianggap hangus).",
  "Saya mengerti dan setuju bahwa penjadwalan kembali atau reschedule kelas hanya dapat dilakukan 6 jam sebelum kelas dimulai, pembatalan keikutsertaan dalam waktu 6 jam dikenakan biaya penjadwalan kembali (reschedule fee) sebesar 75l untuk kelas yoga dan 95k untuk kelas prenatal yoga.",
  "Saya mengerti dan setuju bahwa biaya penjadwalan kembali (reschedule fee) tidak dapat digunakan untuk workshop, special class dan non regular class lainnya.",
  "Saya mengerti dan setuju bahwa apabila terdapat cidera dan/atau kondisi kesehatan yang harus diperhatikan, termasuk namun tidak terbatas pada cidera otot, cidera tulang, kehamilan, jahitan operasi, maka Saya wajib untuk memberitahukan sebelumnya kepada tim Sehela Space, termasuk namun tidak terbatas pada guru dan pegawai administrasi Sehela Space atas kondisi Saya secara lengkap dan memastikan bahwa Saya telah mendapatkan persetujuan dari dokter Saya untuk dapat ikutserta dalam kelas Sehela Space.",
  "Dengan ini Saya melepaskan dan/atau mengesampingkan Sehela Space dan/atau guru dan/atau pegawai dan/atau pemilik dari Sehela Space, secara masing-masing dan/atau bersama-sama, atas tuntutan apapun yang mungkin diajukan sebagai akibat dari keikutsertaan Saya atas kegiatan yang diselenggarakan oleh Sehela Space.",
  "Saya mengakui dan setuju bahwa Sehela Space, guru dan/atau pegawai Sehela Space bukan tenaga medis professional dan tidak dapat memberikan nasihat atas kondisi kesehatan Saya.",
  "Saya mengakui dan menyetujui bahwa terdapat resiko fisik yang mungkin terlibat dalam pelaksanaan kelas dan Saya tidak memiliki kondisi medis yang dapat menghalangi keikutsertaan Saya atas kegiatan di Sehela Space dan untuk itu, Saya bertanggung jawab secara penuh atas resiko dan/atau atau cidera yang dapat timbul setelah mengikuti kegiatan di Sehela Space.",
  "Saya mengakui dan menyetujui untuk menjaga barang bawaan Saya saat berada di Sehela Space. Sehela Space tidak bertanggung jawab atas kehilangan atau kerusakan atas barang Saya.",
  "Dalam hal terdapat barang yang tertinggal di Sehela Space, maka barang tersebut hanya akan disimpan selama 2 (dua) minggu. Dalam hal barang tersebut tidak diklaim oleh siapapun, maka Sehela Space memiliki hak untuk membuang atau mendonasikan barang tersebut.",
  "⁠Sisa kredit dari paket terakhir dapat di-rollover apabila pelanggan membeli paket baru paling lambat 30 (tiga puluh) hari setelah masa berlaku paket sebelumnya berakhir. Apabila paket baru tidak dibeli dalam jangka waktu tersebut, sisa kredit dinyatakan hangus.",
  "Kredit hasil rollover akan digabungkan dengan kredit paket baru dan memiliki tanggal kedaluwarsa yang sama, yang dihitung sejak hari pertama kredit digunakan. Rollover hanya berlaku untuk satu paket terakhir.",
  "Saya mengerti dan menyetujui bahwa Sehela Space dapat melakukan dokumentasi, termasuk namun tidak terbatas pada foto, video dan/atau dokumentasi lainnya atas kegiatan yang berada di Sehela Space serta menggunakan dokumentasi tersebut di social media.",
  "Sehela Space memiliki hak untuk merubah Syarat dan Ketentuan ini dari waktu ke waktu atas kebijakannya sendiri.",
] as const;
