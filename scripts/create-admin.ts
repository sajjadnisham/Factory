/**
 * Creates or resets the first admin user.
 * Usage: ADMIN_INITIAL_USERNAME=admin ADMIN_INITIAL_PASSWORD='…' npm run admin:create
 */
import { hashPassword } from "../src/lib/auth/password";
import { db } from "../src/lib/db";

async function main() {
  const username = process.env.ADMIN_INITIAL_USERNAME?.trim();
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Set ADMIN_INITIAL_USERNAME and ADMIN_INITIAL_PASSWORD before running this.",
    );
  }
  if (password.length < 12) {
    throw new Error("Admin password must be at least 12 characters.");
  }

  const passwordHash = await hashPassword(password);

  const admin = await db.adminUser.upsert({
    where: { username },
    create: { username, passwordHash, role: "admin" },
    update: { passwordHash, active: true },
  });

  console.log(`Admin ready: ${admin.username} (${admin.role})`);
  console.log("Sign in at /admin. Remove ADMIN_INITIAL_PASSWORD from your environment now.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
