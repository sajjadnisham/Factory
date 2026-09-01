#!/bin/sh
# Container entrypoint.
#
# The server is started FIRST, before migrations and provisioning, so the port
# binds in about two seconds instead of fifteen. That matters on a free plan:
# the instance spins down when idle and cold-starts on the next visit, and every
# second spent before binding is a second of 502s for whoever is waiting.
#
# The health check points at /api/health, which touches no database, so the
# platform sees a healthy service immediately while the schema work finishes
# alongside it. Ordering only matters on a first deploy against an empty
# database, when there is no traffic to serve yet.
set -e

echo "[entrypoint] starting server"
node server.js &
SERVER_PID=$!

# Hand shutdown signals to the server so deploys and spin-downs are clean.
trap 'kill -TERM "$SERVER_PID" 2>/dev/null' TERM INT

# `migrate deploy` applies only pending migrations and is a no-op once the
# database is current, so this is cheap on every boot after the first.
echo "[entrypoint] applying database migrations…"
if node node_modules/prisma/build/index.js migrate deploy; then
  echo "[entrypoint] migrations up to date"
else
  # Failing hard would take down a server that is already serving. The logs say
  # what went wrong; the store keeps answering.
  echo "[entrypoint] WARNING: migrations failed — check DATABASE_URL" >&2
fi

# Creates the admin user and, when asked, loads the demo catalogue. Both skip
# themselves once done.
echo "[entrypoint] running bootstrap…"
node node_modules/tsx/dist/cli.mjs scripts/bootstrap.ts || \
  echo "[entrypoint] WARNING: bootstrap failed" >&2

echo "[entrypoint] ready"
wait "$SERVER_PID"
