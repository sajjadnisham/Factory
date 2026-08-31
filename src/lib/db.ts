import { PrismaClient } from "@prisma/client";

/**
 * Next.js dev-mode hot reload re-evaluates modules, so the client is cached on
 * globalThis to avoid exhausting the database connection pool.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
