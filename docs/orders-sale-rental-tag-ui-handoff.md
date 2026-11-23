# UI Handoff — Orders Report: Product Type (Sale / Rental)

**Untuk:** Team UI Backoffice
**Source BE:** `supabase/functions/admin/_shared/orders_report.ts`
**Source FE:** `src/view/report/orders/index.tsx`
**Endpoints:** `GET /admin/orders` (preview) + `GET /admin/orders/export` (CSV)
**Status:** live dev (`admin` v357) + prod (`admin` v86) + FE app-prod, 2026-11-23.

---

## 1) Perubahan

- Kolom baru **`Product Type`** tepat setelah `Product Name`: `Sale`, `Rental`,
  `Sale, Rental` (satu order campur), atau kosong untuk baris non-produk.
- `Product Name` kembali bersih — suffix `(Sale)` / `(Rental)` sudah dihapus.
- Field baru `productType` di setiap baris preview JSON.
- Filter baru di `transaction_type`:
  - `product-sale` → label UI **Product Sale**
  - `product-rent` → label UI **Product Rent**
  - `product` tetap mengembalikan keduanya.
- Nilai diambil dari snapshot checkout `order_items.fulfillment_type`
  (`sale` | `rental`), jadi mengubah `products.is_rentable` belakangan tidak
  mengubah histori.
- CSV sekarang **19 kolom**; `Product Type` disisipkan setelah `Product Name`.

## 2) API

```
GET /admin/orders?month=2026-11&transaction_type=product-sale
GET /admin/orders/export?month=2026-11&transaction_type=product-rent
```

| `transaction_type` | Arti |
| :--- | :--- |
| `product` | semua order produk (sale + rental) |
| `product-sale` | hanya baris yang punya item `fulfillment_type = sale` |
| `product-rent` | hanya baris yang punya item `fulfillment_type = rental` |
| lainnya | tidak berubah (`package`, `class`, `mixed`, `cancellation-fee`) |

Filter product-sale/rent juga menyertakan payment `mixed` yang berisi produk.
Nilai lain tetap `400 INVALID_TRANSACTION_TYPE`.

## 3) Contoh

Preview JSON:

```json
{
  "productName": "Tumbler, Mat",
  "productType": "Sale, Rental"
}
```

Baris CSV:

```csv
"Product Name","Product Type"
"Tumbler, Mat","Sale, Rental"
```

| Jenis | `productName` | `productType` |
| :--- | :--- | :--- |
| Product order (sale) | `Tumbler` | `Sale` |
| Product order (rental) | `Mat` | `Rental` |
| Mixed product order | `Tumbler, Mat` | `Sale, Rental` |
| Booking kelas | `Vinyasa Flow` | `""` |
| Pembelian paket | `""` | `""` |
| Cancellation penalty | `Cancellation fee — <session> (<class>)` | `""` |

## 4) Catatan

- `Transaction Type` tetap `product` untuk semua order produk; `Product Type`
  yang membedakan sale vs rental.
- Baris `Sale, Rental` tidak memberi tahu item mana yang mana, hanya bahwa order
  itu campuran. Untuk per-item, lihat detail order.
- Tidak ada migration.
