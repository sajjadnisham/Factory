import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { db } from "@/lib/db";

import { ADMIN_COOKIE, CART_COOKIE, CUSTOMER_COOKIE } from "./cookies";

/**
 * Cookie-based sessions for customers and admins.
 *
 * The cookie holds a 256-bit random token; the database stores only its SHA-256
 * hash, so a database read cannot be replayed as a login. Cookies are
 * httpOnly + sameSite=lax + secure in production, which covers both XSS token
 * theft and cross-site request forgery for state-changing POSTs.
 */

export { ADMIN_COOKIE, CART_COOKIE, CUSTOMER_COOKIE };

const CUSTOMER_SESSION_DAYS = 60;
const ADMIN_SESSION_HOURS = 12;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

// ---------------------------------------------------------------------------
// Customer sessions
// ---------------------------------------------------------------------------

export async function createCustomerSession(customerId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const maxAge = CUSTOMER_SESSION_DAYS * 24 * 3600;

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      customerId,
      expiresAt: new Date(Date.now() + maxAge * 1000),
    },
  });

  (await cookies()).set(CUSTOMER_COOKIE, token, cookieOptions(maxAge));
}

export interface CurrentCustomer {
  id: string;
  name: string;
  phone: string;
}

export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { customer: true },
  });

  if (!session?.customer || session.expiresAt < new Date()) return null;
  if (!session.customer.active) return null;

  return {
    id: session.customer.id,
    name: session.customer.name,
    phone: session.customer.phone,
  };
}

export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(CUSTOMER_COOKIE);
}

// ---------------------------------------------------------------------------
// Admin sessions
// ---------------------------------------------------------------------------

export async function createAdminSession(adminId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const maxAge = ADMIN_SESSION_HOURS * 3600;

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      adminId,
      expiresAt: new Date(Date.now() + maxAge * 1000),
    },
  });

  (await cookies()).set(ADMIN_COOKIE, token, cookieOptions(maxAge));
}

export interface CurrentAdmin {
  id: string;
  username: string;
  role: string;
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { admin: true },
  });

  if (!session?.admin || session.expiresAt < new Date()) return null;
  if (!session.admin.active) return null;

  return {
    id: session.admin.id,
    username: session.admin.username,
    role: session.admin.role,
  };
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(ADMIN_COOKIE);
}

/** Throws in server components and actions that must not run unauthenticated. */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("UNAUTHORIZED");
  return admin;
}

// ---------------------------------------------------------------------------
// Cart token (anonymous, pre-login)
// ---------------------------------------------------------------------------

export async function getOrCreateCartToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CART_COOKIE)?.value;
  if (existing) return existing;

  const token = randomBytes(24).toString("base64url");
  store.set(CART_COOKIE, token, cookieOptions(30 * 24 * 3600));
  return token;
}

export async function readCartToken(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

/** Removes expired session rows; safe to run from a cron job. */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await db.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
