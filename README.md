# Men's Fashion Store — folder-driven e-commerce

A mobile-first online men's clothing store for the Maldives. Products are
managed by dropping folders into a **STOCK** directory (Google Drive or a local
path) — there is no product-entry form to keep in sync. Customers buy without
registering: phone number, OTP, delivery address, done. An account is created
for them automatically.

Prices are in **MVR** throughout.

---

## How the product workflow works

```
STOCK/                       → scan folders
└── TSHIRT-001/              → read product.json (or parse the folder name)
    ├── product.json         → validate
    ├── 01.jpg               → read up to 5 images
    ├── 02.jpg               → write to the database
    └── 03.jpg               → the storefront renders it
```

The store owner never touches an admin form to add a product. They add a folder,
press **SYNC STOCK**, and the catalogue updates. One malformed folder is
reported in the sync results and skipped — it never blocks the rest.

### Product metadata — the recommended convention

Put a `product.json` in each product folder:

```json
{
  "sku": "TSHIRT-001",
  "type": "tshirt",
  "name": "Oversized Basic",
  "category": "T-Shirts",
  "price": 750,
  "currency": "MVR",
  "colors": ["Black"],
  "sizes": ["S", "M", "L", "XL", "XXL"],
  "description": "Heavyweight oversized cotton tee.",
  "featured": true,
  "newArrival": true,
  "active": true,
  "stock": 25
}
```

**Different stock per size or colour?** Use `variants` instead of `stock`:

```json
{
  "sku": "TSHIRT-002",
  "type": "tshirt",
  "name": "Boxy Graphic Tee",
  "price": 850,
  "comparePrice": 1100,
  "colors": ["Black", "Grey"],
  "sizes": ["M", "L", "XL"],
  "variants": [
    { "size": "M", "color": "Black", "stock": 6 },
    { "size": "L", "color": "Black", "stock": 8 },
    { "size": "XL", "color": "Black", "stock": 2 },
    { "size": "M", "color": "Grey",  "stock": 4 },
    { "size": "L", "color": "Grey",  "stock": 0 }
  ]
}
```

`comparePrice` is the "was" price — set it higher than `price` to show a
discount badge.

### The folder-name alternative

A folder with no `product.json` is read from its name:

```
TYPE | NAME | PRICE | COLOR | SIZES | STOCK:n
```

```
TSHIRT | OVERSIZED BASIC | 750 | BLACK | S,M,L,XL,XXL | STOCK:12
PANTS | CARGO UTILITY | 1250 | DARK GREY | 30,32,34,36 | STOCK:16
TSHIRT | STREET FADE TEE | 690 | WHITE | S,M,L,XL | STOCK:20 | WAS:900
```

Prefixed fields (`STOCK:`, `SKU:`, `WAS:`, `SIZES:`, `COLORS:`) can appear in
any order. **`product.json` is the recommended route** — it supports per-variant
stock, descriptions and future fields that a folder name cannot express.

### Rules for both formats

| Rule | Detail |
|---|---|
| Images | Up to **5** per folder. Extra images are ignored with a warning. |
| Image order | Alphabetical — name them `01.jpg`, `02.jpg`, … |
| SKU | Must be unique. Defaults to the folder name. |
| Types | `tshirt`, `pants`, `shirt`, `shorts`, `hoodie`, `jacket`, `accessory` |
| Currency | MVR only. |
| Removed folder | Product is deactivated, not deleted — past orders still reference it. |
| Renamed folder | Tracked by folder id, so the product updates in place. |

### How stock syncing treats sales

Sync applies the **difference** in what STOCK declares, not the absolute number.
If the folder says 12, three sell, and you edit the folder to 20, stock becomes
17 — not 20. Sales are never erased by a sync.

---

## Getting started

### Requirements

- Node.js 20+
- PostgreSQL 14+

### Demo data

The repository ships a demo catalogue of 18 products across every category —
tees, pants, shorts, shirts, hoodies, a jacket and accessories — with discounts,
per-variant stock, a low-stock item and a sold-out item, plus one deliberately
malformed folder that proves a bad product does not break the rest. Product
photography is not included; `db:seed` generates placeholder images so the
storefront is populated on a fresh clone.

### Setup

```bash
npm install
cp .env.example .env          # then fill in the values
npx prisma migrate deploy     # create the database schema
npm run build
```

Create the first admin user:

```bash
ADMIN_INITIAL_USERNAME=admin ADMIN_INITIAL_PASSWORD='a-long-random-password' \
  npm run admin:create
```

Then either load the demo data, or add your own product folders:

```bash
npm run db:seed               # demo catalogue, customers and orders
npm run dev                   # http://localhost:3000
```

`db:seed` generates placeholder images, syncs STOCK, and creates eight demo
customers with a spread of orders across every status. It is safe to re-run: it
removes the previous demo data (returning its stock) before recreating it, and
refuses to run against `NODE_ENV=production` unless
`ALLOW_SEED_IN_PRODUCTION=1` is set.

Demo customers use phone numbers starting `+96090100`, which is how the seed
recognises its own data. Nothing else is touched.

To work with your own products instead, drop folders into `./stock` and:

```bash
npm run stock:sync            # or press SYNC STOCK in /admin
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm start` | Production server |
| `npm run typecheck` | TypeScript, no emit |
| `npm run stock:sync` | Sync STOCK from the command line |
| `npm run stock:images` | Regenerate placeholder product images (`-- --force` to overwrite) |
| `npm run db:seed` | Load the demo catalogue, customers and orders |
| `npm run admin:create` | Create or reset an admin user |
| `npm run bootstrap` | First-boot provisioning (admin + demo data); runs automatically in the container |
| `npm run test:e2e` | End-to-end test of the order and inventory flows |

---

## Storage providers

Set `STORAGE_PROVIDER` to choose where STOCK lives.

### `local` (development, or a synced folder on the server)

```env
STORAGE_PROVIDER="local"
LOCAL_STOCK_PATH="./stock"
```

### `google-drive` (production)

Uses the official Drive API v3 — nothing is scraped.

1. Create a Google Cloud project and enable the **Google Drive API**.
2. Create a **service account** and download its JSON key.
3. In Drive, share **only the STOCK folder** with the service account's email
   address, as **Viewer**. This is what keeps access least-privilege: the
   service account is read-only and cannot see anything else in the owner's
   Drive.
4. Copy the STOCK folder id from its URL
   (`drive.google.com/drive/folders/<THIS>`).

```env
STORAGE_PROVIDER="google-drive"
GOOGLE_DRIVE_STOCK_FOLDER_ID="…"
GOOGLE_SERVICE_ACCOUNT_EMAIL="store-sync@project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"
```

Images are streamed through `/api/images/[id]` rather than hot-linked, so the
Drive folder stays private and credentials never reach the browser.

**Adding another provider** means writing one class against `StorageProvider`
(`src/lib/storage/types.ts`) and adding a case in `src/lib/storage/index.ts`.
No parser, sync or UI code changes.

---

## OTP / SMS

No SMS provider is hardcoded. Choose one with `OTP_PROVIDER`:

- **`console`** — prints the code to the server log. Development only; the app
  refuses to start in production with this setting.
- **`http`** — POSTs `{to, from, message}` as JSON with a bearer token. Most
  gateways fit this shape; anything unusual needs one new class in
  `src/lib/otp/sender.ts`.
- **`demo`** — sends nothing; the code is returned to the browser and shown on
  screen. For public demos only — it lets anyone sign in as any phone number.
  See the deployment section.

```env
OTP_PROVIDER="http"
SMS_HTTP_ENDPOINT="https://sms-provider.mv/api/send"
SMS_HTTP_API_KEY="…"
SMS_SENDER_ID="STOCKCO"
```

Tunables: `OTP_LENGTH`, `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`,
`OTP_RESEND_COOLDOWN_SECONDS`, `OTP_MAX_SENDS_PER_HOUR`.

---

## Payments

`PAYMENT_PROVIDER` selects the adapter:

- **`manual`** (default) — bank transfer and cash on delivery. The order is
  created **unpaid**; a staff member marks it paid in the admin panel after
  seeing the money.
- **`gateway`** — hosted card checkout. Written against the common
  create-session → redirect → verify → webhook shape; map it to the real
  provider in `src/lib/payments/gateway-provider.ts` when one is chosen.

```env
PAYMENT_PROVIDER="gateway"
PAYMENT_GATEWAY_ENDPOINT="https://gateway.example.mv/v1"
PAYMENT_GATEWAY_MERCHANT_ID="…"
PAYMENT_GATEWAY_API_KEY="…"
PAYMENT_GATEWAY_WEBHOOK_SECRET="…"
```

An order is **never** marked paid from a browser success screen. Only
server-side verification or a signature-checked webhook can do it.

---

## Architecture

```
src/
├── app/                     Next.js App Router
│   ├── actions/             Server actions (cart, checkout, account, admin)
│   ├── admin/               Admin dashboard, products, orders, customers, settings
│   ├── api/images/[id]/     Streams product images from the storage provider
│   ├── account/             Customer account, orders, address, profile
│   ├── checkout/  cart/  order/  product/  shop/  search/  pages/
├── components/              UI, grouped by area
└── lib/
    ├── storage/             StorageProvider abstraction + local & Drive
    ├── products/            parser (metadata → product), schema, sync service
    ├── orders/              Order placement, stock reservation, payments state
    ├── payments/            PaymentProvider abstraction + manual & gateway
    ├── auth/                OTP, sessions, admin passwords, cookie names
    ├── otp/                 SMS sender abstraction
    ├── catalog.ts           Storefront read model
    ├── cart.ts              Server-side cart
    └── settings.ts          Business configuration with typed defaults
```

**Separation that matters:** the parser knows nothing about the database or the
UI, the storage layer knows nothing about products, and the sync service is the
only thing that writes product content. Changing the naming convention means
editing `src/lib/products/parser.ts` and nothing else.

### Data ownership

| Owned by STOCK (sync writes) | Owned by the database (sync never writes) |
|---|---|
| name, price, sizes, colours, description, images, active/featured flags | stock levels, carts, orders, payments, customers, addresses |

---

## Security

- **Passwordless customers.** Identity is a verified phone number. There is no
  customer password to leak.
- **OTP.** Codes come from a CSPRNG, are stored only as a salted hash, expire in
  minutes, are capped for attempts, throttled per phone and per client, and are
  compared in constant time. Verifying mints a **single-use token** that
  checkout requires — a client cannot claim a phone number it has not proven.
- **Sessions.** 256-bit cookie tokens; only their SHA-256 hash is stored.
  `httpOnly`, `sameSite=lax`, `secure` in production.
- **Admin.** scrypt password hashing, rate-limited login, identical error text
  for unknown user and wrong password. Every admin server action re-checks
  authorisation — the page guard alone is not the boundary.
- **Overselling.** Stock is decremented by a conditional update inside a
  serializable transaction, so two simultaneous buyers of the last item cannot
  both succeed.
- **Customer isolation.** Every account and order query is scoped by the
  signed-in customer id; order numbers are not a way in.
- **Images.** Served by internal image-row id, so only images this catalogue
  references are reachable — a guessed Drive file id is not.
- **Secrets.** Server-side only, via environment variables, never in client
  code. `.env` is gitignored.

---

## Deployment

The app ships a `Dockerfile` and a `render.yaml` blueprint. Any container host
works — Render, Railway, Fly.io, Cloud Run — as does a plain Node host running
`npm start`.

### Fastest path: Render blueprint

`render.yaml` provisions the web service and a PostgreSQL database together and
wires `DATABASE_URL` between them.

1. Push this repository to your GitHub account.
2. Go to **Render → New → Blueprint**, pick the repository, and apply.
3. Set the environment variables the blueprint leaves blank (`sync: false`):
   - `APP_URL` — the service URL Render assigns, e.g.
     `https://mensstore.onrender.com`
   - `OTP_PROVIDER`, `SMS_HTTP_ENDPOINT`, `SMS_HTTP_API_KEY` — see below
4. Set `ADMIN_INITIAL_PASSWORD` (12+ characters) in the service's Environment
   tab. That is the `/admin` login.

That is the whole setup — **no shell commands**. Render's free plan has no web
shell, so the container provisions itself on first boot: it applies migrations,
creates the admin user from `ADMIN_INITIAL_USERNAME` / `ADMIN_INITIAL_PASSWORD`,
and loads the demo catalogue when `SEED_DEMO_DATA=1`.

Both steps skip themselves once done. Seeding only runs while the catalogue is
empty, so an instance waking from sleep does not wipe and rebuild its own demo
orders. Clear `ADMIN_INITIAL_PASSWORD` from the environment once the user exists.

To load your own products instead, set `SEED_DEMO_DATA=0`, point
`STORAGE_PROVIDER` at Google Drive, and press **SYNC STOCK** in the admin.

`SESSION_SECRET` is generated by Render. The free database plan expires after 30
days — fine for a demo, not for a real store.

## Two blues

`--color-electric` (#3d7bff) is the **accent**: links, focus rings, anything
drawn *on* the dark ground, where it needs to be light enough to read against
near-black.

`--color-electric-deep` (#1358ff) is the **surface**: the demo banner, the Sale
sticker, `btn-electric`, the cart count badges — anything that carries white
text. White on the lighter blue measures 3.84:1, and 9–11px type needs 4.5:1.

Getting this backwards is not visible by eye; it took a contrast pass over every
page to find it.

## `text-white` does not mean white

Tailwind v4 resolves `text-white` to the **`--color-white` theme token**, and
this store redefines that token to `#17171d` — its raised dark surface. So every
`text-white` in the codebase quietly became dark type: the demo banner went
black on blue, and a product's price disappeared into its own photograph.

Use **`text-chalk`** (`--color-chalk: #ffffff`) for type that must be white
whatever the theme does — the electric-blue banners, and anything laid over a
photograph. `--color-white` stays the surface it is named for.

The same trap applies to `bg-white`, which is why none remain in the codebase.

## The rail that broke the phone

Worth writing down, because it looked like a styling bug and was not, and
because desktop Chrome says the page is fine at every width.

A horizontally scrolling rail is a scroll container, so its cards are clipped —
but they still contribute their **max-content width** to the initial containing
block, and mobile browsers size the *layout viewport* from that. Four rails of
nine cards pushed the layout viewport to 1572px on a 393px phone. Every
`position: fixed` element is laid out against that viewport, so the bottom
navigation became 1572px wide with five 314px tabs and only HOME was on screen.

Things that did **not** fix it, all measured under Pixel 5 emulation:

| attempt | layout viewport |
|---|---|
| baseline | 1572px |
| `overflow-x: clip` on the root | 1572px |
| `max-width: 100%` on the rail | 1572px |
| `grid-auto-columns` in `vw` not `%` | 1572px |
| parent section `overflow: hidden` | 1572px |
| **`contain: paint` on the rail** | **393px** |

`contain: paint` states what is already true — descendants never paint outside
this box — which is what stops the contribution at the rail.

The root `overflow-x: clip` is deliberately *not* kept as a safety net. It made
`documentElement.scrollWidth` read 390 while the phone was still broken, so it
would have hidden the next bug of this kind instead of surfacing it.

Two related layout notes:

* The fixed nav's bottom clearance lives **below the footer**, not as padding on
  `<main>`. On `<main>` it opened a dead band between the last section and the
  footer *and* still left the footer's final line under the nav.
* The hero headline sits on near-black under the eclipse, not across it, and a
  scrim seals the bottom of the ring. White type laid over the middle of a
  chromatic torus crosses four hues and reads against none of them.

## The surface treatment

The storefront is built on the "grainient" look the store owner asked for: a
near-black ground, one large iridescent gradient form, heavy film grain, and
type kept quiet enough that the colour carries the page.

That replaced the comic-panel treatment the original brief specified — hard
2.5px borders and offset shadows on every card. The two cannot coexist: against
a moving iridescent ground, a black drop shadow turns each card into a cut-out
and the colour behind stops reading as one continuous field. Surfaces are now
glass — a hairline of light over a translucent fill, with a backdrop blur — so
the ground shows through them, which is the whole trick of the look.

**The iridescent sweep** is one hue circuit (`--iris-1` … `--iris-7`): blue
through violet, magenta, ember, amber, and back via cyan. Every gradient in the
store draws from that one list, which is what keeps a dozen ad-hoc gradients
from drifting apart.

**The eclipse** in the hero is a chromatic torus masked out of a conic sweep
rather than drawn as a ring, so the hue travels continuously around it instead
of being cut into segments. The headline sits *below* it, not across it: type
laid over the middle of the ring crosses six hues and is legible against none of
them.

**The grain** is not decoration. A smooth 8-bit gradient across a phone screen
bands into visible steps, and dithering it with noise is the oldest fix there
is. It also does the thing the aesthetic is named for — a gradient with grain in
it reads as a surface, one without reads as a spotlight. It sits above the
background and below every piece of type, because an overlay blend chews into
small text.

**The background field is held right down** (a 0.30 multiplier in the shader).
The eclipse is the one thing on the page allowed to be bright; when the field
competes with it, the whole ground lifts to grey and the near-black this design
depends on is gone.

## Dark by default

The store is dark, and dark only — there is no light theme and no toggle.

Tokens are named for their **role**, not their literal colour, which is why
`--color-ink` is a pale grey: it is the foreground, meaning type, borders, and
the offset shadows the comic-card system casts. A light offset shadow on a dark
ground is the same device the light theme used, read the other way round.

Going dark meant splitting three roles that had each been doing two jobs which
stop agreeing once the ground is dark:

| token | what it is for |
|---|---|
| `--color-slab` | a deliberately dark bar or hero — the header, the footer, `btn-dark`. Not the same thing as "foreground", though both used to be `ink`. |
| `--color-on-slab` | type sitting on one of those |
| `--color-line` | hairline rules and inactive tracks, which want a dark grey exactly where dim type wants a light one |

Yellow is the one surface that stays bright in a dark theme, so anything on it
takes `--color-slab`, not the foreground. Getting that wrong is what put white
type on the yellow "Shop now" button in the first pass.

### The fluid background

Two layers, behind every page, mounted once in the root layout so they carry
across navigation instead of restarting.

The base is three blurred radial gradients on long transform animations. It is
painted server-side, so it is what a visitor sees before JavaScript runs, on a
device without WebGL, and under `prefers-reduced-motion` — in which case it
simply stays put.

Over it, `FluidCanvas` runs a domain-warped noise field: one fragment shader on
a single fullscreen triangle, one draw call per frame, no geometry and no
textures. The output of one fbm displaces the input of the next, and that
feedback is what makes the bands fold over each other like something being
stirred rather than slide past like fog.

It is not a Navier-Stokes solver; it is the look of one, which is what a
background behind product photography actually needs. A real solver means a
velocity field, a pressure solve and several render targets per frame, on phones
over mobile data.

Four things keep it from being a battery tax: a half-resolution buffer capped at
1.5× device pixels (the field is all low-frequency, so nobody can see the
difference), ~30fps rather than the display refresh rate, a full stop when the
tab is hidden, and never starting at all under reduced motion or without WebGL.

Both layers blend with `screen` rather than fading with opacity, because on a
near-black ground opacity turns the brand colours to grey silt where they
overlap. A faint noise layer sits on top: without it the blurred fields band
visibly, especially on OLED phone screens.

### Typography

| role | face | why |
|---|---|---|
| headings | Anton | a tall condensed grotesque with the proportions of a fly-poster — the right register for streetwear, and thick enough not to bloom and thin out against near-black |
| body | Manrope, 500 | light-on-dark type optically thins, so 500 here reads the way 400 reads on white; wide apertures and a tall x-height keep a size run legible at 10px |
| wordmark | Archivo Black | the logo is a wide varsity block and Anton is condensed; sharing one face between them would make the mark something it is not |

Anton ships a single weight, so headings ask for 400 — requesting 900 makes the
browser synthesise a bold it does not have and smears the stems. It is also
condensed, so it takes positive tracking where a wide face would carry the
negative tracking the light theme used.

None of these actually loaded until this was written down: `globals.css` asked
for the literal family `"Archivo Black"`, but `next/font` exposes a generated
name through a CSS variable and never registers the plain one. Every page had
been rendering in its fallback.

### The wordmark

`src/components/brand/factory-logo.tsx` draws the logo as SVG rather than
serving an image: no public directory (which this container does not have), no
second request per page, no file per density, and its colours come from the same
tokens as everything else so it cannot drift out of the palette. The arch is
real text on a path, not outlines, so it stays selectable and its accessible
name comes from the type itself.

Its geometry is worked out rather than eyeballed, because the first version was
not: a quadratic sits at `(P0 + 2·P1 + P2)/4` at its midpoint, so an arc from
`(14,80)` through control `(150,4)` crests at y=42 — and 58px type has roughly
42px of cap height above its baseline, which put the tops of the middle letters
at y=0 and cropped them against the viewBox edge. The current arc crests at 65
with 39px caps, leaving 26px of clear space, and the ribbon finishes at 132
inside a 140-tall box.

It appears in the header and the footer, and both are links to `/`.

### Round marks on square files

Round artwork arrives on a square canvas, and the corners of that canvas are
almost never transparent — the roundel is a dark disc on a cream field, which
put a cream square around the mark everywhere it appeared.

`.brand-round` clips to a circle **and** scales the image slightly past the
frame, so the disc's own edge reaches the crop. The overscan is the part that
matters: a plain `border-radius` still leaves a ring of canvas between the
artwork and the clip. It is applied unconditionally because it is harmless on
art that is already circular or transparent.

### How tall the hero is, and why it is not 100svh

The promo bar and header sit *above* the hero, so a hero the full height of the
viewport ends that much below the fold. At `100svh` the headline and SHOP NOW
were both off screen.

Measured on a Pixel 5: that chrome is 142px of 727, leaving **80svh**. The demo
banner is 47px of it, so a live store gets 87svh and a little of the next
section shows — which is the right cue that there is more below.

The hero also carries `pb-24` on mobile to clear the fixed bottom navigation.
Without it the call to action sits *inside* the viewport and *underneath* the
bar: it measures as visible and is not, which is exactly what the first version
of the check reported.

### Uploading your own artwork

**Admin → Settings → Brand images.** Two slots — the wordmark (header and
footer) and the roundel (homepage hero). PNG, JPG, WebP or SVG, up to 2MB.
Upload replaces the drawn mark everywhere it appears, immediately; Remove puts
the drawing back.

The bytes live in Postgres, not `./public`, for the same reason product uploads
do: a container on a free plan has no persistent filesystem, so anything written
to disk is gone on the next deploy. That also means changing the logo needs no
commit and no redeploy.

`/api/brand/[key]` serves them, with the file's checksum as the ETag — so
replacing the logo busts browser caches instead of leaving the old one up for a
day. The slot name is checked against a fixed list rather than passed through,
so the route can only ever return the two rows it is meant to.

The drawn marks below are the fallback, not the default-forever: nothing is ever
missing on a fresh install, and there is no broken-image state.

### The roundel

`src/components/brand/factory-badge.tsx` is the stamped garment-label badge, in
the hole the hero's eclipse already leaves. That space is circular and
near-black by construction, so the mark needs no plate behind it and the ring
reads as a halo around it.

Two things about arcs, both learned by getting them wrong:

* `textPath` renders only the glyphs that fit on its path and **silently drops
  the rest**. The first arch was ~285 units for a word needing more, and
  FACTORY rendered as ACTOR — a letter gone from each end, with no error
  anywhere. The arch is now 303 units for 245 units of type, and there is a
  check in the screenshot pass that compares `getComputedTextLength()` against
  `getTotalLength()`.
* The lower arc sweeps the opposite way to the upper one. Drawn in the same
  direction, its text hangs upside down.

## Where products come from

The catalogue has one source, chosen by `STORAGE_PROVIDER`. Every provider is
read through the same five-method interface (`src/lib/storage/types.ts`), so the
parser, the sync service and the image route cannot tell them apart.

| `STORAGE_PROVIDER` | Products come from | Setup | Good for |
|---|---|---|---|
| `database` | Uploads through **Admin → Add product** | none | a free instance with no external account |
| `google-drive` | A Drive folder you manage | service account | managing stock from Drive on any device |
| `local` | The `stock/` folder in the image | rebuild to change | development, or a mounted volume |

Switching provider does not migrate anything. Products from the old source stay
in the catalogue until the next sync finds their folders gone and deactivates
them; order history is never affected either way.

### Option A — upload from the admin (`STORAGE_PROVIDER=database`)

Set `STORAGE_PROVIDER` to `database` in the hosting dashboard and redeploy.

A deployed store starts on `local`, showing the demo catalogue baked into the
image, because a brand new instance has nothing else to show. After the switch
those demo products stay put — sync refuses to deactivate anything when a scan
comes back empty, since that is far more likely to mean broken credentials than
an emptied catalogue. Upload your first real product and the source is no longer
empty, so the same sync clears the demo products out for you. **Admin → Add product** then
takes photos and details, writes them into the `StockFolder` / `StockFile`
tables, and runs a sync immediately — so the form reports the parser's verdict
on what you just submitted rather than saving something that silently never
appears.

Uploads share the database with your orders. On a free Postgres plan that is 1GB
for everything, so the admin lists the storage each product costs. Five 400KB
photos per product is roughly 2MB each — around 400 products before the ceiling
matters, and orders need room too.

Why the database rather than a disk: a container on a free plan has no
persistent filesystem. Anything written to `./stock` is gone on the next deploy
*and* on every wake from sleep. Postgres is the only durable, writable thing
such an instance has.

### Option B — Google Drive (`STORAGE_PROVIDER=google-drive`)

Manage the catalogue from a Drive folder, on any device, without touching the
app. Uses the official Drive API through a service account — it never scrapes,
and the credentials stay server-side.

1. **Create the folder.** In Drive, make a folder (call it `STOCK`) and put one
   subfolder per product inside it, in the format described above. Its ID is the
   last part of the URL: `drive.google.com/drive/folders/`**`1a2b3c…`**
2. **Create a service account.** In the [Google Cloud console](https://console.cloud.google.com),
   make a project, enable the **Google Drive API**, then
   IAM → Service Accounts → Create. Add a key, type JSON, and download it.
3. **Share the folder with it.** Open the JSON, copy `client_email`, and share
   the Drive folder with that address as **Viewer**. This is what grants access —
   least privilege, and read-only.
4. **Set four variables** in the hosting dashboard, then redeploy:

   ```
   STORAGE_PROVIDER                   google-drive
   GOOGLE_DRIVE_STOCK_FOLDER_ID       1a2b3c…            (from step 1)
   GOOGLE_SERVICE_ACCOUNT_EMAIL       …@….iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY -----BEGIN PRIVATE KEY-----\n…
   ```

   Paste the private key exactly as it appears in the JSON, `\n` escapes and
   all — the app converts them back to real newlines.
5. **Press SYNC STOCK** in the admin. The report names any folder it rejected
   and why, without blocking the rest.

Never commit the JSON key file, and never put any of these in `NEXT_PUBLIC_*`.

**Status:** the Drive provider is written and typed against the official
`googleapis` client, but has not been run against a live Drive account. Option A
has end-to-end test coverage; this one does not yet.

### The server has to bind 0.0.0.0

Next's standalone server picks its bind address from the environment:

```js
const hostname = process.env.HOSTNAME || '0.0.0.0'   // .next/standalone/server.js
```

Container runtimes set `HOSTNAME` to the container or pod name, which is the
worst possible value here, and it fails in two different ways:

* **Where the name resolves to a loopback address** the server starts, logs
  `✓ Ready`, and answers requests made to itself — while refusing every
  connection from the platform's proxy. The dashboard shows the service Live,
  the logs are clean, nothing restarts, and every visitor gets a 502.
* **Where the name does not resolve at all** the server exits(1) on
  `getaddrinfo ENOTFOUND` and the container restarts, forever.

The entry point therefore sets `HOSTNAME=0.0.0.0` itself, immediately before
starting the server, and logs the address it bound. Setting it with `ENV` in the
Dockerfile is not enough on its own — a platform injects its environment over
the image's, so the image's value loses. `SERVER_BIND_HOST` overrides it for a
deployment that genuinely needs one interface.

This is the failure that is invisible to local testing, because a local test
connects over loopback and loopback is the one address that works. Anything
verifying a container boots has to connect from another address to mean
anything.

### Booting inside 512MB

A free instance has 512MB and is stopped when idle, then started again on the
next visitor — so the entry point runs on every wake, not just on deploys. Both
facts have to be designed around, and getting this wrong is not subtle: it took
the deployed store down for hours.

**What went wrong.** Provisioning ran alongside the web server, and the steps
nested: the bootstrap spawned the seed, and the seed spawned the image
generator. On a first boot that is five Node processes at once — measured at
**809MB** in a 512MB instance. The kernel killed the container mid-seed, which
left the catalogue empty, so the next boot seeded again, and again. The service
reported Live and served nothing but 502.

**How it works now.** Each step runs as its own top-level process, one at a
time, *before* the server starts, and only when a probe says it is outstanding:

| boot | steps run | peak RSS | port bound |
|---|---|---|---|
| first (empty database) | migrate, admin, seed | 279MB | 5.0s |
| wake, `ADMIN_INITIAL_PASSWORD` set | admin | 180MB | 1.2s |
| wake, fully provisioned | none | 82MB | 0.7s |

Provisioning before the server is the opposite of the obvious ordering, and it
is deliberate. Migrations peak at 225MB and the seed at 275MB; the server is
another 225MB. Running them alongside it needs more than the instance has.
Running them before it gives each one the whole instance. The cost — a first
boot that binds the port late — is paid exactly once, because afterwards the
probe reports nothing and no step runs at all.

The probe (`scripts/provision-check.mjs`) asks Postgres what is actually
outstanding using the client the server would load anyway: about 80MB and a
fraction of a second. It compares the migrations baked into the image against
`_prisma_migrations`, then checks the admin user and the catalogue. It fails
open — an unreachable database, a missing table, a client that will not load all
report every step, so a probe that cannot answer does the work rather than
skipping it. Every step is also bounded by a timeout, so a hung one cannot stop
the server from ever starting.

One thing keeps a step running on every wake: `ADMIN_INITIAL_PASSWORD` being
set. That variable is how the admin password is rotated on a host with no shell,
so the probe cannot treat it as already applied. Clearing it once the admin user
exists — which the deploy checklist asks for anyway — is what gets you the 82MB
column.

The health check points at `/api/health`, which touches no database, so the
platform sees a healthy service the moment the port binds.

### Spin-down is separate

None of the above stops a free instance from sleeping after about fifteen
minutes of inactivity. The first visitor after that still waits for a cold
start, and Render's own dashboard warns of "50 seconds or more". The two ways
out are an external uptime pinger hitting `/api/health` more often than every
fifteen minutes, or a paid instance type, which does not sleep.

A pinger is also a useful monitor: point it at `/api/health` rather than `/`,
and a failure tells you something real. 502 means no container is running; 500
means the container is up and the database is not.

### Checkout needs an SMS provider — or demo mode

Phone verification is the one step that cannot work without an SMS gateway. The
app **refuses to start in production with `OTP_PROVIDER="console"`**, because
that provider prints verification codes to the server log.

For a real store, configure a Maldivian SMS gateway:

```env
OTP_PROVIDER="http"
SMS_HTTP_ENDPOINT="https://your-provider/api/send"
SMS_HTTP_API_KEY="…"
```

For a **public demo** with no gateway, `OTP_PROVIDER="demo"` sends nothing and
displays the code on screen instead, so anyone can be taken through the whole
purchase flow. The Render blueprint uses this by default.

> **Demo mode is an authentication bypass.** Anyone can sign in as any phone
> number, and so read that customer's orders and saved address. It exists only
> so the store can be shown to people. Every page carries a permanent banner
> saying so, and the server logs a warning at startup. Switch to `http` with a
> real gateway before taking a single real order.

### Docker directly

```bash
docker build -t mensstore .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://…" \
  -e SESSION_SECRET="$(openssl rand -base64 48)" \
  -e APP_URL="https://your-domain" \
  -e OTP_PROVIDER="http" -e SMS_HTTP_ENDPOINT="…" -e SMS_HTTP_API_KEY="…" \
  mensstore
```

The image builds without a database: settings fall back to their defaults during
`next build`, and placeholder product images are generated into the image so the
catalogue renders without a writable disk. Run `npx prisma migrate deploy`
against the database once before the first start.

### Plain Node host

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start                    # binds $PORT
```

**Checklist**

- [ ] `DATABASE_URL` points at production PostgreSQL
- [ ] `SESSION_SECRET` is a fresh 32+ character random string
      (`openssl rand -base64 48`)
- [ ] `APP_URL` is the real HTTPS origin (used for SEO, sitemap, payment return)
- [ ] HTTPS enforced at the host or proxy
- [ ] `STORAGE_PROVIDER=google-drive` with the STOCK folder shared read-only
      (or keep `local` and deploy the folder with the image)
- [ ] `OTP_PROVIDER=http` with real SMS credentials — the app refuses to boot
      with the console provider
- [ ] `PAYMENT_PROVIDER` configured, gateway mapping verified against the real
      provider's API
- [ ] `npx prisma migrate deploy` run against production
- [ ] Admin user created, `ADMIN_INITIAL_PASSWORD` removed from the environment
- [ ] First `SYNC STOCK` run and the catalogue checked
- [ ] Store settings filled in (contact details, delivery areas and fees)
- [ ] Legal pages replaced with real policy text

Optional housekeeping (a daily cron): `pruneExpiredSessions()`,
`pruneExpiredOtps()`, `pruneRateLimits()`.

---

## Still to be supplied by the store owner

These are deliberately left as placeholders — the application invents no
business facts:

brand name and logo · final brand colours · real product photos · the SMS
provider · the payment provider · delivery areas and fees · contact details ·
business address · domain and hosting · legal policy text.

Everything except the brand assets and legal text is editable from
**Admin → Settings** without a code change.
