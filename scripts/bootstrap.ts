/**
 * First-boot provisioning, for hosts where there is no shell.
 *
 * Render's free plan has no web shell, so `db:seed` and `admin:create` cannot be
 * run by hand after a deploy. This runs from the container entrypoint instead
 * and is driven entirely by environment variables, which the dashboard can set
 * on any plan.
 *
 * Both steps are conditional and safe to run on every boot:
 *   * the admin user is upserted only when credentials are supplied,
 *   * demo data is loaded only when SEED_DEMO_DATA=1 *and* the catalogue is
 *     empty, so a free instance waking from sleep does not re-seed itself and
 *     wipe the demo orders every time.
 *
 * Steps can be selected with --admin and --seed; with neither, both run. The
 * container entrypoint names the step it wants and runs the seed as its own
 * top-level process, because nesting them cost more memory than a 512MB
 * instance has: server + bootstrap + seed + image generation, all at once, was
 * measured at 809MB and the kernel killed the container mid-seed. The kill left
 * the catalogue empty, so the next boot seeded again — a loop that never ended.
 *
 * Usage: npm run bootstrap [-- --admin | --seed]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

import { hashPassword } from "../src/lib/auth/password";
import { db } from "../src/lib/db";

async function ensureAdmin(): Promise<void> {
  const username = process.env.ADMIN_INITIAL_USERNAME?.trim();
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!username || !password) {
    const existing = await db.adminUser.count();
    console.log(
      existing > 0
        ? `[bootstrap] ${existing} admin user(s) already exist`
        : "[bootstrap] no admin user — set ADMIN_INITIAL_USERNAME and ADMIN_INITIAL_PASSWORD to create one",
    );
    return;
  }

  if (password.length < 12) {
    console.error("[bootstrap] ADMIN_INITIAL_PASSWORD must be at least 12 characters — skipping");
    return;
  }

  await db.adminUser.upsert({
    where: { username },
    create: { username, passwordHash: await hashPassword(password), role: "admin" },
    update: { passwordHash: await hashPassword(password), active: true },
  });

  console.log(`[bootstrap] admin ready: ${username}`);
  console.log("[bootstrap] remove ADMIN_INITIAL_PASSWORD from the environment now that it is set");
}

async function ensureCatalogue(): Promise<void> {
  if (process.env.SEED_DEMO_DATA !== "1") {
    console.log("[bootstrap] SEED_DEMO_DATA is not 1 — leaving the catalogue alone");
    return;
  }

  const products = await db.product.count();
  if (products > 0) {
    console.log(`[bootstrap] catalogue already has ${products} product(s) — not re-seeding`);
    return;
  }

  console.log("[bootstrap] empty catalogue — loading demo data…");

  // Runs the same seed script a developer would, rather than a second
  // implementation that could drift from it.
  const result = spawnSync(
    process.execPath,
    [path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs"), "scripts/seed.ts"],
    {
      encoding: "utf8",
      env: { ...process.env, ALLOW_SEED_IN_PRODUCTION: "1" },
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    console.error("[bootstrap] seeding failed — the store will start with an empty catalogue");
  }
}

async function main() {
  const wantsAdmin = process.argv.includes("--admin");
  const wantsSeed = process.argv.includes("--seed");
  // Neither flag means "do everything", which is what a developer running
  // `npm run bootstrap` by hand expects.
  const all = !wantsAdmin && !wantsSeed;

  if (all || wantsAdmin) await ensureAdmin();
  if (all || wantsSeed) await ensureCatalogue();
}

main()
  .catch((error) => {
    // Never block startup: a serving store with a bootstrap problem is far more
    // useful than no store at all, and the logs say what happened.
    console.error(
      "[bootstrap] failed:",
      error instanceof Error ? error.message : error,
    );
  })
  .finally(() => db.$disconnect());
