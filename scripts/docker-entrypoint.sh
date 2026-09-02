#!/bin/sh
# Container entrypoint.
#
# Shaped entirely by the free tier it has to survive: 512MB of memory, and an
# instance that is stopped when idle and started again on the next visitor — so
# everything here runs on every wake, not just on deploys.
#
# Provisioning happens BEFORE the server starts, one step at a time, and only
# when the probe says a step is outstanding.
#
# That ordering is the opposite of the obvious one, and it is deliberate. Each
# step is a Node process of its own: migrations peak at 225MB, the seed at
# 275MB. The server is another 225MB. Run them alongside it and a first boot
# needs more memory than the instance has — measured at 809MB when the steps
# also nested, and still 500MB after they were flattened. The kernel resolves
# that by killing the container mid-seed, which leaves the catalogue empty, so
# the next boot seeds again: a loop that never ends and serves nothing but 502.
# Run them before the server and each gets the whole instance to itself.
#
# The cost is that a first boot binds the port late. It is paid exactly once:
# after the database is provisioned the probe reports nothing, no step runs, and
# the port binds in well under a second — which is what matters for a free
# instance waking from sleep with someone waiting on it.
#
# Every step is bounded, so a hung one cannot stop the server from ever
# starting. Nothing here is allowed to be fatal: a store that comes up with a
# provisioning problem is worth far more than no store at all, and the logs say
# what happened.
set -e

# busybox and coreutils agree on `timeout SECONDS COMMAND`; older busybox wants
# -t. If neither works, run unbounded rather than not at all.
if timeout 1 true 2>/dev/null; then
  bounded() { secs="$1"; shift; timeout "$secs" "$@"; }
elif timeout -t 1 true 2>/dev/null; then
  bounded() { secs="$1"; shift; timeout -t "$secs" "$@"; }
else
  bounded() { shift; "$@"; }
fi

# Asks Postgres what is actually outstanding, using the client the server would
# load anyway: about 80MB and a fraction of a second. Prints one line per
# outstanding job, nothing when the instance is already provisioned, and every
# job on any error at all — so a probe that cannot answer falls back to doing
# the work rather than skipping it.
PENDING="$(bounded 60 node scripts/provision-check.mjs || printf 'migrate\nadmin\nseed\n')"

run_step() {
  name="$1"
  limit="$2"
  shift 2
  case "$PENDING" in
    *"$name"*)
      echo "[entrypoint] $name…"
      bounded "$limit" "$@" \
        || echo "[entrypoint] WARNING: $name failed or timed out — see above" >&2
      ;;
    *)
      echo "[entrypoint] $name not needed — skipping"
      ;;
  esac
}

run_step migrate 300 node node_modules/prisma/build/index.js migrate deploy
run_step admin 120 node node_modules/tsx/dist/cli.mjs scripts/bootstrap.ts --admin

# ALLOW_SEED_IN_PRODUCTION is the seed script's own guard against being pointed
# at a real store. The probe only asks for this step when SEED_DEMO_DATA=1 and
# the catalogue is empty, so the guard is being answered, not bypassed.
run_step seed 600 env ALLOW_SEED_IN_PRODUCTION=1 \
  node node_modules/tsx/dist/cli.mjs scripts/seed.ts

# Next's standalone server binds to whatever $HOSTNAME says, falling back to
# 0.0.0.0 only when it is unset:
#
#     const hostname = process.env.HOSTNAME || '0.0.0.0'
#
# Container runtimes set HOSTNAME to the container or pod name, which is the
# worst possible value here. Where it resolves to a loopback address the server
# comes up, logs "Ready", answers itself — and refuses every connection from the
# platform's proxy, which is a 502 on a service the dashboard calls Live. Where
# it does not resolve at all the server exits(1) on ENOTFOUND and the container
# restarts forever. Both were reproduced; the first is what took this store down
# and hid from every local test, because a local test curls loopback.
#
# Forcing it here rather than with ENV in the Dockerfile is deliberate: the
# platform injects its environment over the image's, so an ENV line loses.
# SERVER_BIND_HOST exists for a deployment that genuinely needs a specific
# interface.
HOSTNAME="${SERVER_BIND_HOST:-0.0.0.0}"
export HOSTNAME

# exec, so the server becomes PID 1 and receives the platform's stop signals
# directly — no shell in between to forward them.
echo "[entrypoint] starting server on ${HOSTNAME}:${PORT:-3000}"
exec node server.js
