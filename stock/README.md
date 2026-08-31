# STOCK — sample product folders

This folder is the **local** storage provider's root (`LOCAL_STOCK_PATH`). In
production the same structure lives in Google Drive and is read through the
Drive API.

Each subfolder is one product. Images are gitignored — add your own `01.jpg`,
`02.jpg`, … (up to 5, named in display order).

| Folder | Demonstrates |
|---|---|
| `TSHIRT-001` | The basic `product.json`: one colour, a size list, a single stock number spread across sizes. |
| `TSHIRT-002` | Per-variant stock and a `comparePrice` discount. |
| `PANTS-001` | Numeric waist sizes. |
| `TSHIRT \| STREET FADE TEE \| 690 \| WHITE \| S,M,L,XL \| STOCK:20` | The folder-name convention, for products with no `product.json`. Create it with `mkdir` if you want to exercise that path. |
| `BROKEN-001` | **Deliberately invalid** (unknown type, non-numeric price). It proves one bad folder is reported in the admin sync results without blocking the rest of the catalogue — the e2e test asserts this. Delete it once you have seen it work. |

See the main README for the full metadata reference.
