"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { syncStockAction } from "@/app/actions/admin-actions";
import type { SyncReport } from "@/lib/products/sync";

interface Props {
  lastRun: {
    startedAt: string;
    status: string;
    productsFound: number;
    productsNew: number;
    productsUpdated: number;
    productsRemoved: number;
    imagesUpdated: number;
    invalidProducts: number;
    triggeredBy: string | null;
  } | null;
  openIssueCount: number;
}

/** The SYNC STOCK button and its report, in the format the brief specifies. */
export function SyncPanel({ lastRun, openIssueCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    setReport(null);
    startTransition(async () => {
      const result = await syncStockAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReport(result.report);
      router.refresh();
    });
  }

  const shown = report ?? lastRun;

  return (
    <div className="comic-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Scanning STOCK…" : "Sync stock"}
        </button>

        {lastRun && !report && (
          <p className="text-xs text-[var(--color-steel)]">
            Last run {new Date(lastRun.startedAt).toLocaleString("en-GB")}
            {lastRun.triggeredBy ? ` by ${lastRun.triggeredBy}` : ""}
          </p>
        )}

        {openIssueCount > 0 && (
          <Link href="/admin/products?tab=issues" className="sticker sticker-sale">
            {openIssueCount} issue{openIssueCount === 1 ? "" : "s"}
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded border-2 border-[var(--color-danger)] bg-white p-2.5 text-sm">
          {error}
        </p>
      )}

      {shown && (
        <pre
          aria-live="polite"
          className="mt-3 overflow-x-auto rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-ink)] p-3 text-xs leading-relaxed text-[var(--color-volt)]"
        >
{`Scanning Stock Folder...
Products Found: ${shown.productsFound}
New: ${shown.productsNew}
Updated: ${shown.productsUpdated}
Removed: ${shown.productsRemoved}
Images Updated: ${shown.imagesUpdated}
Invalid Products: ${shown.invalidProducts}
${report || !lastRun ? "SYNC COMPLETE" : `STATUS: ${lastRun.status.toUpperCase()}`}`}
        </pre>
      )}

      {report && report.issues.length > 0 && (
        <div className="mt-3">
          <h3 className="field-label">Issues found</h3>
          <ul className="grid gap-1.5">
            {report.issues.slice(0, 10).map((issue, i) => (
              <li
                key={`${issue.folderName}-${i}`}
                className={`rounded border-2 p-2 text-xs ${
                  issue.severity === "error"
                    ? "border-[var(--color-danger)]"
                    : "border-[var(--color-mist)]"
                }`}
              >
                <span className="font-bold uppercase">{issue.folderName}</span>
                {" — "}
                {issue.message}
              </li>
            ))}
          </ul>
          {report.issues.length > 10 && (
            <Link
              href="/admin/products?tab=issues"
              className="mt-2 inline-block text-xs font-bold uppercase underline"
            >
              See all {report.issues.length} issues
            </Link>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-[var(--color-steel)]">
        Products come from the STOCK folder. Add or edit a product folder, then
        sync — one invalid folder never stops the rest of the catalogue loading.
      </p>
    </div>
  );
}
