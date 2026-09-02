/**
 * Cheap "is there anything to do?" probe, run before the expensive boot work.
 *
 * On a free instance the container is stopped when idle and started again on
 * the next visitor, so the entrypoint runs on *every* wake — not just on
 * deploys. Each provisioning step is a Node process of its own, peaking around
 * 200MB, started alongside a server that is trying to answer the request that
 * woke it, inside a 512MB instance. Every step is a no-op after the first boot,
 * and paying for them on every wake is the difference between a visitor waiting
 * and a visitor seeing 502.
 *
 * This probe answers the question with the client the server already uses, for
 * about 80MB and a fraction of a second: it compares the migrations baked into
 * the image against the ones Postgres says are applied, then checks the admin
 * user and the catalogue. It prints one line per outstanding job — "migrate",
 * "admin", "seed" — and nothing at all when the instance is ready.
 *
 * The steps are reported separately because the entrypoint runs them
 * separately. Nesting them (bootstrap spawning the seed, the seed spawning the
 * image generator) put five Node processes and 809MB into a 512MB instance,
 * which the kernel resolved by killing the container mid-seed — leaving the
 * catalogue empty, so the next boot did it all again.
 *
 * It fails OPEN: any error at all reports every step, so a probe that cannot
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
 * Is the admin user step outstanding?
 *
 * Deliberately conservative about the password: whenever ADMIN_INITIAL_PASSWORD
 * is present this reports work to do, because that variable is how the password
 * is rotated on a host with no shell and the probe has no way to tell a rotated
 * password from the current one without re-implementing the hashing. Clearing
 * the variable once the admin exists — which the bootstrap itself asks the
 * operator to do — is what makes the step free.
 */
async function adminNeeded(prisma) {
  if (ADMIN_INITIAL_PASSWORD) return "ADMIN_INITIAL_PASSWORD is set — applying it";
  if ((await prisma.adminUser.count()) === 0) return "no admin user yet";
  return null;
}

async function seedNeeded(prisma) {
  if (SEED_DEMO_DATA !== "1") return null;
  if ((await prisma.product.count()) > 0) return null;
  return "SEED_DEMO_DATA is 1 and the catalogue is empty";
}

async function main() {
  const baked = bakedMigrations();
  if (baked.length === 0) {
    // No migrations in the image is a packaging fault, not an up-to-date
    // database. Say so and let the CLI produce the real error.
    everything();
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ log: [] });
  try {
    const applied = await appliedMigrations(prisma);
    const pending = baked.filter((name) => !applied.has(name));

    if (pending.length > 0) {
      console.error(`[probe] ${pending.length} migration(s) pending: ${pending.join(", ")}`);
      // The tables the other checks read may not exist yet, so nothing can be
      // ruled out: report every step.
      everything();
      return;
    }

    console.error(`[probe] schema is current (${baked.length} migrations applied)`);

    const admin = await adminNeeded(prisma);
    const seed = await seedNeeded(prisma);

    if (admin) {
      console.error(`[probe] admin step needed: ${admin}`);
      console.log("admin");
    }
    if (seed) {
      console.error(`[probe] seed step needed: ${seed}`);
      console.log("seed");
    }
    if (!admin && !seed) {
      console.error("[probe] already provisioned");
    }
  } finally {
    await prisma.$disconnect();
  }
}

/** Every step, for the paths where nothing can be ruled out. */
function everything() {
  console.log("migrate");
  console.log("admin");
  console.log("seed");
}

main().catch((error) => {
  // An unreachable database, a missing _prisma_migrations table, a client that
  // will not load: all of them mean "do the work and let the real tool report".
  console.error(
    "[probe] could not determine schema state:",
    error instanceof Error ? error.message : error,
  );
  everything();
});
