"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Customer-facing error boundary. Shows a friendly message and never the error
 * detail — the stack goes to the server log, where staff can read it.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ui] render error:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="display text-5xl">Oops</p>
      <h1 className="section-title mt-2">Something went wrong</h1>
      <p className="mt-2 text-sm text-[var(--color-graphite)]">
        We hit a problem loading this page. Try again in a moment.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-[var(--color-steel)]">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-6 grid gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">Back home</Link>
      </div>
    </div>
  );
}
