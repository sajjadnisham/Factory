import { z } from "zod";

/**
 * Server-side environment. Importing this module from a client component is a
 * build error by design — secrets must never cross the server/client boundary.
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Render injects RENDER_EXTERNAL_URL with the service's real public URL, so a
  // deployment works correctly even when APP_URL was guessed wrong or left
  // blank. An explicit APP_URL still wins.
  APP_URL: z.preprocess(
    (value) => value || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000",
    z.string().url(),
  ),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),

  STORAGE_PROVIDER: z.enum(["local", "google-drive"]).default("local"),
  LOCAL_STOCK_PATH: z.string().default("./stock"),
  GOOGLE_DRIVE_STOCK_FOLDER_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),

  OTP_PROVIDER: z.enum(["console", "http", "demo"]).default("console"),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(4),
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(15).default(60),
  OTP_MAX_SENDS_PER_HOUR: z.coerce.number().int().min(1).default(5),
  SMS_HTTP_ENDPOINT: z.string().optional(),
  SMS_HTTP_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),

  PAYMENT_PROVIDER: z.enum(["manual", "gateway"]).default("manual"),
  PAYMENT_GATEWAY_ENDPOINT: z.string().optional(),
  PAYMENT_GATEWAY_MERCHANT_ID: z.string().optional(),
  PAYMENT_GATEWAY_API_KEY: z.string().optional(),
  PAYMENT_GATEWAY_WEBHOOK_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * The site's public origin, for metadata, the sitemap and payment return URLs.
 *
 * Deliberately reads process.env directly instead of going through env(): these
 * callers run while pages are prerendered at build time, where the full
 * configuration (a database URL, a session secret) does not exist yet and
 * validating it would fail the build.
 */
export function appUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:3000"
  );
}

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nSee .env.example for the full list.`,
    );
  }

  const value = parsed.data;

  // Provider-specific requirements are only enforced for the provider actually
  // selected, so a local dev setup does not need Google or gateway credentials.
  if (value.STORAGE_PROVIDER === "google-drive") {
    requireAll(value, [
      "GOOGLE_DRIVE_STOCK_FOLDER_ID",
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    ]);
  }
  if (value.OTP_PROVIDER === "http") {
    requireAll(value, ["SMS_HTTP_ENDPOINT", "SMS_HTTP_API_KEY"]);
  }
  if (value.PAYMENT_PROVIDER === "gateway") {
    requireAll(value, [
      "PAYMENT_GATEWAY_ENDPOINT",
      "PAYMENT_GATEWAY_MERCHANT_ID",
      "PAYMENT_GATEWAY_API_KEY",
    ]);
  }
  if (value.NODE_ENV === "production" && value.OTP_PROVIDER === "console") {
    throw new Error(
      'OTP_PROVIDER="console" prints codes to the server log and must not be used in production. Configure a real SMS provider.',
    );
  }
  if (value.OTP_PROVIDER === "demo") {
    // Deliberately allowed in production so the store can be deployed as a
    // public demo, but it is an authentication bypass: anyone can claim any
    // phone number. The storefront carries a permanent banner saying so.
    console.warn(
      "\n" +
        "  ┌──────────────────────────────────────────────────────────────┐\n" +
        "  │  DEMO MODE — verification codes are shown on screen.         │\n" +
        "  │  Anyone can sign in as any phone number. Never point this     │\n" +
        "  │  deployment at a real store or real customer data.           │\n" +
        "  └──────────────────────────────────────────────────────────────┘\n",
    );
  }

  cached = value;
  return value;
}

function requireAll(value: ServerEnv, keys: (keyof ServerEnv)[]): void {
  const missing = keys.filter((k) => !value[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}
