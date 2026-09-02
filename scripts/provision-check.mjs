/**
 * Cheap "is there anything to do?" probe, run before the expensive boot work.
 *
 * On a free instance the container is stopped when idle and started again on
 * the next visitor, so the entrypoint runs on *every* wake — not just on
 * deploys. `prisma migrate deploy` and the bootstrap script cost a second Node
 * process and roughly 200MB each, all of it alongside a server that is trying
 * to answer the request that woke it, inside a 512MB instance. Both are no-ops
 * on all but the first boot, and paying for them on every wake is the
 * difference between a visitor waiting and a visitor seeing 502.
 *
 * This probe answers the question with the client the server already uses, for
 * about 80MB and a fraction of a second: it compares the migrations baked into
 * the image against the ones Postgres says are applied, then checks whether the
 * bootstrap has anything left to do. It prints one line per outstanding job
 * ("migrate", "bootstrap"), and nothing at all when the instance is ready.
 *
 * It fails OPEN: any error at all prints the job anyway, so a probe that cannot
 * answer degrades to the old behaviour rather than skipping real work.
 */
import { readdirSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

// Read before @prisma/client is loaded, which is why the import of it below is
// dynamic: loading that package reads any .env file it finds into process.env,
// and a static import is evaluated before this module's body runs. The
// container has no .env (see .dockerignore), and snapshotting here means a
// stray one could never quietly decide what the probe reports.
const ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD;
const SEED_DEMO_DATA = process.env.SEED_DEMO_DATA;

function bakedMigrations() {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

async function appliedMigrations(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT migration_name FROM "_prisma_migrations" ' +
      "WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL",
  );
  return new Set(rows.map((row) => row.migration_name));
}

/**
 * Is there provisioning left to do?
 *
 * Deliberately conservative about the admin password: whenever
 * ADMIN_INITIAL_PASSWORD is present the bootstrap runs, because that variable
 * is how the password is rotated on a host with no shell and the probe has no
 * way to tell a rotated password from the current one without re-implementing
 * the hashing. Clearing the variable once the admin exists — which the
 * bootstrap itself asks the operator to do — is what makes this step free.
 */
async function bootstrapNeeded(prisma) {
  if (ADMIN_INITIAL_PASSWORD) {
    return "ADMIN_INITIAL_PASSWORD is set — applying it";
  }

  if ((await prisma.adminUser.count()) === 0) {
    return "no admin user yet";
  }

  if (SEED_DEMO_DATA === "1" && (await prisma.product.count()) === 0) {
    return "SEED_DEMO_DATA is 1 and the catalogue is empty";
  }

  return null;
}

async function main() {
  const baked = bakedMigrations();
  if (baked.length === 0) {
    // No migrations in the image is a packaging fault, not an up-to-date
    // database. Say so and let the CLI produce the real error.
    console.log("migrate");
    console.log("bootstrap");
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ log: [] });
  try {
    const applied = await appliedMigrations(prisma);
    const pending = baked.filter((name) => !applied.has(name));

    if (pending.length > 0) {
      console.error(`[probe] ${pending.length} migration(s) pending: ${pending.join(", ")}`);
      console.log("migrate");
      // The tables the bootstrap check reads may not exist yet.
      console.log("bootstrap");
      return;
    }

    console.error(`[probe] schema is current (${baked.length} migrations applied)`);

    const reason = await bootstrapNeeded(prisma);
    if (reason) {
      console.error(`[probe] bootstrap needed: ${reason}`);
      console.log("bootstrap");
    } else {
      console.error("[probe] already provisioned");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // An unreachable database, a missing _prisma_migrations table, a client that
  // will not load: all of them mean "do the work and let the real tool report".
  console.error(
    "[probe] could not determine schema state:",
    error instanceof Error ? error.message : error,
  );
  console.log("migrate");
  console.log("bootstrap");
});
