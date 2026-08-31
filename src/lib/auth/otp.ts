import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getOtpSender } from "@/lib/otp/sender";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Phone verification.
 *
 * Security properties, all enforced here rather than in route handlers:
 *   * Codes come from randomInt (CSPRNG), never Math.random.
 *   * Only a salted SHA-256 hash is stored; the plain code exists solely in the
 *     SMS payload and is never written to a log or the database.
 *   * Short expiry, capped attempts, resend cooldown, and per-phone and per-IP
 *     hourly send limits.
 *   * Comparison is constant-time, so a wrong code leaks no timing information.
 *   * Verifying mints a single-use token; checkout will not create an order
 *     without one, which is what stops a client from claiming a phone it has
 *     not proven it controls.
 */

export type OtpPurpose = "checkout" | "login";

export type SendOtpResult =
  | { ok: true; expiresAt: Date; resendAvailableAt: Date }
  | { ok: false; error: string; retryAfterSeconds?: number };

export type VerifyOtpResult =
  | { ok: true; verifiedToken: string }
  | { ok: false; error: string; attemptsRemaining?: number };

function hashCode(code: string, phone: string): string {
  // Salting with the phone number stops one rainbow table from covering every
  // challenge, given the code space is only 10^4.
  return createHash("sha256")
    .update(`${phone}:${code}:${env().SESSION_SECRET}`)
    .digest("hex");
}

function generateCode(length: number): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += randomInt(0, 10).toString();
  }
  return code;
}

export async function sendOtp(
  phone: string,
  purpose: OtpPurpose,
  clientKey: string,
): Promise<SendOtpResult> {
  const config = env();

  // Two limiters: one stops a single number being spammed (cost + nuisance to
  // its owner), the other stops one client enumerating many numbers.
  const phoneLimit = await checkRateLimit(
    `otp:send:phone:${phone}`,
    config.OTP_MAX_SENDS_PER_HOUR,
    3600,
  );
  if (!phoneLimit.allowed) {
    return {
      ok: false,
      error: "Too many codes requested for this number. Please try again later.",
      retryAfterSeconds: phoneLimit.retryAfterSeconds,
    };
  }

  const clientLimit = await checkRateLimit(
    `otp:send:client:${clientKey}`,
    config.OTP_MAX_SENDS_PER_HOUR * 3,
    3600,
  );
  if (!clientLimit.allowed) {
    return {
      ok: false,
      error: "Too many verification attempts. Please try again later.",
      retryAfterSeconds: clientLimit.retryAfterSeconds,
    };
  }

  const cooldownCutoff = new Date(
    Date.now() - config.OTP_RESEND_COOLDOWN_SECONDS * 1000,
  );
  const recent = await db.otpChallenge.findFirst({
    where: { phone, purpose, consumedAt: null, createdAt: { gt: cooldownCutoff } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const waitSeconds = Math.ceil(
      (recent.createdAt.getTime() + config.OTP_RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000,
    );
    return {
      ok: false,
      error: `Please wait ${waitSeconds}s before requesting another code.`,
      retryAfterSeconds: waitSeconds,
    };
  }

  // Any earlier unconsumed challenge for this phone is invalidated, so only the
  // newest code can ever be used.
  await db.otpChallenge.deleteMany({ where: { phone, purpose, consumedAt: null } });

  const code = generateCode(config.OTP_LENGTH);
  const expiresAt = new Date(Date.now() + config.OTP_TTL_SECONDS * 1000);

  await db.otpChallenge.create({
    data: { phone, purpose, codeHash: hashCode(code, phone), expiresAt },
  });

  try {
    await getOtpSender().send(phone, code);
  } catch (error) {
    // Do not leave a challenge the customer can never satisfy.
    await db.otpChallenge.deleteMany({ where: { phone, purpose, consumedAt: null } });
    console.error("[otp] delivery failed:", error instanceof Error ? error.message : error);
    return {
      ok: false,
      error: "We could not send the code right now. Please try again shortly.",
    };
  }

  return {
    ok: true,
    expiresAt,
    resendAvailableAt: new Date(
      Date.now() + config.OTP_RESEND_COOLDOWN_SECONDS * 1000,
    ),
  };
}

export async function verifyOtp(
  phone: string,
  purpose: OtpPurpose,
  code: string,
): Promise<VerifyOtpResult> {
  const config = env();

  const challenge = await db.otpChallenge.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    return { ok: false, error: "No verification in progress. Please request a new code." };
  }

  if (challenge.expiresAt < new Date()) {
    await db.otpChallenge.delete({ where: { id: challenge.id } });
    return { ok: false, error: "That code has expired. Please request a new one." };
  }

  if (challenge.attempts >= config.OTP_MAX_ATTEMPTS) {
    await db.otpChallenge.delete({ where: { id: challenge.id } });
    return { ok: false, error: "Too many incorrect attempts. Please request a new code." };
  }

  const submitted = Buffer.from(hashCode(code.trim(), phone), "hex");
  const expected = Buffer.from(challenge.codeHash, "hex");
  const matches =
    submitted.length === expected.length && timingSafeEqual(submitted, expected);

  if (!matches) {
    const updated = await db.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    const attemptsRemaining = Math.max(0, config.OTP_MAX_ATTEMPTS - updated.attempts);
    return {
      ok: false,
      error: attemptsRemaining > 0
        ? `Incorrect code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.`
        : "Too many incorrect attempts. Please request a new code.",
      attemptsRemaining,
    };
  }

  const verifiedToken = randomBytes(32).toString("base64url");
  await db.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date(), verifiedToken },
  });

  return { ok: true, verifiedToken };
}

/**
 * Redeems the token minted by verifyOtp. Single-use: the challenge row is
 * deleted, so replaying the same token cannot authorise a second order.
 */
export async function consumeVerifiedToken(
  token: string,
  phone: string,
): Promise<boolean> {
  const challenge = await db.otpChallenge.findUnique({
    where: { verifiedToken: token },
  });

  if (!challenge || challenge.phone !== phone || !challenge.consumedAt) {
    return false;
  }

  // Verified tokens are short-lived too — a checkout left open overnight must
  // re-verify rather than trusting yesterday's proof.
  const maxAge = 30 * 60 * 1000;
  if (Date.now() - challenge.consumedAt.getTime() > maxAge) {
    await db.otpChallenge.delete({ where: { id: challenge.id } });
    return false;
  }

  await db.otpChallenge.delete({ where: { id: challenge.id } });
  return true;
}

/** Housekeeping; safe to run from a cron job. */
export async function pruneExpiredOtps(): Promise<number> {
  const result = await db.otpChallenge.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 3600_000) } },
  });
  return result.count;
}
