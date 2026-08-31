import { db } from "@/lib/db";

/**
 * Fixed-window rate limiter backed by the database.
 *
 * Database-backed rather than in-memory because the app is expected to run on
 * more than one serverless instance, where an in-process counter would let an
 * attacker multiply their allowance by the number of instances.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStartCutoff = new Date(now.getTime() - windowSeconds * 1000);

  const existing = await db.rateLimit.findUnique({ where: { key } });

  if (!existing || existing.windowStart < windowStartCutoff) {
    await db.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    const elapsed = (now.getTime() - existing.windowStart.getTime()) / 1000;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(windowSeconds - elapsed)),
    };
  }

  const updated = await db.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return {
    allowed: true,
    remaining: Math.max(0, limit - updated.count),
    retryAfterSeconds: 0,
  };
}

/** Clears a limiter after the action it guards succeeds. */
export async function resetRateLimit(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Housekeeping for expired windows; safe to call from a cron job. */
export async function pruneRateLimits(olderThanSeconds = 86_400): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
  const result = await db.rateLimit.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return result.count;
}
