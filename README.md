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
