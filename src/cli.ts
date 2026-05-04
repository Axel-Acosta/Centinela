import path from "node:path";
import fs from "node:fs";
import { runDnitRucEquivalence } from "./enrichment/dnitRucEquivalence";
import { runDncpDocumentContentExtraction } from "./enrichment/dncpDocumentContent";
import { runDncpReleaseSourceCheck } from "./enrichment/dncpReleaseSourceCheck";
import { runDncpSupplierAnchor } from "./enrichment/dncpSupplierAnchor";
import { runIadbSanctionsCandidateCheck } from "./enrichment/idbSanctions";
import { runOpenSanctionsHostedMatchComparison } from "./enrichment/opensanctionsHostedMatch";
import { getDefaultWindow, outputRoot, projectRoot } from "./config";
import { runOpenSanctionsEnrichment } from "./enrichment/opensanctions";
import type { NormalizedBundle } from "./integrity/bundle";
import type { NormalizedProcess } from "./integrity/model";
import { normalizeAwardRecord, normalizeOpenTender } from "./integrity/normalize";
import { normalizeDncpBulkYear } from "./integrity/normalizeBulk";
import { applyRiskSignals } from "./integrity/risk";
import {
  fetchOpenTenderMinimals,
  fetchRelease,
  fetchTenderDetail,
  searchRecentProcesses,
} from "./sources/paraguay/dncp";
import { fetchDncpBulkYear } from "./sources/paraguay/dncpBulk";
import { writeOutputJson, writeOutputText } from "./storage/files";
import { candidateReviewStatuses, updateExternalCandidateReview } from "./storage/candidateReview";
import { secondReviewDecisions, secondReviewExternalCandidate } from "./storage/secondReview";
import { serveInternalConsole } from "./server/internalConsole";
import { applySqlFile } from "./storage/sqlFile";
import {
  buildAnalystBrief,
  buildEntityAnchorGapReport,
  buildEntityBrief,
  buildEntityIntelligenceQueueReport,
  buildExternalCandidateReviewReport,
  buildReviewQueueReport,
} from "./storage/analyst";
import { loadBundleToPostgres, readBundleFromFile } from "./storage/postgres";
import { buildRulebookReport } from "./storage/rules";
import {
  buildCaseEvidenceExportArtifacts,
  buildCaseSourceAttachmentManifestArtifacts,
  buildCaseSourceBundleArtifacts,
  buildCaseSourceDocumentIndexArtifacts,
} from "./storage/caseEvidenceExport";

interface FirstSliceOptions {
  from: string;
  to: string;
  openDetailLimit: number;
  awardLimit: number;
  hydrateReleaseLimit: number;
}

function readArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function readNumberArg(args: string[], name: string, fallback: number): number {
  const value = readArg(args, name);
  return value ? Number(value) : fallback;
}

function readBooleanArg(args: string[], name: string, fallback = false): boolean {
  const value = readArg(args, name);
  if (!value) {
    return fallback;
  }

  return ["true", "1", "yes"].includes(value.toLowerCase());
}

function resolveInputPath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  const projectCandidate = path.resolve(projectRoot, inputPath);
  if (fs.existsSync(projectCandidate)) {
    return projectCandidate;
  }

  const outputRelativePath = inputPath.replace(/^data[\\/]/, "");
  const outputCandidate = path.resolve(outputRoot, outputRelativePath);
  if (fs.existsSync(outputCandidate)) {
    return outputCandidate;
  }

  return projectCandidate;
}

function parseFirstSliceArgs(args: string[]): FirstSliceOptions {
  const defaults = getDefaultWindow();
  return {
    from: readArg(args, "--from") ?? defaults.from,
    to: readArg(args, "--to") ?? defaults.to,
    openDetailLimit: readNumberArg(args, "--open-detail-limit", 12),
    awardLimit: readNumberArg(args, "--award-limit", 12),
    hydrateReleaseLimit: readNumberArg(args, "--hydrate-release-limit", 6),
  };
}

function createBundle(
  bundleKind: NormalizedBundle["bundleKind"],
  sourceKey: string,
  processes: NormalizedProcess[],
  extras?: Partial<NormalizedBundle>,
): NormalizedBundle {
  return {
    generatedAt: new Date().toISOString(),
    bundleKind,
    sourceKey,
    countryCode: "PY",
    stats: {
      processCount: processes.length,
      riskSignalCount: processes.reduce((sum, process) => sum + process.flags.length, 0),
      flaggedProcessCount: processes.filter((process) => process.flags.length > 0).length,
    },
    processes,
    ...extras,
  };
}

function topFlags(processes: NormalizedProcess[]): NormalizedProcess[] {
  return processes
    .filter((process) => process.flags.length > 0)
    .sort((left, right) => right.flags.length - left.flags.length)
    .slice(0, 12);
}

function renderFirstSliceReport(processes: NormalizedProcess[], options: FirstSliceOptions): string {
  const totalFlags = processes.reduce((sum, process) => sum + process.flags.length, 0);
  const byStage = processes.reduce<Record<string, number>>((accumulator, process) => {
    accumulator[process.stage] = (accumulator[process.stage] ?? 0) + 1;
    return accumulator;
  }, {});

  const lines: string[] = [];
  lines.push("# Paraguay first slice summary");
  lines.push("");
  lines.push("This report contains risk signals and investigation leads, not proof of wrongdoing.");
  lines.push("");
  lines.push(`- Window: ${options.from} to ${options.to}`);
  lines.push(`- Processes normalized: ${processes.length}`);
  lines.push(`- Open tenders hydrated: ${byStage.open_tender ?? 0}`);
  lines.push(`- Recent awards normalized: ${byStage.recent_award ?? 0}`);
  lines.push(`- Risk signals raised: ${totalFlags}`);
  lines.push("");
  lines.push("## Highest-signal leads");
  lines.push("");

  for (const process of topFlags(processes)) {
    lines.push(`### ${process.title}`);
    lines.push(`- Stage: ${process.stage}`);
    lines.push(`- Buyer: ${process.buyer?.name ?? "Unknown"}`);
    if (process.suppliers.length > 0) {
      lines.push(`- Suppliers: ${process.suppliers.map((supplier) => supplier.name).join(", ")}`);
    }
    lines.push(`- Flags: ${process.flags.map((flag) => `${flag.code} (${flag.severity})`).join(", ")}`);
    lines.push(`- Source: ${process.sourceUrls[0] ?? "n/a"}`);
    lines.push("");
  }

  lines.push("## Observations");
  lines.push("");
  lines.push("- The first slice supports both open-tender scrutiny and recent-award concentration review.");
  lines.push("- DNCP's live API is useful for targeted pulls and triage.");
  lines.push("- The next serious step is bulk ingestion plus database persistence, which Centinela now supports separately.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderBulkYearReport(processes: NormalizedProcess[], year: number, snapshotSummary: Record<string, number>): string {
  const totalFlags = processes.reduce((sum, process) => sum + process.flags.length, 0);
  const singleBidderCount = processes.filter((process) =>
    process.flags.some((flag) => flag.code === "PY-DNCP-B001"),
  ).length;
  const repeatedPairCount = processes.filter((process) =>
    process.flags.some((flag) => flag.code === "PY-DNCP-P001"),
  ).length;
  const paymentOverrunCount = processes.filter((process) =>
    process.flags.some((flag) => flag.code === "PY-DNCP-P002"),
  ).length;

  const lines: string[] = [];
  lines.push(`# Paraguay DNCP bulk ${year} summary`);
  lines.push("");
  lines.push("This report contains risk signals and investigation leads, not proof of wrongdoing.");
  lines.push("");
  lines.push(`- Year: ${year}`);
  lines.push(`- Tender records parsed: ${snapshotSummary.tenderRecords}`);
  lines.push(`- Contract records parsed: ${snapshotSummary.contractRecords}`);
  lines.push(`- Contracts parsed: ${snapshotSummary.contracts}`);
  lines.push(`- Transactions parsed: ${snapshotSummary.transactions}`);
  lines.push(`- Processes normalized: ${processes.length}`);
  lines.push(`- Risk signals raised: ${totalFlags}`);
  lines.push(`- Single-bidder markers: ${singleBidderCount}`);
  lines.push(`- Repeated buyer-payee markers: ${repeatedPairCount}`);
  lines.push(`- Payment-over-contract-value markers: ${paymentOverrunCount}`);
  lines.push("");
  lines.push("## Highest-signal leads");
  lines.push("");

  for (const process of topFlags(processes)) {
    lines.push(`### ${process.title}`);
    lines.push(`- Buyer: ${process.buyer?.name ?? "Unknown"}`);
    lines.push(`- Status: ${process.statusDetails ?? "n/a"}`);
    if (process.numberOfTenderers !== undefined) {
      lines.push(`- Number of tenderers: ${process.numberOfTenderers}`);
    }
    if (process.suppliers.length > 0) {
      lines.push(`- Linked payees/suppliers: ${process.suppliers.map((supplier) => supplier.name).join(", ")}`);
    }
    if (process.totalContractValue !== undefined) {
      lines.push(`- Total published contract value: ${process.totalContractValue}`);
    }
    if (process.totalPaidAmount !== undefined && process.totalPaidAmount > 0) {
      lines.push(`- Observed payments: ${process.totalPaidAmount}`);
    }
    lines.push(`- Flags: ${process.flags.map((flag) => `${flag.code} (${flag.severity})`).join(", ")}`);
    lines.push(`- Source: ${process.sourceUrls[0] ?? "n/a"}`);
    lines.push("");
  }

  lines.push("## Observations");
  lines.push("");
  lines.push("- The bulk pipeline now links procurement records to contracts and payment transactions from DNCP's annual OCDS ZIPs.");
  lines.push("- Buyer-payee recurrence and payment-value comparisons now run through a formal rule registry rather than a purely hard-coded heuristic layer.");
  lines.push("- The current bundle can now feed registry-backed review lanes, analyst questions, and methodology outputs in addition to raw risk signals.");
  lines.push("- This is now a relationship-aware Paraguay procurement intelligence layer ready for the first enrichment connector and formal DNCP crosswalk work.");
  lines.push("");
  lines.push("## Immediate next engineering step");
  lines.push("");
  lines.push("- Add the first non-DNCP enrichment connector and formalize the DNCP-to-Centinela rule crosswalk.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function runParaguayFirstSlice(args: string[]): Promise<void> {
  const options = parseFirstSliceArgs(args);

  const openTenderMinimals = await fetchOpenTenderMinimals(options.from, options.to);
  const openTenderIds = openTenderMinimals.list.slice(0, options.openDetailLimit).map((item) => item.tender.id);

  const openTenderDetails = [];
  for (const tenderId of openTenderIds) {
    openTenderDetails.push(await fetchTenderDetail(tenderId));
  }

  const recentSearch = await searchRecentProcesses(options.from, options.to, options.awardLimit);
  const recentAwardRecords = recentSearch.records
    .filter((record) => /adjudic/i.test(record.compiledRelease?.tender?.statusDetails ?? ""))
    .slice(0, options.awardLimit);

  const hydratedReleases: Array<{ ocid: string | undefined; url: string; payload: unknown }> = [];
  for (const record of recentAwardRecords.slice(0, options.hydrateReleaseLimit)) {
    const releaseUrl = record.releases?.[0]?.url;
    if (!releaseUrl) {
      continue;
    }

    hydratedReleases.push({
      ocid: record.ocid,
      url: releaseUrl,
      payload: await fetchRelease(releaseUrl),
    });
  }

  const releaseMap = new Map(hydratedReleases.map((entry) => [entry.ocid, entry.payload]));
  const openProcesses = openTenderDetails.map((detail) => normalizeOpenTender(detail));
  const awardedProcesses = recentAwardRecords.map((record) =>
    normalizeAwardRecord(record, record.ocid ? releaseMap.get(record.ocid) : undefined),
  );
  const processes = applyRiskSignals([...openProcesses, ...awardedProcesses]);

  const rawBundle = {
    retrievedAt: new Date().toISOString(),
    source: "py-dncp-api-v3",
    window: {
      from: options.from,
      to: options.to,
    },
    openTenderMinimals,
    openTenderDetails,
    recentSearch,
    hydratedReleases,
  };

  const normalizedBundle = createBundle("api-slice", "py-dncp-api-v3", processes);
  const report = renderFirstSliceReport(processes, options);

  const rawPath = await writeOutputJson(["raw", "paraguay", "dncp", "first-slice-raw.json"], rawBundle);
  const normalizedPath = await writeOutputJson(
    ["normalized", "paraguay", "first-slice-processes.json"],
    normalizedBundle,
  );
  const reportPath = await writeOutputText(["reports", "paraguay", "first-slice-summary.md"], report);

  console.log("Centinela Paraguay first slice completed.");
  console.log(`Raw bundle: ${rawPath}`);
  console.log(`Normalized bundle: ${normalizedPath}`);
  console.log(`Summary report: ${reportPath}`);
}

async function runParaguayBulkYear(args: string[]): Promise<void> {
  const year = readNumberArg(args, "--year", new Date().getUTCFullYear());
  const forceDownload = readBooleanArg(args, "--force-download", false);

  const snapshot = await fetchDncpBulkYear(year, { forceDownload });
  const processes = applyRiskSignals(normalizeDncpBulkYear(snapshot));

  const manifest = {
    retrievedAt: new Date().toISOString(),
    source: snapshot.sourceKey,
    year,
    tenderZipPath: snapshot.tenderZipPath,
    contractZipPath: snapshot.contractZipPath,
    counts: {
      tenderRecords: snapshot.tenderRecords.length,
      contractRecords: snapshot.contractRecords.length,
      contracts: snapshot.contracts.length,
      transactions: snapshot.transactions.length,
    },
  };

  const normalizedBundle = createBundle("bulk-year", snapshot.sourceKey, processes, {
    year,
    sourceAssets: [snapshot.tenderZipPath, snapshot.contractZipPath],
  });
  const report = renderBulkYearReport(processes, year, manifest.counts);

  const manifestPath = await writeOutputJson(
    ["raw", "paraguay", "dncp", `dncp-${year}-bulk-manifest.json`],
    manifest,
  );
  const normalizedPath = await writeOutputJson(
    ["normalized", "paraguay", `dncp-${year}-bulk-processes.json`],
    normalizedBundle,
  );
  const reportPath = await writeOutputText(
    ["reports", "paraguay", `dncp-${year}-bulk-summary.md`],
    report,
  );

  console.log(`Centinela Paraguay DNCP bulk ${year} completed.`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Normalized bundle: ${normalizedPath}`);
  console.log(`Summary report: ${reportPath}`);
}

async function runDatabaseLoadBundle(args: string[]): Promise<void> {
  const bundleArg = readArg(args, "--file");
  if (!bundleArg) {
    throw new Error("Missing required --file argument for database load.");
  }

  const bundlePath = resolveInputPath(bundleArg);
  const bundle = await readBundleFromFile(bundlePath);
  await loadBundleToPostgres(bundle, bundlePath);
  console.log(`Loaded bundle into PostgreSQL: ${bundlePath}`);
}

async function runDatabaseApplySql(args: string[]): Promise<void> {
  const fileArg = readArg(args, "--file");
  if (!fileArg) {
    throw new Error("Missing required --file argument for database SQL application.");
  }

  const sqlPath = resolveInputPath(fileArg);
  await applySqlFile(sqlPath);
  console.log(`Applied SQL file to PostgreSQL: ${sqlPath}`);
}

async function runDatabaseAnalystBrief(args: string[]): Promise<void> {
  const sourceKey = readArg(args, "--source-key");
  if (!sourceKey) {
    throw new Error("Missing required --source-key argument for analyst brief generation.");
  }

  const { reportPath } = await buildAnalystBrief(sourceKey);
  console.log(`Generated analyst brief: ${reportPath}`);
}

async function runDatabaseEntityBrief(args: string[]): Promise<void> {
  const entityName = readArg(args, "--name");
  if (!entityName) {
    throw new Error("Missing required --name argument for entity brief generation.");
  }

  const entityType = readArg(args, "--entity-type");
  const { reportPath, entityName: resolvedName } = await buildEntityBrief(entityName, entityType);
  console.log(`Generated entity brief for ${resolvedName}: ${reportPath}`);
}

async function runDatabaseReviewQueue(args: string[]): Promise<void> {
  const sourceKey = readArg(args, "--source-key");
  const limit = readNumberArg(args, "--limit", 20);
  const { reportPath } = await buildReviewQueueReport(limit, sourceKey);
  console.log(`Generated review queue report: ${reportPath}`);
}

async function runDatabaseRulebook(args: string[]): Promise<void> {
  const sourceKey = readArg(args, "--source-key");
  const { reportPath } = await buildRulebookReport(sourceKey);
  console.log(`Generated rulebook report: ${reportPath}`);
}

async function runEnrichmentOpenSanctions(): Promise<void> {
  const { reportPath, summaryPath } = await runOpenSanctionsEnrichment();
  console.log(`OpenSanctions enrichment completed.`);
  console.log(`Summary: ${summaryPath}`);
  console.log(`Report: ${reportPath}`);
}

async function runEnrichmentOpenSanctionsHostedMatch(args: string[]): Promise<void> {
  const limit = readNumberArg(args, "--limit", 25);
  const batchSize = readNumberArg(args, "--batch-size", 20);
  const dryRun = readBooleanArg(args, "--dry-run", false);
  const dataset = readArg(args, "--dataset") ?? "default";
  const algorithm = readArg(args, "--algorithm") ?? "logic-v2";
  const threshold = readNumberArg(args, "--threshold", 0.7);
  const resultLimit = readNumberArg(args, "--result-limit", 5);
  const { reportPath, summaryPath } = await runOpenSanctionsHostedMatchComparison({
    limit,
    batchSize,
    dryRun,
    dataset,
    algorithm,
    threshold,
    resultLimit,
  });
  console.log("OpenSanctions hosted match comparison completed.");
  console.log(`Summary: ${summaryPath}`);
  console.log(`Report: ${reportPath}`);
}

async function runEnrichmentDncpSupplierAnchor(args: string[]): Promise<void> {
  const limit = readNumberArg(args, "--limit", 200);
  const offset = readNumberArg(args, "--offset", 0);
  const concurrency = readNumberArg(args, "--concurrency", 4);
  const onlyUnanchored = readBooleanArg(args, "--only-unanchored", false);
  const { reportPath, summaryPath } = await runDncpSupplierAnchor({
    limit,
    offset,
    concurrency,
    onlyUnanchored,
  });
  console.log("DNCP supplier anchor completed.");
  console.log(`Summary: ${summaryPath}`);
  console.log(`Report: ${reportPath}`);
}

async function runEnrichmentDnitRucEquivalence(args: string[]): Promise<void> {
  const limit = readNumberArg(args, "--limit", 10000);
  const offset = readNumberArg(args, "--offset", 0);
  const onlyAnchorGaps = readBooleanArg(args, "--only-anchor-gaps", false);
  const refreshRaw = readBooleanArg(args, "--refresh-raw", false);
  const { reportPath, summaryPath, rawManifestPath } = await runDnitRucEquivalence({
    limit,
    offset,
    onlyAnchorGaps,
    refreshRaw,
  });
  console.log("DNIT RUC equivalence identity anchor completed.");
  console.log(`Raw manifest: ${rawManifestPath}`);
  console.log(`Summary: ${summaryPath}`);
  console.log(`Report: ${reportPath}`);
}

async function runEnrichmentIadbSanctionsCandidate(args: string[]): Promise<void> {
  const candidateId = readNumberArg(args, "--candidate-id", 0);
  const country = readArg(args, "--country") ?? "Paraguay";
  const updateReview = readBooleanArg(args, "--update-review", false);
  const dryRun = readBooleanArg(args, "--dry-run", false);
  const reviewer = readArg(args, "--reviewer") ?? "centinela-operator";

  if (!candidateId) {
    throw new Error("Missing required --candidate-id argument for IDB sanctions candidate source check.");
  }

  const result = await runIadbSanctionsCandidateCheck({
    candidateId,
    country,
    updateReview,
    reviewer,
    dryRun,
  });

  console.log("IDB sanctions candidate source check completed.");
  console.log(`Candidate ID: ${result.candidateId}`);
  console.log(`Matched official row: ${result.matched ? "yes" : "no"}`);
  console.log(`Matched row ID: ${result.matchedRecordId ?? "n/a"}`);
  console.log(`Recommended review status: ${result.recommendedReviewStatus}`);
  console.log(`Raw source evidence: ${result.rawPath}`);
  console.log(`Report: ${result.reportPath}`);
}

async function runEnrichmentDncpReleaseSourceCheck(args: string[]): Promise<void> {
  const entityName = readArg(args, "--entity-name");
  const entityId = readNumberArg(args, "--entity-id", 0);
  const limit = readNumberArg(args, "--limit", 5);
  const dryRun = readBooleanArg(args, "--dry-run", false);

  if (!entityName && !entityId) {
    throw new Error("Missing required --entity-name or --entity-id argument for DNCP release source check.");
  }

  const result = await runDncpReleaseSourceCheck({
    ...(entityName ? { entityName } : {}),
    ...(entityId ? { entityId } : {}),
    limit,
    dryRun,
  });

  console.log("DNCP release source check completed.");
  console.log(`Entity: ${result.entityName} (#${result.entityId})`);
  console.log(`Processes checked: ${result.checkedProcesses}`);
  console.log(`Release packages fetched: ${result.fetchedProcesses}`);
  console.log(`Release source records persisted: ${result.releaseRecordsPersisted}`);
  console.log(`Document metadata records persisted: ${result.documentRecordsPersisted}`);
  console.log(`Raw source evidence: ${result.rawPath}`);
  console.log(`Report: ${result.reportPath}`);
  console.log("Reminder: DNCP source records are review material, not proof of wrongdoing.");
}

async function runEnrichmentDncpDocumentContent(args: string[]): Promise<void> {
  const entityName = readArg(args, "--entity-name");
  const entityId = readNumberArg(args, "--entity-id", 0);
  const sourceRecordId = readNumberArg(args, "--source-record-id", 0);
  const query = readArg(args, "--query");
  const limit = readNumberArg(args, "--limit", 5);
  const dryRun = readBooleanArg(args, "--dry-run", false);
  const maxBytes = readNumberArg(args, "--max-bytes", 25_000_000);
  const timeoutMs = readNumberArg(args, "--timeout-ms", 30000);
  const maxPdfPages = readNumberArg(args, "--max-pdf-pages", 20);
  const maxTextChars = readNumberArg(args, "--max-chars", 120000);

  if (!entityName && !entityId && !sourceRecordId && !query) {
    throw new Error(
      "Missing filter for DNCP document content extraction. Use --entity-name, --entity-id, --source-record-id, or --query.",
    );
  }

  const result = await runDncpDocumentContentExtraction({
    ...(entityName ? { entityName } : {}),
    ...(entityId ? { entityId } : {}),
    ...(sourceRecordId ? { sourceRecordId } : {}),
    ...(query ? { query } : {}),
    limit,
    dryRun,
    maxBytes,
    timeoutMs,
    maxPdfPages,
    maxTextChars,
  });

  console.log("DNCP document content extraction completed.");
  console.log(`Documents checked: ${result.checkedDocuments}`);
  console.log(`Documents downloaded: ${result.downloadedDocuments}`);
  console.log(`Documents extracted: ${result.extractedDocuments}`);
  console.log(`Content source records persisted: ${result.persistedRecords}`);
  console.log(`Raw source evidence: ${result.rawPath}`);
  console.log(`Report: ${result.reportPath}`);
  console.log("Reminder: extracted document text is a navigation aid, not proof of wrongdoing.");
}

async function runDatabaseEntityIntelligenceQueue(args: string[]): Promise<void> {
  const limit = readNumberArg(args, "--limit", 25);
  const { reportPath } = await buildEntityIntelligenceQueueReport(limit);
  console.log(`Generated entity intelligence queue report: ${reportPath}`);
}

async function runDatabaseExternalCandidates(args: string[]): Promise<void> {
  const limit = readNumberArg(args, "--limit", 50);
  const { reportPath } = await buildExternalCandidateReviewReport(limit);
  console.log(`Generated external candidate review report: ${reportPath}`);
}

async function runDatabaseReviewExternalCandidate(args: string[]): Promise<void> {
  const candidateId = readNumberArg(args, "--candidate-id", 0);
  const reviewStatus = readArg(args, "--status");
  const reviewer = readArg(args, "--reviewer") ?? process.env.USERNAME ?? process.env.USER ?? "centinela-local-reviewer";
  const notes = readArg(args, "--notes");
  const evidenceUrl = readArg(args, "--evidence-url");
  const evidenceNote = readArg(args, "--evidence-note");
  const dryRun = readBooleanArg(args, "--dry-run", false);

  if (!candidateId) {
    throw new Error("Missing required --candidate-id argument for external candidate review.");
  }

  if (!reviewStatus) {
    throw new Error(
      `Missing required --status argument for external candidate review. Use one of: ${candidateReviewStatuses.join(", ")}`,
    );
  }

  const reviewOptions = {
    candidateId,
    reviewStatus,
    reviewer,
    dryRun,
  };

  const result = await updateExternalCandidateReview({
    ...reviewOptions,
    ...(notes ? { notes } : {}),
    ...(evidenceUrl ? { evidenceUrl } : {}),
    ...(evidenceNote ? { evidenceNote } : {}),
  });

  const prefix = result.dryRun ? "Dry-run external candidate review" : "Updated external candidate review";
  console.log(`${prefix}: ${result.candidate.entity_name} -> ${result.candidate.external_name}`);
  console.log(`Candidate ID: ${result.candidate.id}`);
  console.log(`Review status: ${result.candidate.review_status}`);
  console.log(`Suggested status: ${result.candidate.suggested_review_status ?? "n/a"}`);
  console.log(`Priority hint: ${result.candidate.review_priority_hint ?? "n/a"}`);
  console.log(`Hosted support: ${result.candidate.hosted_support_category ?? "n/a"}`);
  console.log(`Next step: ${result.candidate.review_next_step ?? "n/a"}`);
}

async function runDatabaseSecondReviewExternalCandidate(args: string[]): Promise<void> {
  const candidateId = readNumberArg(args, "--candidate-id", 0);
  const decision = readArg(args, "--decision");
  const reviewer = readArg(args, "--reviewer") ?? process.env.USERNAME ?? process.env.USER ?? "centinela-second-reviewer";
  const rationale = readArg(args, "--rationale");
  const limitations = readArg(args, "--limitations");
  const evidenceUrl = readArg(args, "--evidence-url");
  const evidenceNote = readArg(args, "--evidence-note");
  const dryRun = readBooleanArg(args, "--dry-run", false);

  if (!candidateId) {
    throw new Error("Missing required --candidate-id argument for external candidate second review.");
  }

  if (!decision) {
    throw new Error(
      `Missing required --decision argument for external candidate second review. Use one of: ${secondReviewDecisions.join(", ")}`,
    );
  }

  if (!rationale) {
    throw new Error("Missing required --rationale argument for external candidate second review.");
  }

  const result = await secondReviewExternalCandidate({
    candidateId,
    decision,
    reviewer,
    rationale,
    dryRun,
    ...(limitations ? { limitations } : {}),
    ...(evidenceUrl ? { evidenceUrl } : {}),
    ...(evidenceNote ? { evidenceNote } : {}),
  });

  const prefix = result.dryRun ? "Dry-run external candidate second review" : "Recorded external candidate second review";
  console.log(`${prefix}: ${result.candidate.entity_name} -> ${result.candidate.external_name}`);
  console.log(`Candidate ID: ${result.candidate.id}`);
  console.log(`Decision: ${result.decision}`);
  console.log(`Second review ID: ${result.secondReviewId ?? "n/a"}`);
  console.log(`Candidate review status after: ${result.candidateReviewStatusAfter}`);
  console.log(`Accepted match ID: ${result.acceptedMatchId ?? "n/a"}`);
  console.log(`External entity ID: ${result.externalEntityId ?? "n/a"}`);
  console.log("Reminder: accepted matches are enrichment context and do not create proof of wrongdoing.");
}

async function runDatabaseEntityAnchorGapReport(args: string[]): Promise<void> {
  const limit = readNumberArg(args, "--limit", 50);
  const { reportPath } = await buildEntityAnchorGapReport(limit);
  console.log(`Generated entity anchor gap report: ${reportPath}`);
}

async function runDatabaseCaseEvidenceExport(args: string[]): Promise<void> {
  const caseId = readNumberArg(args, "--case-id", 0);
  const publicOnly = readBooleanArg(args, "--public-only", false);
  const limit = readNumberArg(args, "--limit", 100);

  if (!caseId) {
    throw new Error("Missing required --case-id argument for case evidence export.");
  }

  const result = await buildCaseEvidenceExportArtifacts({
    caseId,
    publicOnly,
    limit,
  });

  console.log(`Generated case evidence export for ${result.caseKey}.`);
  console.log(`Mode: ${result.mode}`);
  console.log(`Evidence rows: ${result.evidenceCount}`);
  console.log(`Source records: ${result.sourceCount}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log("Reminder: evidence exports are source-backed review material, not proof of wrongdoing.");
}

async function runDatabaseCaseSourceManifest(args: string[]): Promise<void> {
  const caseId = readNumberArg(args, "--case-id", 0);
  const publicOnly = readBooleanArg(args, "--public-only", false);
  const limit = readNumberArg(args, "--limit", 100);

  if (!caseId) {
    throw new Error("Missing required --case-id argument for case source manifest.");
  }

  const result = await buildCaseSourceAttachmentManifestArtifacts({
    caseId,
    publicOnly,
    limit,
  });

  console.log(`Generated case source attachment manifest for ${result.caseKey}.`);
  console.log(`Mode: ${result.mode}`);
  console.log(`Source records: ${result.sourceRecordCount}`);
  console.log(`Source assets: ${result.sourceAssetCount}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`JSON: ${result.jsonPath}`);
  console.log("Reminder: source manifests are attachment checklists, not proof of wrongdoing.");
}

async function runDatabaseCaseSourceBundle(args: string[]): Promise<void> {
  const caseId = readNumberArg(args, "--case-id", 0);
  const publicOnly = readBooleanArg(args, "--public-only", false);
  const copyAssets = readBooleanArg(args, "--copy-assets", true);
  const limit = readNumberArg(args, "--limit", 100);

  if (!caseId) {
    throw new Error("Missing required --case-id argument for case source bundle.");
  }

  const result = await buildCaseSourceBundleArtifacts({
    caseId,
    publicOnly,
    copyAssets,
    limit,
  });

  console.log(`Generated case source bundle for ${result.caseKey}.`);
  console.log(`Mode: ${result.mode}`);
  console.log(`Source records: ${result.sourceRecordCount}`);
  console.log(`Source assets listed: ${result.sourceAssetCount}`);
  console.log(`Source assets copied: ${result.copiedAssetCount}`);
  console.log(`Source assets skipped: ${result.skippedAssetCount}`);
  console.log(`Bundle: ${result.bundlePath}`);
  console.log(`Index: ${result.indexPath}`);
  console.log(`README: ${result.readmePath}`);
  console.log("Reminder: source bundles are local review packets, not proof of wrongdoing or public-ready publication packages.");
}

async function runDatabaseCaseSourceIndex(args: string[]): Promise<void> {
  const bundlePath = readArg(args, "--bundle-path");
  const query = readArg(args, "--query");
  const maxTextBytes = readNumberArg(args, "--max-text-bytes", 250000);

  if (!bundlePath) {
    throw new Error("Missing required --bundle-path argument for case source index.");
  }

  const result = await buildCaseSourceDocumentIndexArtifacts({
    bundlePath,
    ...(query ? { query } : {}),
    maxTextBytes,
  });

  console.log(`Generated case source document index for bundle: ${result.bundlePath}`);
  console.log(`Documents: ${result.documentCount}`);
  console.log(`Searchable documents: ${result.searchableDocumentCount}`);
  console.log(`Query: ${result.query ?? "n/a"}`);
  console.log(`Query matches: ${result.queryMatchCount}`);
  console.log(`Index: ${result.indexPath}`);
  console.log(`Markdown: ${result.markdownPath}`);
  console.log(`JSONL: ${result.jsonlPath}`);
  console.log("Reminder: source document indexes are local search aids, not proof of wrongdoing.");
}

async function runServeInternalConsole(args: string[]): Promise<void> {
  const host = readArg(args, "--host") ?? "127.0.0.1";
  const port = readNumberArg(args, "--port", 8787);
  await serveInternalConsole({ host, port });
}

async function main(): Promise<void> {
  const [, , domain, command, ...args] = process.argv;

  if (domain === "paraguay" && command === "first-slice") {
    await runParaguayFirstSlice(args);
    return;
  }

  if (domain === "paraguay" && command === "bulk-year") {
    await runParaguayBulkYear(args);
    return;
  }

  if (domain === "database" && command === "load-bundle") {
    await runDatabaseLoadBundle(args);
    return;
  }

  if (domain === "database" && command === "apply-sql") {
    await runDatabaseApplySql(args);
    return;
  }

  if (domain === "database" && command === "analyst-brief") {
    await runDatabaseAnalystBrief(args);
    return;
  }

  if (domain === "database" && command === "entity-brief") {
    await runDatabaseEntityBrief(args);
    return;
  }

  if (domain === "database" && command === "review-queue") {
    await runDatabaseReviewQueue(args);
    return;
  }

  if (domain === "database" && command === "entity-intelligence-queue") {
    await runDatabaseEntityIntelligenceQueue(args);
    return;
  }

  if (domain === "database" && command === "external-candidates") {
    await runDatabaseExternalCandidates(args);
    return;
  }

  if (domain === "database" && command === "review-external-candidate") {
    await runDatabaseReviewExternalCandidate(args);
    return;
  }

  if (domain === "database" && command === "second-review-external-candidate") {
    await runDatabaseSecondReviewExternalCandidate(args);
    return;
  }

  if (domain === "database" && command === "case-evidence-export") {
    await runDatabaseCaseEvidenceExport(args);
    return;
  }

  if (domain === "database" && command === "case-source-manifest") {
    await runDatabaseCaseSourceManifest(args);
    return;
  }

  if (domain === "database" && command === "case-source-bundle") {
    await runDatabaseCaseSourceBundle(args);
    return;
  }

  if (domain === "database" && command === "case-source-index") {
    await runDatabaseCaseSourceIndex(args);
    return;
  }

  if (domain === "database" && command === "entity-anchor-gaps") {
    await runDatabaseEntityAnchorGapReport(args);
    return;
  }

  if (domain === "database" && command === "rulebook") {
    await runDatabaseRulebook(args);
    return;
  }

  if (domain === "enrichment" && command === "opensanctions") {
    await runEnrichmentOpenSanctions();
    return;
  }

  if (domain === "enrichment" && command === "opensanctions-hosted-match") {
    await runEnrichmentOpenSanctionsHostedMatch(args);
    return;
  }

  if (domain === "enrichment" && command === "dncp-supplier-anchor") {
    await runEnrichmentDncpSupplierAnchor(args);
    return;
  }

  if (domain === "enrichment" && command === "dnit-ruc-equivalence") {
    await runEnrichmentDnitRucEquivalence(args);
    return;
  }

  if (domain === "enrichment" && command === "idb-sanctions-candidate") {
    await runEnrichmentIadbSanctionsCandidate(args);
    return;
  }

  if (domain === "enrichment" && command === "dncp-release-source-check") {
    await runEnrichmentDncpReleaseSourceCheck(args);
    return;
  }

  if (domain === "enrichment" && command === "dncp-document-content") {
    await runEnrichmentDncpDocumentContent(args);
    return;
  }

  if (domain === "serve" && command === "internal-console") {
    await runServeInternalConsole(args);
    return;
  }

  throw new Error(
    `Unsupported command. Use one of:
- tsx src/cli.ts paraguay first-slice
- tsx src/cli.ts paraguay bulk-year --year 2026
- tsx src/cli.ts enrichment opensanctions
- tsx src/cli.ts enrichment opensanctions-hosted-match --dry-run true --limit 25
- tsx src/cli.ts enrichment dncp-supplier-anchor --limit 200 --only-unanchored true --offset 0 --concurrency 4
- tsx src/cli.ts enrichment dnit-ruc-equivalence --limit 10000 --only-anchor-gaps false
- tsx src/cli.ts enrichment idb-sanctions-candidate --candidate-id 59 --update-review true
- tsx src/cli.ts enrichment dncp-release-source-check --entity-name "Entity Name" --limit 5
- tsx src/cli.ts enrichment dncp-document-content --entity-name "Entity Name" --query "contrato" --limit 2
- tsx src/cli.ts database apply-sql --file sql/postgres/015_external_candidate_second_review.sql
- tsx src/cli.ts database apply-sql --file sql/postgres/019_case_evidence_exports.sql
- tsx src/cli.ts database load-bundle --file data/normalized/paraguay/dncp-2026-bulk-processes.json
- tsx src/cli.ts database analyst-brief --source-key py-dncp-bulk-2026
- tsx src/cli.ts database entity-brief --name "Entity Name"
- tsx src/cli.ts database review-queue --source-key py-dncp-bulk-2026
- tsx src/cli.ts database entity-intelligence-queue --limit 25
- tsx src/cli.ts database external-candidates --limit 50
- tsx src/cli.ts database review-external-candidate --candidate-id 1 --status needs_evidence --reviewer "Analyst Name" --notes "Review note"
- tsx src/cli.ts database second-review-external-candidate --candidate-id 1 --decision accepted_match --reviewer "Second Reviewer" --rationale "Source-backed identity review" --limitations "State known limits"
- tsx src/cli.ts database case-evidence-export --case-id 1 --public-only false
- tsx src/cli.ts database case-source-manifest --case-id 1 --public-only false
- tsx src/cli.ts database case-source-bundle --case-id 1 --public-only false --copy-assets true
- tsx src/cli.ts database case-source-index --bundle-path "C:\\path\\to\\bundle" --query "search terms"
- tsx src/cli.ts database entity-anchor-gaps --limit 50
- tsx src/cli.ts database rulebook --source-key py-dncp-bulk-2026
- tsx src/cli.ts serve internal-console --host 127.0.0.1 --port 8787`,
  );
}

void outputRoot;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
