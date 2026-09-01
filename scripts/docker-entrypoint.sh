#!/bin/sh
# Container entrypoint: bring the schema up to date, then serve.
#
# Migrations run here rather than in a Render preDeployCommand, because that is
# a paid-plan feature and this deploys on the free tier. `migrate deploy` is
# idempotent — it applies only pending migrations and is a no-op once the
# database is current — so running it on every boot is safe.
#
# Note for larger setups: with several instances starting at once, they would
# race here. Prisma takes an advisory lock so only one applies the migrations,
# but a dedicated release step is the better shape once you are off the free
# plan.
set -e

echo "[entrypoint] applying database migrations…"
if node node_modules/prisma/build/index.js migrate deploy; then
  echo "[entrypoint] migrations up to date"
else
  # Failing hard here would leave the service down with no way in. Serving is
  # better: the app still runs, and the logs say exactly what went wrong.
  echo "[entrypoint] WARNING: migrations failed — starting anyway, check DATABASE_URL" >&2
fi

# First-boot provisioning: creates the admin user and, when asked, loads the
# demo catalogue. Both are conditional and skip themselves once done, so this
# costs a fraction of a second on subsequent boots. It exists because Render's
# free plan has no shell to run them from by hand.
echo "[entrypoint] running bootstrap…"
node node_modules/tsx/dist/cli.mjs scripts/bootstrap.ts || \
  echo "[entrypoint] WARNING: bootstrap failed — starting anyway" >&2

echo "[entrypoint] starting server"
exec node server.js
