/**
 * Cookie names, kept in their own module with no Node imports.
 *
 * Middleware runs on the Edge runtime, which has no `node:crypto`, so it must
 * not pull in session.ts. Importing the names from here keeps that boundary.
 */
export const CUSTOMER_COOKIE = "store_session";
export const ADMIN_COOKIE = "admin_session";
export const CART_COOKIE = "cart_token";
