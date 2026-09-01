# STOCK — demo product folders

This folder is the **local** storage provider's root (`LOCAL_STOCK_PATH`). In
production the same structure lives in Google Drive and is read through the
Drive API.

Each subfolder is one product. **Images are gitignored** — run
`npm run stock:images` (or `npm run db:seed`, which does it for you) to generate
placeholders, then replace them with real photography when you have it. Name
images in display order: `01.jpg`, `02.jpg`, … up to five per folder.

## What is here

18 products spanning every supported type, chosen to exercise the whole system
rather than just to fill a page:

| Folder | Type | Demonstrates |
|---|---|---|
| `TSHIRT-001` | T-shirt | The basic `product.json`: one colour, a size list, a single stock number spread across sizes. Featured + new arrival. |
| `TSHIRT-002` | T-shirt | Per-variant stock and a `comparePrice` discount. One variant is deliberately at zero. |
| `TSHIRT-003` | T-shirt | Two colours across five sizes. |
| `TSHIRT-004` | T-shirt | A light colourway, so the card treatment can be checked against a pale image. |
| `TSHIRT-005` | T-shirt | Featured without being a new arrival. |
| `TSHIRT \| STREET FADE TEE \| 690 \| WHITE \| S,M,L,XL \| STOCK:20` | T-shirt | The **folder-name convention**, for products with no `product.json`. |
| `PANTS-001` | Pants | Numeric waist sizes. |
| `PANTS-002` | Pants | Discount plus two colourways on numeric sizes. |
| `PANTS-003` | Pants | Lettered sizes on a non-shirt category. |
| `SHORTS-001`, `SHORTS-002` | Shorts | A second bottoms category, one lettered and one numeric. |
| `SHIRT-001`, `SHIRT-002` | Shirt | Multi-word colour names (`Ecru`, `Red Check`). |
| `HOODIE-001` | Hoodie | The largest size run, featured and new. |
| `HOODIE-002` | Hoodie | **Low stock** — single digits per variant, so the admin low-stock panel has something to show. |
| `JACKET-001` | Jacket | A single-colour outerwear piece. |
| `ACC-001` | Accessory | `ONE SIZE`, the smallest price in the catalogue. |
| `ACC-002` | Accessory | **Sold out** — zero stock, so the out-of-stock treatment is visible. |
| `BROKEN-001` | — | **Deliberately invalid** (unknown type, non-numeric price). It proves one bad folder is reported in the admin sync results without blocking the rest of the catalogue; the e2e test asserts this. Delete it once you have seen it work. |

`.image-manifest.json` records how many placeholder images each folder should
get. It is only read by the image generator — the sync service ignores it, and
it is not part of the product format.

See the main README for the full metadata reference.
