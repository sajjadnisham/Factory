import { env } from "@/lib/env";

/**
 * Demo mode.
 *
 * With `OTP_PROVIDER="demo"` no SMS is sent — the verification code is returned
 * to the browser and displayed on screen, so a public demo can be taken all the
 * way through checkout without an SMS gateway.
 *
 * This is an authentication bypass. Anyone can claim any phone number, and so
 * read that customer's orders and saved address. It exists only so the store can
 * be shown to people, and every page carries a banner saying so. Never enable it
 * on a deployment holding real customer data.
 */
export function isDemoMode(): boolean {
  return env().OTP_PROVIDER === "demo";
}
