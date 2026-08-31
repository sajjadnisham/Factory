/**
 * CLI stock sync — the same code path the admin SYNC STOCK button uses.
 * Usage: npm run stock:sync
 */
import { db } from "../src/lib/db";
import { formatSyncReport, syncStock } from "../src/lib/products/sync";

async function main() {
  const report = await syncStock({ triggeredBy: "cli" });
  console.log(formatSyncReport(report));
  console.log(`\nCompleted in ${report.durationMs}ms`);

  if (report.issues.length > 0) {
    console.log("\nIssues:");
    for (const issue of report.issues) {
      console.log(`  [${issue.severity}] ${issue.folderName}: ${issue.message}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("Sync failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
