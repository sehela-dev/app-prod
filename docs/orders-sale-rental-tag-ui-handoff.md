# UI Handoff — Orders Report: Sale vs Rental Tag

**Untuk:** Team UI Backoffice
**Source BE:** `supabase/functions/admin/_shared/orders_report.ts` (`joinProductNames`)
**Source FE:** `src/view/report/orders/index.tsx` (kolom `Product Name`)
**Endpoints:** `GET /admin/orders` (preview) + `GET /admin/orders/export` (CSV)
**Status:** UI change ada di repo ini (app-prod); perubahan BE **belum deploy** ke dev/prod.
**Last Updated:** 2026-11-23

---

## 1) Perubahan

`Product Name` sekarang menandai tiap item produk: **`(Sale)`** atau **`(Rental)`**.

- Tidak ada field baru, tidak ada kolom baru, urutan kolom CSV tetap.
- Perubahan UI: sel `Product Name` di tabel preview sekarang **wrap** (sebelumnya truncate), jadi suffix `(Sale)` / `(Rental)` selalu terlihat. Nama panjang turun baris.
- Tag diambil dari snapshot checkout `order_items.fulfillment_type` (`sale` | `rental`), yang berasal dari `products.is_rentable` saat order dibuat. Ubah `is_rentable` belakangan tidak mengubah histori.
- Satu order bisa campur sale + rental, jadi tag ditempel **per item**, bukan per order.

## 2) Contoh

Sebelum:

```
Tumbler, Mat
```

Sesudah:

```
Tumbler (Sale), Mat (Rental)
```

Preview JSON:

```json
"productName": "Tumbler (Sale), Mat (Rental)"
```

Baris CSV:

```csv
"Product Name"
"Tumbler (Sale), Mat (Rental)"
```

Baris non-produk tidak berubah:

| Jenis | `productName` |
| :--- | :--- |
| Product order (sale) | `Tumbler (Sale)` |
| Product order (rental) | `Mat (Rental)` |
| Mixed product order | `Tumbler (Sale), Mat (Rental)` |
| Booking kelas | `Vinyasa Flow` |
| Pembelian paket | `""` |
| Cancellation penalty | `Cancellation fee — <session> (<class>)` |

## 3) Catatan

- `Transaction Type` tetap `product` untuk semua order produk (sale maupun rental). Itu tipe transaksi, bukan tipe fulfillment.
- Sel `Product Name` pakai `max-w-56 whitespace-normal break-words`; `title` tetap berisi nama lengkap.
- Belum ada filter khusus rental. Kalau nanti perlu rekap rental terpisah, tambah `fulfillment_type` sebagai kolom/filter terpisah — sekarang sengaja tidak dibuat agar tidak ada breaking column change.
