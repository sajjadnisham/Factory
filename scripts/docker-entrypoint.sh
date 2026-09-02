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
#
# Everything after the server starts is guarded by a cheap probe. This script
# runs on every wake from spin-down, not just on deploys, and the schema work is
# a no-op on all but the first boot — but a no-op that still costs a second Node
# process and a spawned schema engine inside a 512MB instance, competing with
# the request that did the waking.
set -e

echo "[entrypoint] starting server"
node server.js &
SERVER_PID=$!

# Hand shutdown signals to the server so deploys and spin-downs are clean.
trap 'kill -TERM "$SERVER_PID" 2>/dev/null' TERM INT

# Asks Postgres what is actually outstanding, using the same client the server
# has loaded anyway. Prints "migrate" and/or "bootstrap" when there is work to
# do, nothing when the instance is already provisioned, and both on any error at
# all — so a probe that cannot answer falls back to the old always-run
# behaviour. It costs about 80MB and a fraction of a second; the two steps it
# guards cost roughly 200MB each.
PENDING="$(node scripts/provision-check.mjs || printf 'migrate\nbootstrap\n')"

case "$PENDING" in
  *migrate*)
    echo "[entrypoint] applying database migrations…"
    if node node_modules/prisma/build/index.js migrate deploy; then
      echo "[entrypoint] migrations up to date"
    else
      # Failing hard would take down a server that is already serving. The logs
      # say what went wrong; the store keeps answering.
      echo "[entrypoint] WARNING: migrations failed — check DATABASE_URL" >&2
    fi
    ;;
  *)
    echo "[entrypoint] schema already current — skipping migrations"
    ;;
esac

# Creates the admin user and, when asked, loads the demo catalogue. Both skip
# themselves once done — but only after paying for tsx, esbuild and a second
# Prisma client, so the probe decides whether to start it at all. Note that it
# still runs on every boot while ADMIN_INITIAL_PASSWORD is set, since that is
# how the password is rotated on a host with no shell; clearing the variable
# once the admin exists is what makes this step free.
case "$PENDING" in
  *bootstrap*)
    echo "[entrypoint] running bootstrap…"
    node node_modules/tsx/dist/cli.mjs scripts/bootstrap.ts || \
      echo "[entrypoint] WARNING: bootstrap failed" >&2
    ;;
  *)
    echo "[entrypoint] already provisioned — skipping bootstrap"
    ;;
esac

echo "[entrypoint] ready"
wait "$SERVER_PID"
