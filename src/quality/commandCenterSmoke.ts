import { serveInternalConsole } from "../server/internalConsole";
import type http from "node:http";

interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

interface SmokeCheck {
  name: string;
  detail: string;
}

function readArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function readNumberArg(args: string[], name: string, fallback: number): number {
  const raw = readArg(args, name);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(record) : [];
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requireCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchText(baseUrl: string, path: string): Promise<string> {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  requireCondition(response.ok, `${path} returned ${response.status}: ${text.slice(0, 400)}`);
  return text;
}

async function fetchJson<T>(baseUrl: string, path: string): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  requireCondition(response.ok, `${path} returned ${response.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as ApiEnvelope<T>;
}

function containsAll(html: string, fragments: string[]): void {
  const missing = fragments.filter((fragment) => !html.includes(fragment));
  requireCondition(missing.length === 0, `Command Center HTML missing expected fragments: ${missing.join(", ")}`);
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const host = readArg(args, "--host") ?? "127.0.0.1";
  const port = readNumberArg(args, "--port", 8797);
  const entityId = readNumberArg(args, "--entity-id", 3940);
  const caseId = readNumberArg(args, "--case-id", 20);
  const baseUrl = `http://${host}:${port}`;
  const checks: SmokeCheck[] = [];
  const server = await serveInternalConsole({ host, port });

  try {
    const html = await fetchText(baseUrl, "/");
    containsAll(html, [
      "Command Center",
      "Methodology, Limits, and Publication Safety",
      "Start with a Real Evidence Trail",
      "guided-proof-path",
      "Open evidence trail",
      "Source verification checklist",
      "artifact-verification-panel",
      "Open current source-pack case",
    ]);
    checks.push({ name: "html", detail: "Command Center shell and verification UI fragments are present." });

    const overview = await fetchJson<Record<string, unknown>>(baseUrl, "/api/overview");
    const counts = record(overview.data.counts);
    requireCondition(asNumber(counts.entities) > 0, "Overview returned zero entities.");
    requireCondition(asNumber(counts.source_records) > 0, "Overview returned zero source records.");
    checks.push({
      name: "overview",
      detail: `${asNumber(counts.entities)} entities and ${asNumber(counts.source_records)} source records visible.`,
    });

    const entitySearch = await fetchJson<Array<Record<string, unknown>>>(
      baseUrl,
      `/api/entities?q=${encodeURIComponent("Consultora Guarani")}&limit=5`,
    );
    requireCondition(entitySearch.data.length > 0, "Entity search returned no results for Consultora Guarani.");
    checks.push({ name: "entity-search", detail: `Entity search returned ${entitySearch.data.length} rows.` });

    const entity = await fetchJson<Record<string, unknown>>(baseUrl, `/api/entities/${entityId}`);
    requireCondition(Boolean(record(entity.data.entity).entity_id), `Entity ${entityId} did not return a dossier.`);
    checks.push({ name: "dossier", detail: `Entity ${entityId} dossier returned.` });

    const network = await fetchJson<Record<string, unknown>>(
      baseUrl,
      `/api/entities/${entityId}/network?limit=24`,
    );
    requireCondition(rows(network.data.nodes).length > 0, `Entity ${entityId} network returned no nodes.`);
    checks.push({
      name: "network",
      detail: `${rows(network.data.nodes).length} nodes and ${rows(network.data.edges).length} edges returned.`,
    });

    const analystCase = await fetchJson<Record<string, unknown>>(
      baseUrl,
      `/api/analyst-cases/${caseId}?limit=50`,
    );
    requireCondition(Boolean(record(analystCase.data.case).id), `Case ${caseId} was not found.`);
    requireCondition(rows(analystCase.data.evidenceLinks).length > 0, `Case ${caseId} returned no evidence links.`);
    checks.push({
      name: "case-packet",
      detail: `Case ${caseId} returned ${rows(analystCase.data.evidenceLinks).length} evidence links.`,
    });

    const artifactRegistry = await fetchJson<Record<string, unknown>>(
      baseUrl,
      `/api/analyst-cases/${caseId}/artifacts?limit=10`,
    );
    const artifacts = rows(artifactRegistry.data.artifacts);
    requireCondition(artifacts.length > 0, `Case ${caseId} returned no generated artifacts.`);
    const latestBundlePath =
      typeof artifactRegistry.data.latestBundlePath === "string"
        ? artifactRegistry.data.latestBundlePath
        : artifacts.find((artifact) => artifact.kind === "source_bundle")?.bundlePath;
    requireCondition(typeof latestBundlePath === "string", `Case ${caseId} has no source bundle path.`);
    const bundlePath = String(latestBundlePath);
    checks.push({ name: "artifact-registry", detail: `${artifacts.length} artifact summaries returned.` });

    const artifactDetail = await fetchJson<Record<string, unknown>>(
      baseUrl,
      `/api/analyst-cases/${caseId}/artifact-detail?path=${encodeURIComponent(bundlePath)}&max_text_chars=8000`,
    );
    const verification = record(artifactDetail.data.verification);
    const verificationChecks = rows(verification.checks);
    const verificationKeys = new Set(verificationChecks.map((check) => String(check.key)));
    requireCondition(verificationChecks.length > 0, "Artifact detail returned no verification checks.");
    requireCondition(verificationKeys.has("path_containment"), "Artifact verification missing path containment.");
    requireCondition(verificationKeys.has("hash_verification"), "Artifact verification missing hash verification.");
    requireCondition(verificationKeys.has("publication_gate"), "Artifact verification missing publication gate.");
    checks.push({
      name: "artifact-verification",
      detail: `${verificationChecks.length} verification checks returned for case ${caseId} bundle.`,
    });

    const readiness = await fetchJson<Record<string, unknown>>(
      baseUrl,
      "/api/entity-source-pack-readiness?limit=3&source_record_limit=10",
    );
    requireCondition(rows(readiness.data.items).length > 0, "Source-pack readiness returned no rows.");
    checks.push({
      name: "source-pack-readiness",
      detail: `${rows(readiness.data.items).length} readiness rows returned.`,
    });

    console.log("Command Center smoke passed.");
    for (const check of checks) {
      console.log(`- ${check.name}: ${check.detail}`);
    }
    console.log("Reminder: smoke checks validate internal navigation and provenance affordances, not public-readiness.");
  } finally {
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
