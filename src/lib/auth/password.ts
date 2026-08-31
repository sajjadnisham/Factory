import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// promisify() picks the first overload, which drops the options argument, so
// the signature is restated here to keep the cost parameters typed.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16_384, r: 8, p: 1 } as const;

/**
 * Admin password hashing (customers never have passwords — phone + OTP only).
 *
 * scrypt from node:crypto rather than bcrypt/argon2 so there is no native build
 * step in deployment. Format: scrypt$N$r$p$salt$hash, all base64.
 */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error("Admin password must be at least 12 characters.");
  }
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH, {
    ...SCRYPT_PARAMS,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;

  return [
    "scrypt",
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts as [
    string, string, string, string, string, string,
  ];
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");

  const derived = (await scryptAsync(password, salt, expected.length, {
    N: Number(nRaw),
    r: Number(rRaw),
    p: Number(pRaw),
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
