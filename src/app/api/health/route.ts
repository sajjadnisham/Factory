import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness check for the platform's health probe.
 *
 * Deliberately touches nothing — no database, no storage provider. The probe
 * answers "is this process serving?", and querying the database to answer it
 * would make a briefly unreachable database look like a dead application. It
 * also has to succeed in the seconds after startup, while migrations are still
 * being applied alongside the running server.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
  });
}
