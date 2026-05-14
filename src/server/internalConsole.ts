import http from "node:http";
import {
  type ExternalCandidateOptions,
  type ListOptions,
  type QueueOptions,
  type SearchEntitiesOptions,
  getEntityNetworkExport,
  getAcceptedExternalMatches,
  getEntityNetwork,
  getEntityProfile,
  getEntityReviewQueue,
  getExternalCandidates,
  getInternalOverview,
  getProcessReviewQueue,
  searchEntities,
} from "../storage/internalApi";
import {
  createAnalystCase,
  createAnalystEvidenceLink,
  createAnalystNote,
  getAnalystCaseEvidenceExport,
  getAnalystCase,
  linkAnalystCaseTarget,
  listAnalystCases,
  listAnalystNotes,
  listSourceRecords,
  getSourceRecord,
  reviewAnalystCasePublicSafety,
} from "../storage/analystWorkspace";
import {
  buildCaseEvidenceExportArtifacts,
  buildCaseSourceAttachmentManifestArtifacts,
  buildCaseSourceBundleArtifacts,
  buildCaseSourceDocumentIndexArtifacts,
} from "../storage/caseEvidenceExport";
import { getCaseArtifactDetail, listCaseArtifacts } from "../storage/caseArtifacts";
import { buildEntitySourcePackArtifacts } from "../storage/entitySourcePack";
import { getEntitySourcePackReadiness } from "../storage/entitySourcePackReadiness";

export interface InternalConsoleOptions {
  host?: string;
  port?: number;
}

function numberParam(url: URL, name: string): number | undefined {
  const value = url.searchParams.get(name);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function textParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)?.trim();
  return value && value.length > 0 ? value : undefined;
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response: http.ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(body);
}

function parseEntityRoute(pathname: string): { entityId: number; network: boolean; exportNetwork: boolean } | undefined {
  const exportMatch = pathname.match(/^\/api\/entities\/(\d+)\/network\/export$/);
  if (exportMatch) {
    const entityId = Number(exportMatch[1]);
    if (!Number.isInteger(entityId) || entityId <= 0) {
      return undefined;
    }

    return {
      entityId,
      network: true,
      exportNetwork: true,
    };
  }

  const match = pathname.match(/^\/api\/entities\/(\d+)(\/network)?$/);
  if (!match) {
    return undefined;
  }

  const entityId = Number(match[1]);
  if (!Number.isInteger(entityId) || entityId <= 0) {
    return undefined;
  }

  return {
    entityId,
    network: Boolean(match[2]),
    exportNetwork: false,
  };
}

function parseEntitySourcePackRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/entities\/(\d+)\/source-packs$/);
  if (!match) {
    return undefined;
  }

  const entityId = Number(match[1]);
  return Number.isInteger(entityId) && entityId > 0 ? entityId : undefined;
}

function parseSourceRecordRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/source-records\/(\d+)$/);
  if (!match) {
    return undefined;
  }

  const recordId = Number(match[1]);
  return Number.isInteger(recordId) && recordId > 0 ? recordId : undefined;
}

function parseCaseLinkRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/analyst-cases\/(\d+)\/links$/);
  if (!match) {
    return undefined;
  }

  const caseId = Number(match[1]);
  return Number.isInteger(caseId) && caseId > 0 ? caseId : undefined;
}

function parseCaseEvidenceRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/analyst-cases\/(\d+)\/evidence-links$/);
  if (!match) {
    return undefined;
  }

  const caseId = Number(match[1]);
  return Number.isInteger(caseId) && caseId > 0 ? caseId : undefined;
}

function parseCaseEvidenceExportRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/analyst-cases\/(\d+)\/evidence-export$/);
  if (!match) {
    return undefined;
  }

  const caseId = Number(match[1]);
  return Number.isInteger(caseId) && caseId > 0 ? caseId : undefined;
}

function parseCaseEvidenceArtifactRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/analyst-cases\/(\d+)\/evidence-artifacts$/);
  if (!match) {
    return undefined;
  }

  const caseId = Number(match[1]);
  return Number.isInteger(caseId) && caseId > 0 ? caseId : undefined;
}

function parseCaseSourceManifestRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/analyst-cases\/(\d+)\/source-manifests$/);
  if (!match) {
    return undefined;
  }

  const caseId = Number(match[1]);
  return Number.isInteger(caseId) && caseId > 0 ? caseId : undefined;
}

function parseCaseSourceBundleRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/analyst-cases\/(\d+)\/source-bundles$/);
  if (!match) {
    return undefined;
  }

  const caseId = Number(match[1]);
  return Number.isInteger(caseId) && caseId > 0 ? caseId : undefined;
}

function parseCaseArtifactsRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/analyst-cases\/(\d+)\/artifacts$/);
  if (!match) {
    return undefined;
  }

  const caseId = Number(match[1]);
  return Number.isInteger(caseId) && caseId > 0 ? caseId : undefined;
}

function parseCaseArtifactDetailRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/analyst-cases\/(\d+)\/artifact-detail$/);
  if (!match) {
    return undefined;
  }

  const caseId = Number(match[1]);
  return Number.isInteger(caseId) && caseId > 0 ? caseId : undefined;
}

function parseCasePublicReviewRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/analyst-cases\/(\d+)\/public-review$/);
  if (!match) {
    return undefined;
  }

  const caseId = Number(match[1]);
  return Number.isInteger(caseId) && caseId > 0 ? caseId : undefined;
}

function parseAnalystCaseRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/analyst-cases\/(\d+)$/);
  if (!match) {
    return undefined;
  }

  const caseId = Number(match[1]);
  return Number.isInteger(caseId) && caseId > 0 ? caseId : undefined;
}

function listOptions(url: URL): ListOptions {
  const limit = numberParam(url, "limit");
  return limit === undefined ? {} : { limit };
}

function searchOptions(url: URL): SearchEntitiesOptions {
  const options: SearchEntitiesOptions = {};
  const q = textParam(url, "q");
  const limit = numberParam(url, "limit");

  if (q !== undefined) {
    options.q = q;
  }

  if (limit !== undefined) {
    options.limit = limit;
  }

  return options;
}

function queueOptions(url: URL): QueueOptions {
  const options: QueueOptions = {};
  const lane = textParam(url, "lane");
  const priority = textParam(url, "priority");
  const limit = numberParam(url, "limit");

  if (lane !== undefined) {
    options.lane = lane;
  }

  if (priority !== undefined) {
    options.priority = priority;
  }

  if (limit !== undefined) {
    options.limit = limit;
  }

  return options;
}

function externalCandidateOptions(url: URL): ExternalCandidateOptions {
  const options: ExternalCandidateOptions = {};
  const reviewStatus = textParam(url, "review_status");
  const secondReviewDecision = textParam(url, "second_review_decision");
  const limit = numberParam(url, "limit");

  if (reviewStatus !== undefined) {
    options.reviewStatus = reviewStatus;
  }

  if (secondReviewDecision !== undefined) {
    options.secondReviewDecision = secondReviewDecision;
  }

  if (limit !== undefined) {
    options.limit = limit;
  }

  return options;
}

function sourceRecordOptions(url: URL): {
  sourceKey?: string;
  externalId?: string;
  recordKind?: string;
  q?: string;
  limit?: number;
} {
  const options: {
    sourceKey?: string;
    externalId?: string;
    recordKind?: string;
    q?: string;
    limit?: number;
  } = {};
  const sourceKey = textParam(url, "source_key");
  const externalId = textParam(url, "external_id");
  const recordKind = textParam(url, "record_kind");
  const q = textParam(url, "q");
  const limit = numberParam(url, "limit");

  if (sourceKey !== undefined) {
    options.sourceKey = sourceKey;
  }

  if (externalId !== undefined) {
    options.externalId = externalId;
  }

  if (recordKind !== undefined) {
    options.recordKind = recordKind;
  }

  if (q !== undefined) {
    options.q = q;
  }

  if (limit !== undefined) {
    options.limit = limit;
  }

  return options;
}

function analystNoteOptions(url: URL): {
  targetType?: string;
  targetId?: string;
  caseId?: number;
  limit?: number;
} {
  const options: {
    targetType?: string;
    targetId?: string;
    caseId?: number;
    limit?: number;
  } = {};
  const targetType = textParam(url, "target_type");
  const targetId = textParam(url, "target_id");
  const caseId = numberParam(url, "case_id");
  const limit = numberParam(url, "limit");

  if (targetType !== undefined) {
    options.targetType = targetType;
  }

  if (targetId !== undefined) {
    options.targetId = targetId;
  }

  if (caseId !== undefined) {
    options.caseId = caseId;
  }

  if (limit !== undefined) {
    options.limit = limit;
  }

  return options;
}

function analystCaseOptions(url: URL): { status?: string; limit?: number } {
  const options: { status?: string; limit?: number } = {};
  const status = textParam(url, "status");
  const limit = numberParam(url, "limit");

  if (status !== undefined) {
    options.status = status;
  }

  if (limit !== undefined) {
    options.limit = limit;
  }

  return options;
}

function networkExportOptions(url: URL): { format?: string; limit?: number } {
  const options: { format?: string; limit?: number } = {};
  const format = textParam(url, "format");
  const limit = numberParam(url, "limit");

  if (format !== undefined) {
    options.format = format;
  }

  if (limit !== undefined) {
    options.limit = limit;
  }

  return options;
}

async function readJsonBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const maxBytes = 64 * 1024;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new Error("Request body is too large for the internal console.");
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function stringField(body: Record<string, unknown>, name: string): string | undefined {
  const value = body[name];
  return typeof value === "string" ? value : undefined;
}

function numberField(body: Record<string, unknown>, name: string): number | undefined {
  const value = body[name];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function recordField(body: Record<string, unknown>, name: string): Record<string, unknown> | undefined {
  const value = body[name];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function booleanField(body: Record<string, unknown>, name: string): boolean | undefined {
  const value = body[name];
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no"].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function stringListField(body: Record<string, unknown>, name: string): string[] | undefined {
  const value = body[name];
  if (Array.isArray(value)) {
    const items = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  if (typeof value === "string") {
    const items = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return items.length > 0 ? items : undefined;
  }

  return undefined;
}

function booleanParam(url: URL, name: string): boolean | undefined {
  const value = textParam(url, name);
  if (value === undefined) {
    return undefined;
  }

  return value === "true" || value === "1";
}

function artifactBuildOptions(
  caseId: number,
  body: Record<string, unknown>,
): { caseId: number; publicOnly?: boolean; limit?: number } {
  const options: { caseId: number; publicOnly?: boolean; limit?: number } = { caseId };
  const publicOnly = booleanField(body, "publicOnly") ?? booleanField(body, "public_only");
  const limit = numberField(body, "limit");

  if (publicOnly !== undefined) {
    options.publicOnly = publicOnly;
  }

  if (limit !== undefined) {
    options.limit = limit;
  }

  return options;
}

function getWriteToken(request: http.IncomingMessage): string | undefined {
  const direct = request.headers["x-centinela-write-token"];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const authorization = request.headers.authorization;
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return undefined;
}

function requireWriteAccess(request: http.IncomingMessage): void {
  const configured = process.env.CENTINELA_WRITE_TOKEN?.trim();
  if (!configured) {
    const error = new Error(
      "Write endpoints are disabled. Set CENTINELA_WRITE_TOKEN, then send it as X-Centinela-Write-Token or Bearer token.",
    );
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }

  if (getWriteToken(request) !== configured) {
    const error = new Error("Invalid or missing Centinela write token.");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
}

function consoleHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Centinela Internal Console</title>
  <style>
    :root {
      --ink: #17201b;
      --muted: #69756e;
      --paper: #f7f0df;
      --panel: rgba(255, 252, 241, 0.88);
      --line: #d6c7a4;
      --accent: #0f6848;
      --accent-2: #9b4f1b;
      --danger-soft: #f3ded2;
      --shadow: 0 18px 42px rgba(50, 40, 20, 0.14);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: var(--ink);
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at 18% 12%, rgba(15, 104, 72, 0.16), transparent 28rem),
        radial-gradient(circle at 82% 0%, rgba(155, 79, 27, 0.13), transparent 22rem),
        linear-gradient(135deg, #fcf5e4 0%, #efe2c5 48%, #f8f1df 100%);
      min-height: 100vh;
    }

    main {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 32px 0 54px;
    }

    header {
      display: grid;
      gap: 16px;
      grid-template-columns: 1fr;
      margin-bottom: 24px;
    }

    h1 {
      margin: 0;
      font-size: clamp(2.4rem, 8vw, 5.7rem);
      line-height: 0.9;
      letter-spacing: -0.08em;
    }

    h2 {
      margin: 0 0 14px;
      font-size: 1.05rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--accent);
    }

    p {
      margin: 0;
    }

    .lede {
      max-width: 820px;
      font-size: 1.05rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .guardrail {
      border: 1px solid #c98059;
      background: var(--danger-soft);
      padding: 12px 14px;
      border-radius: 18px;
      color: #60321f;
      box-shadow: var(--shadow);
    }

    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(12, 1fr);
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 18px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .span-12 { grid-column: span 12; }
    .span-7 { grid-column: span 7; }
    .span-5 { grid-column: span 5; }
    .span-4 { grid-column: span 4; }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
    }

    .stat {
      border-left: 3px solid var(--accent);
      background: rgba(255, 255, 255, 0.45);
      padding: 10px 12px;
      border-radius: 14px;
    }

    .stat strong {
      display: block;
      font-size: 1.5rem;
      line-height: 1;
    }

    .stat span {
      color: var(--muted);
      font-size: 0.86rem;
    }

    form {
      display: flex;
      gap: 10px;
      margin-bottom: 14px;
    }

    input, textarea, select {
      flex: 1;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 11px 14px;
      background: #fffaf0;
      font: inherit;
      color: var(--ink);
    }

    textarea {
      min-height: 88px;
      border-radius: 18px;
      resize: vertical;
    }

    .mini-form {
      display: grid;
      gap: 8px;
      margin-bottom: 12px;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 0.92rem;
    }

    .checkbox-row input {
      flex: 0 0 auto;
      width: auto;
    }

    button {
      border: 0;
      border-radius: 999px;
      background: var(--accent);
      color: white;
      padding: 11px 16px;
      font: inherit;
      cursor: pointer;
    }

    button.secondary {
      background: #2f4037;
    }

    .list {
      display: grid;
      gap: 10px;
    }

    .item {
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.48);
      border-radius: 18px;
      padding: 12px;
    }

    .item button {
      margin-top: 10px;
      padding: 7px 11px;
      font-size: 0.88rem;
    }

    .kicker {
      color: var(--accent-2);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 4px;
    }

    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      background: #1c241f;
      color: #f6eedc;
      padding: 14px;
      border-radius: 18px;
      max-height: 560px;
      overflow: auto;
    }

    a {
      color: var(--accent);
    }

    @media (max-width: 860px) {
      .span-7, .span-5, .span-4 {
        grid-column: span 12;
      }

      form {
        flex-direction: column;
      }
    }

    .app-shell {
      display: grid;
      grid-template-columns: minmax(230px, 280px) minmax(0, 1fr);
      min-height: 100vh;
    }

    .sidebar {
      position: sticky;
      top: 0;
      align-self: start;
      min-height: 100vh;
      padding: 24px;
      color: #f9f4e6;
      background:
        linear-gradient(rgba(14, 32, 27, 0.92), rgba(14, 32, 27, 0.92)),
        radial-gradient(circle at 10% 10%, rgba(218, 165, 96, 0.22), transparent 20rem);
      border-right: 1px solid rgba(255, 255, 255, 0.12);
    }

    .brand-mark {
      width: 46px;
      height: 46px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      color: #123029;
      background: #f4cf72;
      font-weight: 800;
      margin-bottom: 16px;
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
    }

    .brand-title {
      font-size: 1.75rem;
      line-height: 0.95;
      letter-spacing: -0.06em;
      margin-bottom: 8px;
    }

    .brand-subtitle {
      color: rgba(249, 244, 230, 0.72);
      font-size: 0.9rem;
      line-height: 1.45;
      margin-bottom: 22px;
    }

    .nav {
      display: grid;
      gap: 8px;
      margin: 22px 0;
    }

    .nav a {
      color: rgba(249, 244, 230, 0.82);
      text-decoration: none;
      padding: 9px 10px;
      border-radius: 999px;
      border: 1px solid rgba(249, 244, 230, 0.12);
      background: rgba(255, 255, 255, 0.04);
    }

    .nav a:hover,
    .nav a:focus {
      color: #fff7df;
      border-color: rgba(244, 207, 114, 0.5);
      background: rgba(244, 207, 114, 0.1);
    }

    .sidebar-card {
      border: 1px solid rgba(244, 207, 114, 0.22);
      border-radius: 20px;
      padding: 14px;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(249, 244, 230, 0.8);
      font-size: 0.88rem;
      line-height: 1.45;
    }

    .content {
      width: min(1320px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 28px 0 64px;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      gap: 18px;
      align-items: stretch;
      margin-bottom: 18px;
    }

    .hero-copy {
      border-radius: 32px;
      padding: clamp(24px, 4vw, 46px);
      background:
        linear-gradient(135deg, rgba(255, 252, 241, 0.96), rgba(248, 238, 214, 0.82)),
        repeating-linear-gradient(90deg, transparent 0, transparent 31px, rgba(15, 104, 72, 0.07) 32px);
      border: 1px solid rgba(143, 111, 60, 0.28);
      box-shadow: var(--shadow);
    }

    .hero-copy h1 {
      max-width: 820px;
    }

    .hero-card {
      display: grid;
      align-content: space-between;
      border-radius: 32px;
      padding: 22px;
      color: #f9f4e6;
      background:
        radial-gradient(circle at 82% 12%, rgba(244, 207, 114, 0.26), transparent 13rem),
        linear-gradient(145deg, #102c25, #17372f 54%, #573b24);
      box-shadow: var(--shadow);
      min-height: 320px;
    }

    .hero-card h2 {
      color: #f4cf72;
    }

    .hero-card .stat {
      background: rgba(255, 255, 255, 0.08);
      border-left-color: #f4cf72;
    }

    .hero-card .stat span {
      color: rgba(249, 244, 230, 0.76);
    }

    .guardrail {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin: 0 0 18px;
      border-color: rgba(155, 79, 27, 0.34);
      background: rgba(251, 235, 214, 0.82);
    }

    .guardrail strong {
      display: block;
      color: #4a2618;
      margin-bottom: 3px;
    }

    .section-block {
      scroll-margin-top: 22px;
      margin-top: 18px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 14px;
      margin: 0 0 12px;
    }

    .section-header p {
      max-width: 760px;
      color: var(--muted);
      line-height: 1.45;
    }

    .workflow-grid,
    .lane-grid,
    .showcase-grid,
    .method-grid,
    .dossier-grid,
    .case-layout,
    .review-grid {
      display: grid;
      gap: 14px;
    }

    .workflow-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .workflow-step,
    .method-card,
    .showcase-card,
    .summary-card,
    .lane-card {
      border: 1px solid var(--line);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.48);
      padding: 14px;
    }

    .workflow-step strong,
    .summary-card strong,
    .lane-card strong {
      display: block;
      font-size: 1.05rem;
      line-height: 1.2;
      margin-bottom: 6px;
    }

    .workflow-step span,
    .summary-card span,
    .lane-card span {
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.4;
    }

    .lane-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin-top: 14px;
    }

    .showcase-grid {
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    }

    .showcase-card {
      display: grid;
      gap: 9px;
      align-content: space-between;
      min-height: 180px;
    }

    .showcase-card .case-key {
      color: var(--accent-2);
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .dossier-grid {
      grid-template-columns: minmax(0, 1.1fr) minmax(330px, 0.9fr);
    }

    .dossier-summary {
      display: grid;
      gap: 12px;
    }

    .summary-card .summary-value {
      display: block;
      font-family: "Trebuchet MS", Verdana, sans-serif;
      font-size: 1.4rem;
      color: var(--ink);
    }

    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 9px;
      background: rgba(15, 104, 72, 0.1);
      color: #0f4a35;
      border: 1px solid rgba(15, 104, 72, 0.18);
      font-size: 0.82rem;
      font-family: "Trebuchet MS", Verdana, sans-serif;
    }

    .chip.warning {
      background: rgba(155, 79, 27, 0.12);
      color: #783a13;
      border-color: rgba(155, 79, 27, 0.22);
    }

    .network-mini {
      display: grid;
      gap: 9px;
    }

    .graph-canvas {
      position: relative;
      min-height: 360px;
      margin: 12px 0;
      border: 1px solid rgba(141, 114, 69, 0.28);
      border-radius: 24px;
      overflow: hidden;
      background:
        radial-gradient(circle at 50% 50%, rgba(15, 104, 72, 0.1), transparent 16rem),
        linear-gradient(135deg, rgba(255, 250, 240, 0.92), rgba(238, 225, 196, 0.66));
    }

    .graph-canvas svg {
      width: 100%;
      min-height: 360px;
      display: block;
    }

    .graph-edge {
      stroke: rgba(75, 95, 84, 0.42);
      stroke-width: 1.4;
    }

    .graph-edge.accepted_external_match {
      stroke: rgba(15, 104, 72, 0.76);
      stroke-width: 2.2;
    }

    .graph-edge.reviewable_external_candidate {
      stroke: rgba(155, 79, 27, 0.68);
      stroke-dasharray: 6 5;
    }

    .graph-node circle {
      stroke: rgba(31, 48, 41, 0.35);
      stroke-width: 1.2;
      filter: drop-shadow(0 8px 14px rgba(31, 48, 41, 0.14));
    }

    .graph-node text {
      font-family: "Trebuchet MS", Verdana, sans-serif;
      font-size: 11px;
      fill: #24352e;
      paint-order: stroke;
      stroke: rgba(255, 250, 240, 0.9);
      stroke-width: 4px;
      stroke-linejoin: round;
    }

    .graph-node.focus circle { fill: #f4cf72; }
    .graph-node.company circle,
    .graph-node.supplier_company circle,
    .graph-node.buyer_or_institution circle { fill: #3f866d; }
    .graph-node.representative_person circle { fill: #a35a2d; }
    .graph-node.procurement_process circle { fill: #6b7f98; }
    .graph-node.external circle,
    .graph-node[class*="external_"] circle { fill: #263e37; }

    .graph-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 8px 0 12px;
    }

    .graph-controls {
      display: grid;
      grid-template-columns: minmax(92px, 0.8fr) minmax(0, 1.1fr) minmax(0, 1.1fr) auto;
      gap: 8px;
      align-items: end;
      margin: 10px 0 12px;
    }

    .graph-controls label {
      display: grid;
      gap: 4px;
      color: var(--muted);
      font-family: "Trebuchet MS", Verdana, sans-serif;
      font-size: 0.78rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .artifact-browser {
      display: grid;
      gap: 12px;
      margin-bottom: 12px;
    }

    .artifact-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }

    .artifact-card {
      display: grid;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.5);
      padding: 12px;
    }

    .artifact-card button {
      justify-self: start;
      padding: 7px 10px;
      font-size: 0.86rem;
    }

    .queue-controls {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin: 10px 0;
    }

    .queue-controls button,
    .queue-controls input,
    .queue-controls select {
      min-width: 0;
      width: 100%;
    }

    .network-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      align-items: center;
      border-bottom: 1px solid rgba(141, 114, 69, 0.2);
      padding-bottom: 8px;
    }

    .network-row:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }

    .raw-card summary {
      cursor: pointer;
      color: var(--accent);
      font-weight: 700;
      margin-bottom: 8px;
    }

    .case-layout {
      grid-template-columns: minmax(310px, 0.82fr) minmax(0, 1.18fr);
    }

    .case-summary {
      display: grid;
      gap: 12px;
      margin-bottom: 12px;
    }

    .case-packet {
      display: grid;
      gap: 12px;
      margin-bottom: 12px;
    }

    .case-packet-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 10px;
    }

    .packet-section {
      border: 1px solid rgba(141, 114, 69, 0.24);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.48);
      padding: 13px;
      display: grid;
      gap: 10px;
    }

    .packet-section h3 {
      margin: 0;
      font-size: 0.98rem;
    }

    .target-card,
    .evidence-row,
    .timeline-card,
    .source-match-row,
    .verification-check {
      border: 1px solid rgba(141, 114, 69, 0.2);
      border-radius: 16px;
      background: rgba(255, 250, 240, 0.62);
      padding: 11px;
      display: grid;
      gap: 7px;
    }

    .target-card strong,
    .evidence-row strong,
    .timeline-card strong,
    .source-match-row strong,
    .verification-check strong {
      color: var(--ink);
    }

    .target-card span,
    .evidence-row span,
    .timeline-card span,
    .source-match-row span,
    .verification-check span {
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.38;
    }

    .verification-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 10px;
    }

    .verification-check[data-status="pass"] {
      border-color: rgba(61, 117, 85, 0.34);
      background: rgba(236, 248, 240, 0.72);
    }

    .verification-check[data-status="review"] {
      border-color: rgba(184, 132, 44, 0.34);
      background: rgba(255, 247, 225, 0.74);
    }

    .verification-check[data-status="blocked"] {
      border-color: rgba(160, 63, 57, 0.36);
      background: rgba(255, 238, 235, 0.72);
    }

    .packet-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .packet-actions button,
    .source-match-row button,
    .verification-check button {
      justify-self: start;
      padding: 7px 10px;
      font-size: 0.84rem;
    }

    .artifact-detail-preview {
      display: grid;
      gap: 12px;
      margin-bottom: 12px;
    }

    .review-grid {
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }

    .method-grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    .method-card {
      line-height: 1.45;
    }

    .method-stack {
      display: grid;
      gap: 16px;
    }

    .method-principle-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 10px;
    }

    .method-principle {
      border: 1px solid rgba(141, 114, 69, 0.24);
      border-radius: 20px;
      background:
        linear-gradient(145deg, rgba(255, 250, 240, 0.7), rgba(235, 225, 199, 0.46));
      padding: 14px;
      display: grid;
      gap: 8px;
    }

    .method-principle strong {
      color: var(--ink);
    }

    .method-principle span,
    .method-list li {
      color: var(--muted);
      line-height: 1.44;
      font-size: 0.92rem;
    }

    .method-list {
      margin: 0;
      padding-left: 20px;
    }

    .method-card h3,
    .showcase-card h3 {
      margin: 0 0 6px;
      font-size: 1.1rem;
    }

    .method-card p,
    .showcase-card p {
      color: var(--muted);
      line-height: 1.45;
      font-size: 0.92rem;
    }

    .product-note {
      color: var(--muted);
      font-size: 0.92rem;
      line-height: 1.45;
    }

    .dossier-actions,
    .showcase-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .dossier-actions {
      margin-top: 8px;
    }

    .json-pre {
      max-height: 420px;
      font-size: 0.82rem;
    }

    @media (max-width: 1120px) {
      .app-shell {
        grid-template-columns: 1fr;
      }

      .sidebar {
        position: static;
        min-height: auto;
      }

      .nav {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }

      .hero,
      .dossier-grid,
      .case-layout,
      .review-grid {
        grid-template-columns: 1fr;
      }

      .workflow-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 680px) {
      .content {
        width: min(100vw - 18px, 1320px);
        padding-top: 12px;
      }

      .hero-copy,
      .hero-card,
      .panel {
        border-radius: 22px;
        padding: 16px;
      }

      .workflow-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar" aria-label="Centinela navigation">
      <div class="brand-mark">C</div>
      <div class="brand-title">Centinela</div>
      <p class="brand-subtitle">Paraguay integrity intelligence command center. Local, review-first, source-backed.</p>
      <nav class="nav">
        <a href="#overview">Overview</a>
        <a href="#explore">Entities</a>
        <a href="#dossier">Dossier</a>
        <a href="#casework">Casework</a>
        <a href="#reviews">Review queues</a>
        <a href="#methodology">Methodology</a>
      </nav>
      <div class="sidebar-card">
        This console is local-only. It turns procurement, entity, external-candidate, evidence, and source-pack workflows into one explorable analyst surface.
      </div>
    </aside>

    <main class="content">
      <header id="overview" class="hero">
        <div class="hero-copy">
          <h1>Centinela<br />Command Center</h1>
          <p class="lede">A presentable internal surface for Paraguay entity intelligence: search, dossiers, graph-ready relationships, review queues, source packs, case evidence, and public-safety gates in one coherent workspace.</p>
        </div>
        <aside class="hero-card">
          <h2>Live system</h2>
          <div id="stats" class="stats"></div>
          <p class="product-note">Counts come from the live PostgreSQL-backed investigation layer.</p>
        </aside>
      </header>

      <section class="guardrail" aria-label="Safety rule">
        <div>
          <strong>Review-first boundary</strong>
          <p>Centinela surfaces risk signals, identity context, source limitations, and review leads. It does not make accusations or legal conclusions.</p>
        </div>
      </section>

      <section class="panel section-block" aria-labelledby="workflow-title">
        <div class="section-header">
          <div>
            <h2 id="workflow-title">Operating Workflow</h2>
            <p>One visible path from public records to analyst review: signals stay separated from candidates, accepted identity context, evidence, and public-safe outputs.</p>
          </div>
        </div>
        <div id="workflow-stats" class="workflow-grid"></div>
        <div id="platform-lanes" class="lane-grid"></div>
      </section>

      <section id="explore" class="grid section-block">
        <article class="panel span-7">
          <div class="section-header">
            <div>
              <h2>Entity Search</h2>
              <p>Open a company or person dossier, then pivot into source records, notes, graph exports, and source-pack generation.</p>
            </div>
          </div>
          <form id="search-form">
            <input id="search-input" value="CONSULTORA GUARANI" aria-label="Search entities" />
            <button type="submit">Search</button>
          </form>
          <div id="results" class="list"></div>
        </article>

        <article class="panel span-5">
          <div class="section-header">
            <div>
              <h2>Source-Pack Showcase</h2>
              <p>Current source-backed cases that make the platform demonstrable without inventing sample data.</p>
            </div>
          </div>
          <div id="entity-showcase" class="showcase-grid"></div>
        </article>
      </section>

      <section id="dossier" class="section-block">
        <div class="section-header">
          <div>
            <h2>Entity Dossier</h2>
            <p>Company/accountability view inspired by Aleph, Sayari, br/acc, and QuienEsQuien: identity, procurement activity, review state, source records, and relationship pivots stay together.</p>
          </div>
        </div>
        <div class="dossier-grid">
          <article class="panel">
            <div id="entity-summary" class="dossier-summary">
              <div class="summary-card">
                <strong>No entity opened yet</strong>
                <span>Search or choose a source-pack entity to inspect the product-style dossier.</span>
              </div>
            </div>
            <details class="raw-card">
              <summary>Raw dossier and network JSON</summary>
              <pre id="detail" class="json-pre">Search and choose an entity to inspect.</pre>
            </details>
          </article>

          <aside class="panel">
            <h2>Relationship View</h2>
            <div class="graph-controls" aria-label="Graph controls">
              <label>
                Limit
                <input id="network-limit" value="24" aria-label="Network limit" />
              </label>
              <select id="graph-relation-filter" aria-label="Graph relation filter">
                <option value="">All relationships</option>
              </select>
              <select id="graph-kind-filter" aria-label="Graph node type filter">
                <option value="">All node types</option>
              </select>
              <button id="refresh-network" type="button" class="secondary">Refresh graph</button>
            </div>
            <div id="network-graph" class="graph-canvas" aria-label="Graph visualization">
              <div class="summary-card">
                <strong>Open an entity to draw its network</strong>
                <span>Relationships are review pivots, not proof of wrongdoing, ownership, or control.</span>
              </div>
            </div>
            <div class="graph-legend">
              <span class="chip">focus entity</span>
              <span class="chip">counterparty/process</span>
              <span class="chip warning">candidate/limitation</span>
            </div>
            <div id="network-summary" class="network-mini">
              <div class="summary-card">
                <strong>Graph-ready neighborhood</strong>
                <span>Open an entity to see counterparties, representatives, processes, accepted matches, and review candidates.</span>
              </div>
            </div>
            <button id="export-graph" type="button" class="secondary">Load Cytoscape export</button>
            <pre id="graph-export" class="json-pre">Open an entity first.</pre>
          </aside>
        </div>

        <div class="grid section-block">
          <article class="panel span-4">
            <h2>Source Records</h2>
            <p class="product-note">Source-backed records linked to the opened entity or selected evidence path.</p>
            <div id="source-records" class="list"></div>
          </article>

          <article class="panel span-4">
            <h2>Analyst Notes</h2>
            <div class="mini-form">
              <input id="write-token" type="password" placeholder="Write token for saved notes and artifacts" aria-label="Write token" />
              <input id="analyst-name" value="centinela-operator" aria-label="Analyst name" />
              <select id="note-type" aria-label="Note type">
                <option value="analyst_note">Analyst note</option>
                <option value="evidence_note">Evidence note</option>
                <option value="limitation">Limitation</option>
                <option value="follow_up">Follow-up</option>
                <option value="source_check">Source check</option>
                <option value="methodology_note">Methodology note</option>
              </select>
              <textarea id="note-text" placeholder="Saved notes are internal leads and context, not conclusions."></textarea>
              <button id="save-note" type="button">Save entity note</button>
            </div>
            <div id="notes" class="list"></div>
          </article>

          <article class="panel span-4">
            <h2>Field Suggestions</h2>
            <p class="product-note">Open a source record to use exact field paths in evidence links.</p>
            <div id="field-suggestions" class="list"></div>
          </article>
        </div>
      </section>

      <section id="casework" class="panel section-block">
        <div class="section-header">
          <div>
            <h2>Case and Source-Pack Workspace</h2>
            <p>Create or reopen internal cases, link source-record evidence, generate source manifests and bundles, then gate public-only exports through review.</p>
          </div>
        </div>
        <div class="case-layout">
          <div>
            <div class="mini-form">
              <input id="case-title" placeholder="New case title" aria-label="New case title" />
              <select id="case-priority" aria-label="Case priority">
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="low">Low</option>
              </select>
              <button id="create-case" type="button">Create case</button>
              <button id="link-entity-case" type="button" class="secondary">Link current entity to case</button>
              <button id="open-entity-source-pack-case" type="button" class="secondary">Open current source-pack case</button>
              <input id="case-source-query" placeholder="Search source records for this case" aria-label="Case source record search" />
              <button id="search-case-source-records" type="button" class="secondary">Search source records</button>
              <select id="evidence-role" aria-label="Evidence role">
                <option value="context">Context</option>
                <option value="supports_identity_context">Supports identity context</option>
                <option value="supports_review_lead">Supports review lead</option>
                <option value="supports_limitation">Supports limitation</option>
                <option value="contradicts_or_limits">Contradicts or limits</option>
                <option value="needs_follow_up">Needs follow-up</option>
              </select>
              <input id="evidence-field-path" placeholder="Field path, e.g. payload.records[0].name" aria-label="Evidence field path" />
              <input id="evidence-field-value" placeholder="Field value or excerpt" aria-label="Evidence field value" />
              <textarea id="evidence-summary" placeholder="Why this source record matters. Lead, not conclusion."></textarea>
              <textarea id="evidence-limitations" placeholder="What this source record does not prove."></textarea>
              <button id="link-source-evidence" type="button" class="secondary">Link current source record as evidence</button>
              <select id="public-review-status" aria-label="Public safety review status">
                <option value="internal_only">Internal only</option>
                <option value="public_candidate">Public candidate</option>
                <option value="needs_redaction">Needs redaction</option>
                <option value="approved_public">Approved public</option>
                <option value="rejected_public">Rejected public</option>
              </select>
              <textarea id="public-summary" placeholder="Public-safe summary. No accusations. Required for approved public export."></textarea>
              <textarea id="public-limitations" placeholder="Public-safe limitations. Required for approved public export."></textarea>
              <button id="save-public-review" type="button" class="secondary">Save public-safety review</button>
              <button id="load-evidence-export" type="button" class="secondary">Load internal evidence export</button>
              <button id="load-public-export" type="button" class="secondary">Load public-approved export</button>
              <label class="checkbox-row">
                <input id="artifact-public-only" type="checkbox" />
                Public-only artifact mode; requires approved public review.
              </label>
              <input id="artifact-limit" value="50" aria-label="Artifact evidence limit" />
              <input id="source-index-query" value="Consultora Guarani" aria-label="Source-document index query" />
              <input id="source-bundle-path" placeholder="Source bundle path for index refresh" aria-label="Source bundle path" />
              <input id="source-pack-limit" value="10" aria-label="Entity source-pack source-record limit" />
              <input id="source-pack-query" placeholder="Optional source-pack source-record filter" aria-label="Entity source-pack query" />
              <input id="source-pack-record-kinds" placeholder="Optional record kinds, comma-separated" aria-label="Entity source-pack record kinds" />
              <input id="source-pack-case-key" placeholder="Optional case key; blank uses stable entity default" aria-label="Entity source-pack case key" />
              <button id="write-evidence-artifact" type="button" class="secondary">Write evidence artifact</button>
              <button id="write-source-manifest" type="button" class="secondary">Write source manifest</button>
              <button id="write-source-bundle" type="button" class="secondary">Write source bundle + index</button>
              <button id="refresh-source-index" type="button" class="secondary">Refresh bundle source index</button>
              <button id="preview-entity-source-pack" type="button" class="secondary">Preview entity source pack</button>
              <button id="write-entity-source-pack" type="button" class="secondary">Write entity source pack</button>
              <button id="load-case-artifacts" type="button" class="secondary">Load generated artifacts</button>
            </div>
            <div id="cases" class="list"></div>
            <div id="case-source-record-results" class="list"></div>
          </div>
          <div>
            <div id="case-summary" class="case-summary">
              <div class="summary-card">
                <strong>No case opened yet</strong>
                <span>Create or open a case to see linked targets, notes, evidence links, public-review status, and artifacts.</span>
              </div>
            </div>
            <div id="case-review-packet" class="case-packet">
              <div class="summary-card">
                <strong>Review packet not loaded</strong>
                <span>Open a case to see public-safety status, linked targets, source-record evidence, and timeline events as readable review cards.</span>
              </div>
            </div>
            <div id="artifact-browser" class="artifact-browser">
              <div class="summary-card">
                <strong>No artifacts loaded yet</strong>
                <span>Open a case and load generated artifacts to browse evidence packets, manifests, bundles, and source-document indexes.</span>
              </div>
            </div>
            <div id="artifact-detail-preview" class="artifact-detail-preview">
              <div class="summary-card">
                <strong>No artifact preview opened</strong>
                <span>Open a bundle or source-document index to see searchable document matches, snippets, source-record IDs, and use limits.</span>
              </div>
            </div>
            <details class="raw-card" open>
              <summary>Case timeline JSON</summary>
              <pre id="case-detail" class="json-pre">Create or open a case to see the timeline.</pre>
            </details>
            <details class="raw-card">
              <summary>Evidence export JSON</summary>
              <pre id="case-export" class="json-pre">Evidence export appears here after public-safety review.</pre>
            </details>
            <details class="raw-card">
              <summary>Generated artifact registry JSON</summary>
              <pre id="case-artifacts" class="json-pre">Artifact, bundle, and source index paths appear here.</pre>
            </details>
          </div>
        </div>
      </section>

      <section id="reviews" class="review-grid section-block">
        <article class="panel">
          <h2>Accepted Matches</h2>
          <p class="product-note">Second-reviewed identity context only. Not automatic risk findings.</p>
          <div id="accepted" class="list"></div>
        </article>

        <article class="panel">
          <h2>Entity Queue</h2>
          <p class="product-note">Company-level review lanes from local anchors, procurement activity, relationships, and enrichment state.</p>
          <div class="queue-controls">
            <select id="entity-queue-lane" aria-label="Entity queue lane">
              <option value="">All lanes</option>
              <option value="entity_triage">Entity triage</option>
              <option value="external_candidate_review">External candidate review</option>
              <option value="local_anchor_gap">Local anchor gap</option>
              <option value="local_admin_history">Local administrative history</option>
            </select>
            <select id="entity-queue-priority" aria-label="Entity queue priority">
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="triage">Triage</option>
              <option value="normal">Normal</option>
            </select>
            <input id="entity-queue-limit" value="8" aria-label="Entity queue limit" />
            <button id="refresh-entity-queue" type="button" class="secondary">Refresh entities</button>
          </div>
          <div id="entity-queue" class="list"></div>
        </article>

        <article class="panel">
          <h2>External Candidates</h2>
          <p class="product-note">Review-only candidates and diagnostics stay separate from accepted matches.</p>
          <div class="queue-controls">
            <select id="candidate-review-status" aria-label="Candidate review status">
              <option value="">All review states</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="needs_evidence">Needs evidence</option>
              <option value="promotable">Promotable</option>
              <option value="monitor">Monitor</option>
              <option value="rejected">Rejected</option>
            </select>
            <select id="candidate-second-review" aria-label="Candidate second review decision">
              <option value="">All second reviews</option>
              <option value="accepted_match">Accepted match</option>
              <option value="needs_more_evidence">Needs more evidence</option>
              <option value="rejected_match">Rejected match</option>
            </select>
            <input id="candidate-limit" value="8" aria-label="External candidate limit" />
            <button id="refresh-candidates" type="button" class="secondary">Refresh candidates</button>
          </div>
          <div id="candidates" class="list"></div>
        </article>

        <article class="panel">
          <h2>Process Queue</h2>
          <p class="product-note">Procurement process review lanes from DNCP/OCDS-backed risk signals.</p>
          <div class="queue-controls">
            <select id="process-queue-lane" aria-label="Process queue lane">
              <option value="">All lanes</option>
              <option value="competition_review">Competition review</option>
              <option value="procedure_review">Procedure review</option>
              <option value="value_review">Value review</option>
              <option value="data_quality_review">Data quality review</option>
            </select>
            <select id="process-queue-priority" aria-label="Process queue priority">
              <option value="">All priorities</option>
              <option value="priority">Priority</option>
              <option value="enhanced_review">Enhanced review</option>
              <option value="standard_review">Standard review</option>
            </select>
            <input id="process-queue-limit" value="8" aria-label="Process queue limit" />
            <button id="refresh-process-queue" type="button" class="secondary">Refresh processes</button>
          </div>
          <div id="process-queue" class="list"></div>
        </article>

        <article class="panel">
          <h2>Source-Pack Readiness</h2>
          <p class="product-note">Ranks next entity source-pack actions without creating files or new cases.</p>
          <div class="queue-controls">
            <input id="readiness-limit" value="8" aria-label="Readiness limit" />
            <input id="readiness-source-limit" value="10" aria-label="Readiness source-record limit" />
            <button id="refresh-readiness" type="button" class="secondary">Refresh readiness</button>
          </div>
          <div id="source-pack-readiness" class="list"></div>
        </article>
      </section>

      <section id="methodology" class="panel section-block">
        <div class="section-header">
          <div>
            <h2>Methodology, Limits, and Publication Safety</h2>
            <p>The visible layer explains what Centinela can show, what it cannot conclude, and what must happen before anything leaves internal review.</p>
          </div>
        </div>
        <div class="method-stack">
          <div class="method-principle-grid">
            <article class="method-principle">
              <strong>Allowed claims</strong>
              <span>Risk signals, source-backed identity context, anomalies, limitations, and leads for human review.</span>
            </article>
            <article class="method-principle">
              <strong>Blocked claims</strong>
              <span>No accusation, guilt, corruption finding, legal conclusion, ownership conclusion, or automatic public allegation.</span>
            </article>
            <article class="method-principle">
              <strong>Evidence ladder</strong>
              <span>Public source -> source record -> evidence link -> case packet -> public-safety gate. Each step preserves provenance and limits.</span>
            </article>
            <article class="method-principle">
              <strong>External matching</strong>
              <span>Review candidates stay separate from accepted identity context. Accepted matches are identity context only unless separately reviewed.</span>
            </article>
            <article class="method-principle">
              <strong>Source limitations</strong>
              <span>DNCP 404s, scanned PDFs, parser gaps, no comparable external IDs, and missing check digits are recorded as limits, not erased.</span>
            </article>
            <article class="method-principle">
              <strong>Public gate</strong>
              <span>Public-only export requires approved public review, but publication still needs privacy, source, methodology, and UX review.</span>
            </article>
          </div>

          <div class="grid">
            <article class="method-card span-6">
              <h3>Source verification checklist</h3>
              <ul class="method-list">
                <li>Open the source record and check source key, external ID, URL, retrieval time, and source-run status.</li>
                <li>Check field path and field value before relying on an evidence link.</li>
                <li>Read the limitation row; download failures and parser limits are not evidence about an entity.</li>
                <li>For source bundles, verify copied file hashes and original source URLs before public reuse.</li>
                <li>For external candidates, distinguish review-only candidate, rejected diagnostic, accepted identity context, and external risk signal.</li>
              </ul>
            </article>
            <article class="method-card span-6">
              <h3>Reference influence map</h3>
              <p>br/acc shapes provenance and graph-ready relationships. Aleph and Sayari shape casework, dossiers, and document traceability. QuienEsQuien and TodosLosContratos shape company-contract accountability. Integrity Watch, Dozorro, RUBLI, DNCP, Cardinal, GTI, FUNES, and Rosie shape cautious surfacing, review queues, public-safety gates, and explainable limits.</p>
            </article>
          </div>
        </div>
      </section>
    </main>
  </div>

  <script>
    let currentEntityId = null;
    let currentCaseId = null;
    let currentSourceRecordId = null;
    let currentNoteId = null;
    let currentBundlePath = null;
    let currentNetwork = null;
    const sourcePackShortcuts = [
      {
        entityId: 5319,
        caseId: 19,
        name: 'MENDEZ GONZALEZ FLORIANA *',
        caseKey: 'case 19',
        query: 'Mendez Gonzalez Floriana',
        note: 'Source pack for the remaining local identity-anchor gap and official DNCP document limitations.'
      },
      {
        entityId: 3940,
        caseId: 20,
        name: 'CONSULTORA GUARANI SA INGENIEROS CIVILES',
        caseKey: 'case 20',
        query: 'Consultora Guarani',
        note: 'Accepted external identity-context match plus DNCP/IDB source evidence.'
      },
      {
        entityId: 224,
        caseId: 22,
        name: 'PROSALUDFARMA S.A.',
        caseKey: 'case 22',
        query: 'PROSALUDFARMA',
        note: 'High-priority source pack with DNCP document-access limitations preserved.'
      },
      {
        entityId: 261,
        caseId: 23,
        name: 'INDEX S.A.C.I.',
        caseKey: 'case 23',
        query: 'INDEX',
        note: 'Company-contract accountability pack with source-document index matches.'
      },
      {
        entityId: 237,
        caseId: 24,
        name: 'QUIMFA S.A.',
        caseKey: 'case 24',
        query: 'QUIMFA',
        note: 'Entity source pack showing official source metadata and download limits.'
      }
    ];

    async function getJson(path) {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    }

    async function postJson(path, body, token) {
      const headers = { 'content-type': 'application/json' };
      if (token) {
        headers['x-centinela-write-token'] = token;
      }
      const response = await fetch(path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    }

    function text(value) {
      if (value === null || value === undefined || value === '') {
        return 'n/a';
      }
      return String(value);
    }

    function numberText(value) {
      if (value === null || value === undefined || value === '') {
        return '0';
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return text(value);
      }
      return parsed.toLocaleString('en-US');
    }

    function shortText(value, maxLength) {
      const raw = text(value);
      if (raw.length <= maxLength) {
        return raw;
      }
      return raw.slice(0, Math.max(0, maxLength - 1)) + '...';
    }

    function html(value) {
      return text(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function arrayCount(value) {
      return Array.isArray(value) ? value.length : 0;
    }

    function object(value) {
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function setJson(id, value) {
      const node = document.getElementById(id);
      if (node) {
        node.textContent = JSON.stringify(value, null, 2);
      }
    }

    function positiveInput(id, fallback) {
      const parsed = Number(document.getElementById(id).value);
      return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
    }

    function addQueryParam(params, key, value) {
      if (value !== null && value !== undefined && String(value).trim()) {
        params.set(key, String(value).trim());
      }
    }

    function pill(label, warning) {
      return '<span class="chip' + (warning ? ' warning' : '') + '">' + html(label) + '</span>';
    }

    function summaryCard(label, value, note, warning) {
      return '<div class="summary-card">' +
        '<strong>' + html(label) + '</strong>' +
        '<span class="summary-value">' + html(value) + '</span>' +
        '<span>' + html(note) + '</span>' +
        (warning ? '<div class="chip-row">' + pill(warning, true) + '</div>' : '') +
        '</div>';
    }

    function workflowStep(title, count, note) {
      return '<article class="workflow-step">' +
        '<strong>' + html(title) + '</strong>' +
        '<span class="summary-value">' + html(numberText(count)) + '</span>' +
        '<span>' + html(note) + '</span>' +
        '</article>';
    }

    function sourcePackShortcutForEntity(entityId) {
      return sourcePackShortcuts.find((item) => Number(item.entityId) === Number(entityId)) || null;
    }

    async function openSourcePackShortcut(shortcut) {
      if (!shortcut) {
        return;
      }
      document.getElementById('source-index-query').value = shortcut.query || shortcut.name || '';
      await loadEntity(shortcut.entityId);
      await openCase(shortcut.caseId);
      document.getElementById('casework').scrollIntoView({ behavior: 'smooth' });
    }

    function shortcutButtons(shortcut) {
      if (!shortcut) {
        return '';
      }

      return '<div class="dossier-actions">' +
        '<button type="button" class="secondary" data-open-entity="' + html(shortcut.entityId) + '">Open dossier</button>' +
        '<button type="button" class="secondary" data-open-case="' + html(shortcut.caseId) + '">Open source-pack case</button>' +
      '</div>';
    }

    function attachShortcutActions(container) {
      container.querySelectorAll('[data-open-case]').forEach((button) => {
        button.addEventListener('click', () => {
          const caseId = Number(button.getAttribute('data-open-case'));
          const shortcut = sourcePackShortcuts.find((item) => Number(item.caseId) === caseId);
          (shortcut ? openSourcePackShortcut(shortcut) : openCase(caseId)).catch((error) => {
            document.getElementById('case-detail').textContent = error.message;
          });
        });
      });
      attachOpenActions(container);
    }

    function renderShowcase() {
      const container = document.getElementById('entity-showcase');
      if (!container) {
        return;
      }

      container.innerHTML = '';
      sourcePackShortcuts.slice(1).forEach((entity) => {
        const card = document.createElement('article');
        card.className = 'showcase-card';
        const title = document.createElement('h3');
        title.textContent = entity.name;
        const caseKey = document.createElement('div');
        caseKey.className = 'case-key';
        caseKey.textContent = entity.caseKey;
        const note = document.createElement('p');
        note.textContent = entity.note;
        const actions = document.createElement('div');
        actions.className = 'showcase-actions';
        const dossierButton = document.createElement('button');
        dossierButton.className = 'secondary';
        dossierButton.type = 'button';
        dossierButton.textContent = 'Open dossier';
        dossierButton.onclick = () => loadEntity(entity.entityId).then(() => {
          document.getElementById('dossier').scrollIntoView({ behavior: 'smooth' });
        });
        const caseButton = document.createElement('button');
        caseButton.className = 'secondary';
        caseButton.type = 'button';
        caseButton.textContent = 'Open case packet';
        caseButton.onclick = () => openSourcePackShortcut(entity).catch((error) => {
          document.getElementById('case-detail').textContent = error.message;
        });
        actions.appendChild(dossierButton);
        actions.appendChild(caseButton);
        card.appendChild(caseKey);
        card.appendChild(title);
        card.appendChild(note);
        card.appendChild(actions);
        container.appendChild(card);
      });
    }

    function renderItem(container, title, lines, button) {
      const item = document.createElement('div');
      item.className = 'item';
      const [kickerLine, ...bodyLines] = lines;
      const kicker = document.createElement('div');
      kicker.className = 'kicker';
      kicker.textContent = text(kickerLine);
      const titleNode = document.createElement('strong');
      titleNode.textContent = text(title);
      item.appendChild(kicker);
      item.appendChild(titleNode);
      bodyLines.forEach((line) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text(line);
        item.appendChild(paragraph);
      });
      if (button) {
        item.appendChild(button);
      }
      container.appendChild(item);
    }

    async function loadOverview() {
      const overview = await getJson('/api/overview');
      const stats = document.getElementById('stats');
      const counts = overview.data.counts || {};
      stats.innerHTML = '';
      [
        ['Entities', counts.entities],
        ['Processes', counts.procurement_processes],
        ['Source records', counts.source_records],
        ['Evidence links', counts.analyst_evidence_links],
        ['Source candidates', counts.external_candidate_records],
        ['Accepted context', counts.accepted_second_reviews]
      ].forEach(([label, value]) => {
        const stat = document.createElement('div');
        stat.className = 'stat';
        stat.innerHTML = '<strong>' + html(numberText(value)) + '</strong><span>' + html(label) + '</span>';
        stats.appendChild(stat);
      });

      const workflow = document.getElementById('workflow-stats');
      if (workflow) {
        workflow.innerHTML = [
          workflowStep('Public records', counts.source_records, 'Source records and official-source payloads.'),
          workflowStep('Entities', counts.entities, 'Companies, people, institutions, and external entities.'),
          workflowStep('Relationships', counts.relationship_edges, 'Graph-ready links for review and pivoting.'),
          workflowStep('Review candidates', counts.external_candidate_records, 'Near matches and diagnostics kept separate.'),
          workflowStep('Evidence links', counts.analyst_evidence_links, 'Case evidence bundles with limitations.')
        ].join('');
      }

      const lanes = document.getElementById('platform-lanes');
      if (lanes) {
        const anchor = overview.data.anchorCoverage || {};
        const entityLaneText = (overview.data.entityReviewLanes || [])
          .slice(0, 4)
          .map((lane) => text(lane.review_lane) + ': ' + numberText(lane.count))
          .join(' | ') || 'No entity lanes returned';
        const processLaneText = (overview.data.processReviewLanes || [])
          .slice(0, 4)
          .map((lane) => text(lane.review_lane) + ': ' + numberText(lane.count))
          .join(' | ') || 'No process lanes returned';
        const secondReviewText = (overview.data.secondReviews || [])
          .map((row) => text(row.decision) + ': ' + numberText(row.count))
          .join(' | ') || 'No second reviews yet';

        lanes.innerHTML = [
          '<article class="lane-card"><strong>Local company anchor</strong><span>' +
            html(numberText(anchor.anchored_supplier_company_count || anchor.anchored_count || 0)) +
            ' anchored suppliers, ' +
            html(numberText(anchor.supplier_company_count || anchor.total_supplier_company_count || 0)) +
            ' tracked.</span></article>',
          '<article class="lane-card"><strong>Entity review lanes</strong><span>' + html(entityLaneText) + '</span></article>',
          '<article class="lane-card"><strong>Process review lanes</strong><span>' + html(processLaneText) + '</span></article>',
          '<article class="lane-card"><strong>Second review governance</strong><span>' + html(secondReviewText) + '</span></article>'
        ].join('');
      }
    }

    async function searchEntities(event) {
      if (event) {
        event.preventDefault();
      }
      const q = document.getElementById('search-input').value;
      const payload = await getJson('/api/entities?q=' + encodeURIComponent(q) + '&limit=8');
      const results = document.getElementById('results');
      results.innerHTML = '';
      if (!payload.data.length) {
        renderItem(results, 'No entities found', [
          'search',
          'Try a company name, person name, RUC, DNCP identifier, or source term.'
        ]);
        return;
      }
      payload.data.forEach((entity) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Open dossier + network';
        button.onclick = () => loadEntity(entity.entity_id);
        renderItem(results, entity.entity_name, [
          entity.entity_type + ' #' + entity.entity_id,
          'lane: ' + text(entity.review_lane),
          'signals: ' + text(entity.total_risk_signals) + ', representatives: ' + text(entity.representative_count)
        ], button);
      });
    }

    function renderEntitySummary(profile, network) {
      const container = document.getElementById('entity-summary');
      if (!container) {
        return;
      }

      const entity = profile.entity || {};
      const identifiers = profile.identifiers || [];
      const localProfiles = profile.localProfiles || [];
      const acceptedMatches = profile.acceptedMatches || [];
      const candidates = profile.externalCandidates || [];
      const secondReviews = profile.secondReviews || [];
      const sourceRecords = profile.sourceRecords || [];
      const processes = profile.processes || [];
      const representatives = profile.representatives || [];
      const shortcut = sourcePackShortcutForEntity(entity.entity_id || entity.id || currentEntityId);
      const chips = [
        entity.entity_type,
        entity.anchor_status,
        entity.review_lane,
        entity.review_priority,
        acceptedMatches.length ? 'accepted identity context' : null,
        candidates.length ? 'review candidates/diagnostics' : null,
        sourceRecords.length ? 'source records linked' : null
      ].filter(Boolean).map((value, index) => pill(value, index > 2)).join('');
      const firstIdentifiers = identifiers
        .slice(0, 6)
        .map((item) => text(item.scheme) + ':' + text(item.value))
        .join(' | ');
      const leadQuestion = entity.lead_question || 'Open queue context or source records for the next review question.';
      const limitation = profile.disclaimer || 'This dossier is review context, not a finding.';
      const shortcutCard = shortcut
        ? '<div class="summary-card">' +
            '<strong>Source-pack case shortcut</strong>' +
            '<span>' + html(shortcut.caseKey + ' links this entity dossier to a source-backed case packet and local source-document index.') + '</span>' +
            '<span>' + html(shortcut.note) + '</span>' +
            shortcutButtons(shortcut) +
          '</div>'
        : '<div class="summary-card">' +
            '<strong>No source-pack case shortcut</strong>' +
            '<span>This entity may still have source records. Use preview/write source pack when a case packet is needed.</span>' +
          '</div>';

      container.innerHTML =
        '<div class="summary-card">' +
          '<strong>' + html(entity.entity_name || 'Entity') + '</strong>' +
          '<span>' + html(leadQuestion) + '</span>' +
          '<div class="chip-row">' + chips + '</div>' +
        '</div>' +
        '<div class="grid">' +
          '<div class="span-4">' + summaryCard('Processes', numberText(entity.total_process_count), 'Linked procurement processes.') + '</div>' +
          '<div class="span-4">' + summaryCard('Risk signals', numberText(entity.total_risk_signals), 'Signals for review, not accusations.') + '</div>' +
          '<div class="span-4">' + summaryCard('Representatives', numberText(representatives.length), 'DNCP legal representative links where available.') + '</div>' +
          '<div class="span-4">' + summaryCard('Source records', numberText(sourceRecords.length), 'Official or external records linked to this entity.') + '</div>' +
          '<div class="span-4">' + summaryCard('Accepted context', numberText(acceptedMatches.length), 'Second-reviewed external identity context.') + '</div>' +
          '<div class="span-4">' + summaryCard('Network edges', numberText(arrayCount(network.edges)), 'Graph-ready relationship leads.') + '</div>' +
        '</div>' +
        '<div class="summary-card">' +
          '<strong>Identifiers and local profiles</strong>' +
          '<span>' + html(firstIdentifiers || 'No identifiers returned by the profile endpoint.') + '</span>' +
          '<div class="chip-row">' +
            pill('local profiles: ' + numberText(localProfiles.length), false) +
            pill('second reviews: ' + numberText(secondReviews.length), false) +
            pill('linked processes shown: ' + numberText(processes.length), false) +
          '</div>' +
        '</div>' +
        shortcutCard +
        '<div class="summary-card">' +
          '<strong>Use limits</strong>' +
          '<span>' + html(limitation) + '</span>' +
        '</div>';
      attachShortcutActions(container);
    }

    function selectedValue(id) {
      const node = document.getElementById(id);
      return node ? node.value : '';
    }

    function networkLimit() {
      const node = document.getElementById('network-limit');
      if (!node) {
        return 24;
      }
      const parsed = Number(node.value);
      return Number.isFinite(parsed) && parsed > 0 ? Math.max(6, Math.min(60, Math.trunc(parsed))) : 24;
    }

    function nodeKey(node) {
      return text(object(node).id);
    }

    function setSelectOptions(id, values, emptyLabel) {
      const select = document.getElementById(id);
      if (!select) {
        return;
      }

      const current = select.value;
      const uniqueValues = Array.from(new Set((values || []).map(text).filter((value) => value !== 'n/a'))).sort();
      select.innerHTML =
        '<option value="">' + html(emptyLabel) + '</option>' +
        uniqueValues.map((value) => '<option value="' + html(value) + '">' + html(value) + '</option>').join('');
      if (uniqueValues.includes(current)) {
        select.value = current;
      }
    }

    function populateNetworkControls(network) {
      const edges = (network && network.edges) || [];
      const nodes = (network && network.nodes) || [];
      setSelectOptions('graph-relation-filter', edges.map((edge) => edge.relation), 'All relationships');
      setSelectOptions('graph-kind-filter', nodes.map((node) => node.kind), 'All node types');
    }

    function applyNetworkFilters(network) {
      const nodes = (network && network.nodes) || [];
      const edges = (network && network.edges) || [];
      const relationFilter = selectedValue('graph-relation-filter');
      const kindFilter = selectedValue('graph-kind-filter');
      const focus = nodes.find((node) => node.metadata && node.metadata.role === 'focus') || nodes[0];
      const visibleNodeIds = new Set();

      if (focus) {
        visibleNodeIds.add(nodeKey(focus));
      }

      let filteredEdges = relationFilter
        ? edges.filter((edge) => text(edge.relation) === relationFilter)
        : edges.slice();

      if (kindFilter) {
        nodes
          .filter((node) => text(node.kind) === kindFilter)
          .forEach((node) => visibleNodeIds.add(nodeKey(node)));
        filteredEdges = filteredEdges.filter((edge) =>
          visibleNodeIds.has(text(edge.source)) || visibleNodeIds.has(text(edge.target))
        );
      } else if (!relationFilter) {
        nodes.forEach((node) => visibleNodeIds.add(nodeKey(node)));
      }

      filteredEdges.forEach((edge) => {
        visibleNodeIds.add(text(edge.source));
        visibleNodeIds.add(text(edge.target));
      });

      const visibleNodes = nodes.filter((node) => visibleNodeIds.has(nodeKey(node)));
      const visibleEdges = filteredEdges.filter((edge) =>
        visibleNodeIds.has(text(edge.source)) && visibleNodeIds.has(text(edge.target))
      );

      return {
        nodes: visibleNodes.length ? visibleNodes : focus ? [focus] : [],
        edges: visibleEdges,
        relationFilter,
        kindFilter
      };
    }

    function renderNetworkSummary(network) {
      const container = document.getElementById('network-summary');
      if (!container) {
        return;
      }

      const edges = network.edges || [];
      const nodes = network.nodes || [];
      const filtered = applyNetworkFilters(network);
      const byRelation = edges.reduce((accumulator, edge) => {
        const relation = text(edge.relation);
        accumulator[relation] = (accumulator[relation] || 0) + 1;
        return accumulator;
      }, {});
      const relationRows = Object.entries(byRelation)
        .slice(0, 8)
        .map(([relation, count]) => (
          '<div class="network-row"><span>' + html(relation) + '</span><strong>' + html(numberText(count)) + '</strong></div>'
        ))
        .join('');

      container.innerHTML =
        '<div class="summary-card">' +
          '<strong>One-hop relationship map</strong>' +
          '<span>' + html(numberText(nodes.length)) + ' nodes and ' + html(numberText(edges.length)) + ' edges. These are review pivots, not proof of control or misconduct.</span>' +
          '<div class="chip-row">' +
            pill('visible: ' + numberText(filtered.nodes.length) + ' nodes', false) +
            pill('visible edges: ' + numberText(filtered.edges.length), false) +
            (filtered.relationFilter ? pill('relation: ' + filtered.relationFilter, true) : '') +
            (filtered.kindFilter ? pill('type: ' + filtered.kindFilter, true) : '') +
          '</div>' +
        '</div>' +
        (relationRows || '<div class="summary-card"><strong>No graph edges returned</strong><span>Try another entity or expand source coverage.</span></div>');
    }

    function renderNetworkGraph(network) {
      const container = document.getElementById('network-graph');
      if (!container) {
        return;
      }

      const filtered = applyNetworkFilters(network || {});
      const nodes = filtered.nodes || [];
      const edges = filtered.edges || [];
      if (!nodes.length) {
        container.innerHTML = '<div class="summary-card"><strong>No graph nodes returned</strong><span>Open an entity with relationships to draw the network.</span></div>';
        return;
      }

      const width = 720;
      const height = 380;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.34;
      const focus = nodes.find((node) => node.metadata && node.metadata.role === 'focus') || nodes[0];
      const others = nodes.filter((node) => nodeKey(node) !== nodeKey(focus)).slice(0, Math.max(1, networkLimit() - 1));
      const positions = new Map();
      positions.set(nodeKey(focus), { x: centerX, y: centerY, node: focus, focus: true });

      others.forEach((node, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(others.length, 1) - Math.PI / 2;
        const jitter = index % 2 === 0 ? 0 : 24;
        positions.set(nodeKey(node), {
          x: centerX + Math.cos(angle) * (radius + jitter),
          y: centerY + Math.sin(angle) * (radius + jitter),
          node,
          focus: false
        });
      });

      const edgeMarkup = edges.slice(0, networkLimit() * 3).map((edge) => {
        const source = positions.get(text(edge.source));
        const target = positions.get(text(edge.target));
        if (!source || !target) {
          return '';
        }
        const relationClass = text(edge.relation).replace(/[^a-zA-Z0-9_-]/g, '_');
        return '<line class="graph-edge ' + html(relationClass) + '" x1="' + source.x + '" y1="' + source.y + '" x2="' + target.x + '" y2="' + target.y + '"><title>' + html(edge.relation) + '</title></line>';
      }).join('');

      const nodeMarkup = Array.from(positions.values()).map((position) => {
        const node = position.node;
        const kindClass = text(node.kind).replace(/[^a-zA-Z0-9_-]/g, '_');
        const nodeClass = position.focus ? 'focus' : kindClass;
        const size = position.focus ? 22 : 15;
        const labelOffset = position.focus ? 34 : 26;
        return '<g class="graph-node ' + html(nodeClass) + '" transform="translate(' + position.x + ' ' + position.y + ')">' +
          '<circle r="' + size + '"><title>' + html(node.kind + ': ' + node.label) + '</title></circle>' +
          '<text text-anchor="middle" y="' + labelOffset + '">' + html(shortText(node.label, position.focus ? 38 : 24)) + '</text>' +
          '</g>';
      }).join('');

      container.innerHTML =
        '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Entity relationship graph">' +
          edgeMarkup +
          nodeMarkup +
        '</svg>';
    }

    async function loadEntity(entityId) {
      currentEntityId = entityId;
      const [profile, network] = await Promise.all([
        getJson('/api/entities/' + entityId),
        getJson('/api/entities/' + entityId + '/network?limit=' + networkLimit())
      ]);
      currentNetwork = network.data;
      populateNetworkControls(currentNetwork);
      setJson('detail', {
        profile: profile.data,
        network: network.data
      });
      renderEntitySummary(profile.data, network.data);
      renderNetworkSummary(network.data);
      renderNetworkGraph(network.data);
      renderSourceRecords(profile.data.sourceRecords || []);
      renderNotes(profile.data.analystNotes || []);
      document.getElementById('graph-export').textContent = 'Ready to export entity #' + entityId + '.';
    }

    async function refreshCurrentNetwork() {
      if (!currentEntityId) {
        document.getElementById('network-summary').innerHTML = '<div class="summary-card"><strong>No entity opened yet</strong><span>Open an entity before refreshing the graph.</span></div>';
        return;
      }

      const network = await getJson('/api/entities/' + currentEntityId + '/network?limit=' + networkLimit());
      currentNetwork = network.data;
      populateNetworkControls(currentNetwork);
      renderNetworkSummary(currentNetwork);
      renderNetworkGraph(currentNetwork);
      document.getElementById('graph-export').textContent = 'Refreshed graph for entity #' + currentEntityId + ' with limit ' + networkLimit() + '.';
    }

    function rerenderCurrentNetwork() {
      if (!currentNetwork) {
        return;
      }
      renderNetworkSummary(currentNetwork);
      renderNetworkGraph(currentNetwork);
    }

    async function openSourceRecord(recordId) {
      currentSourceRecordId = Number(recordId);
      const payload = await getJson('/api/source-records/' + recordId);
      setJson('detail', payload.data);
      renderFieldSuggestions(payload.data.fieldSuggestions || []);
    }

    function renderFieldSuggestions(suggestions) {
      const container = document.getElementById('field-suggestions');
      container.innerHTML = '';
      if (!suggestions.length) {
        renderItem(container, 'No field suggestions found', [
          'field helper',
          'Use the source record JSON manually if needed.'
        ]);
        return;
      }

      suggestions.slice(0, 8).forEach((suggestion) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Use field';
        button.onclick = () => {
          document.getElementById('evidence-field-path').value = suggestion.path;
          document.getElementById('evidence-field-value').value = suggestion.valuePreview;
          document.getElementById('evidence-role').value = suggestion.evidenceRoleHint || 'context';
          document.getElementById('evidence-summary').value = suggestion.reason + ' Field: ' + suggestion.path + '.';
        };
        renderItem(container, suggestion.path, [
          suggestion.evidenceRoleHint,
          suggestion.valuePreview,
          suggestion.reason
        ], button);
      });
    }

    function renderSourceRecords(records) {
      const container = document.getElementById('source-records');
      container.innerHTML = '';
      if (!records.length) {
        renderItem(container, 'No direct source records found', [
          'source drilldown',
          'Use /api/source-records for broader source search.'
        ]);
        return;
      }
      records.forEach((record) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Open source record';
        button.onclick = () => openSourceRecord(record.id);
        renderItem(container, record.source_key + ' #' + record.external_id, [
          record.record_kind,
          'record ID: ' + record.id
        ], button);
      });
    }

    function renderNotes(notes) {
      const container = document.getElementById('notes');
      container.innerHTML = '';
      if (!notes.length) {
        renderItem(container, 'No saved notes for this entity', [
          'analyst workspace',
          'Add one when a review needs durable context.'
        ]);
        return;
      }
      notes.forEach((note) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Use as evidence note';
        button.onclick = () => {
          currentNoteId = Number(note.id);
          document.getElementById('detail').textContent = 'Selected note #' + note.id + ' for source-record evidence linking.';
        };
        renderItem(container, note.note_text, [
          note.note_type + ' / ' + note.visibility,
          'by ' + text(note.analyst) + ' at ' + text(note.created_at),
          'linked source records: ' + text(note.linked_source_record_count)
        ], button);
      });
    }

    async function saveCurrentEntityNote() {
      if (!currentEntityId) {
        document.getElementById('detail').textContent = 'Open an entity before saving a note.';
        return;
      }
      const token = document.getElementById('write-token').value;
      const noteText = document.getElementById('note-text').value;
      const analyst = document.getElementById('analyst-name').value || 'centinela-operator';
      const noteType = document.getElementById('note-type').value;
      const payload = await postJson('/api/analyst-notes', {
        targetType: 'entity',
        targetId: String(currentEntityId),
        noteText,
        analyst,
        noteType,
        caseId: currentCaseId ? Number(currentCaseId) : undefined,
        provenance: {
          source: 'internal_console',
          nonAccusatoryUse: true
        }
      }, token);
      currentNoteId = Number(payload.data.id);
      document.getElementById('note-text').value = '';
      const notes = await getJson('/api/analyst-notes?target_type=entity&target_id=' + encodeURIComponent(String(currentEntityId)) + '&limit=20');
      renderNotes(notes.data);
      document.getElementById('detail').textContent = JSON.stringify(payload.data, null, 2);
      if (currentCaseId) {
        await openCase(currentCaseId);
      }
    }

    async function exportCurrentGraph() {
      if (!currentEntityId) {
        document.getElementById('graph-export').textContent = 'Open an entity before exporting a graph.';
        return;
      }
      const payload = await getJson('/api/entities/' + currentEntityId + '/network/export?format=cytoscape&limit=' + networkLimit());
      document.getElementById('graph-export').textContent = JSON.stringify(payload.data, null, 2);
    }

    async function loadAccepted() {
      const payload = await getJson('/api/accepted-matches?limit=5');
      const container = document.getElementById('accepted');
      container.innerHTML = '';
      if (!payload.data.length) {
        renderItem(container, 'No accepted matches returned', [
          'second review',
          'Accepted identity context appears here after second review.'
        ]);
        return;
      }
      payload.data.forEach((match) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Open local entity';
        button.onclick = () => loadEntity(match.entity_id);
        renderItem(container, match.entity_name + ' -> ' + match.external_name, [
          match.decision,
          'accepted match ID: ' + text(match.accepted_match_id),
          'limit: ' + text(match.limitations)
        ], button);
      });
    }

    async function loadCases() {
      const payload = await getJson('/api/analyst-cases?limit=8');
      const container = document.getElementById('cases');
      container.innerHTML = '';
      if (!payload.data.length) {
        renderItem(container, 'No saved cases yet', [
          'casework',
          'Create one to link entities, notes, records, and review leads.'
        ]);
        return;
      }
      payload.data.forEach((item) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Open case packet';
        button.onclick = () => openCase(item.id);
        renderItem(container, item.title, [
          item.priority + ' / ' + item.status,
          'public review: ' + text(item.public_review_status),
          'links: ' + text(item.linked_target_count) + ', notes: ' + text(item.note_count)
        ], button);
      });
    }

    function renderCaseSummary(data) {
      const container = document.getElementById('case-summary');
      if (!container) {
        return;
      }

      const item = data.case || {};
      const links = data.links || [];
      const notes = data.notes || [];
      const evidenceLinks = data.evidenceLinks || [];
      const publicReviews = data.publicReviews || [];
      const timeline = data.timeline || [];
      const publicStatus = item.public_review_status || 'not reviewed for public use';
      container.innerHTML =
        '<div class="summary-card">' +
          '<strong>' + html(item.title || 'Case #' + text(item.id || currentCaseId)) + '</strong>' +
          '<span>' + html(item.summary || 'Internal casework container for review, evidence, and source-pack artifacts.') + '</span>' +
          '<div class="chip-row">' +
            pill('status: ' + text(item.status || 'open'), false) +
            pill('priority: ' + text(item.priority || 'normal'), false) +
            pill('public gate: ' + text(publicStatus), publicStatus !== 'approved_public') +
          '</div>' +
        '</div>' +
        '<div class="grid">' +
          '<div class="span-4">' + summaryCard('Links', numberText(links.length), 'Entities, source records, candidates, or other targets.') + '</div>' +
          '<div class="span-4">' + summaryCard('Notes', numberText(notes.length), 'Internal analyst context only.') + '</div>' +
          '<div class="span-4">' + summaryCard('Evidence links', numberText(evidenceLinks.length), 'Source-backed review bundles.') + '</div>' +
          '<div class="span-4">' + summaryCard('Timeline events', numberText(timeline.length), 'Case creation, notes, links, evidence, and reviews.') + '</div>' +
          '<div class="span-4">' + summaryCard('Public reviews', numberText(publicReviews.length), 'Append-only safety decisions.') + '</div>' +
          '<div class="span-4">' + summaryCard('Case ID', text(item.id || currentCaseId), 'Use this for CLI artifact commands.') + '</div>' +
        '</div>';
    }

    function attachOpenActions(container) {
      container.querySelectorAll('[data-open-entity]').forEach((button) => {
        button.addEventListener('click', () => {
          loadEntity(Number(button.getAttribute('data-open-entity'))).catch((error) => {
            document.getElementById('detail').textContent = error.message;
          });
        });
      });

      container.querySelectorAll('[data-open-source-record]').forEach((button) => {
        button.addEventListener('click', () => {
          openSourceRecord(Number(button.getAttribute('data-open-source-record'))).catch((error) => {
            document.getElementById('detail').textContent = error.message;
          });
        });
      });
    }

    function caseTargetButton(link) {
      const targetType = text(link.target_type);
      const targetId = text(link.target_id);
      if (targetType === 'entity') {
        return '<button type="button" class="secondary" data-open-entity="' + html(targetId) + '">Open dossier</button>';
      }
      if (targetType === 'source_record') {
        return '<button type="button" class="secondary" data-open-source-record="' + html(targetId) + '">Open source record</button>';
      }
      return '';
    }

    function renderCaseReviewPacket(data) {
      const container = document.getElementById('case-review-packet');
      if (!container) {
        return;
      }

      const item = data.case || {};
      const links = data.links || [];
      const notes = data.notes || [];
      const evidenceLinks = data.evidenceLinks || [];
      const publicReviews = data.publicReviews || [];
      const timeline = data.timeline || [];
      const latestReview = publicReviews[0] || {};
      const publicStatus = text(item.public_review_status || latestReview.review_status || 'internal_only');
      const publicAllowed = publicStatus === 'approved_public';
      const targetCards = links.slice(0, 10).map((link) => (
        '<article class="target-card">' +
          '<strong>' + html(link.label || link.target_type || 'Linked target') + '</strong>' +
          '<span>' + html(text(link.target_type) + ' #' + text(link.target_id)) + '</span>' +
          '<span>' + html(shortText(link.rationale || 'Linked for case review context.', 150)) + '</span>' +
          '<div class="packet-actions">' + caseTargetButton(link) + '</div>' +
        '</article>'
      )).join('');
      const evidenceRows = evidenceLinks.slice(0, 12).map((row) => (
        '<article class="evidence-row">' +
          '<strong>' + html(text(row.evidence_role) + ' / source record #' + text(row.source_record_id)) + '</strong>' +
          '<span>' + html(text(row.source_key) + ' | ' + text(row.record_kind) + ' | ' + text(row.external_id)) + '</span>' +
          '<span>' + html(shortText(row.evidence_summary || row.analyst_interpretation || 'Source linked for review context.', 190)) + '</span>' +
          '<span>Field: ' + html(shortText(text(row.field_path) + ' = ' + text(row.field_value), 170)) + '</span>' +
          '<span>Limits: ' + html(shortText(row.limitations || 'No limitation text recorded on this evidence link.', 170)) + '</span>' +
          '<div class="packet-actions">' +
            '<button type="button" class="secondary" data-open-source-record="' + html(row.source_record_id) + '">Open source</button>' +
          '</div>' +
        '</article>'
      )).join('');
      const timelineRows = timeline.slice(0, 8).map((event) => (
        '<article class="timeline-card">' +
          '<strong>' + html(event.title || event.event_type || 'Timeline event') + '</strong>' +
          '<span>' + html(text(event.event_at) + ' | ' + text(event.event_type) + ' | ' + text(event.actor)) + '</span>' +
          '<span>' + html(shortText(event.body || 'Internal case timeline event.', 170)) + '</span>' +
        '</article>'
      )).join('');

      container.innerHTML =
        '<div class="packet-section">' +
          '<h3>Review packet</h3>' +
          '<p class="product-note">' + html(data.disclaimer || 'Internal review context only. Not a public finding.') + '</p>' +
          '<div class="chip-row">' +
            pill(publicAllowed ? 'public gate approved' : 'public gate not approved', !publicAllowed) +
            pill('linked targets: ' + numberText(links.length), false) +
            pill('evidence links: ' + numberText(evidenceLinks.length), false) +
            pill('notes: ' + numberText(notes.length), false) +
          '</div>' +
        '</div>' +
        '<div class="case-packet-grid">' +
          '<section class="packet-section">' +
            '<h3>Public-safety gate</h3>' +
            '<div class="target-card">' +
              '<strong>' + html(publicStatus) + '</strong>' +
              '<span>' + html(publicAllowed ? 'Public-only export is technically allowed, but publication still needs methodology, privacy, and UX review.' : 'This case remains internal until an approved_public review records a public-safe summary and limitations.') + '</span>' +
              '<span>Summary: ' + html(shortText(latestReview.public_summary || item.summary || 'No public-safe summary recorded.', 190)) + '</span>' +
              '<span>Limitations: ' + html(shortText(latestReview.public_limitations || 'No public-safe limitations recorded.', 190)) + '</span>' +
            '</div>' +
          '</section>' +
          '<section class="packet-section">' +
            '<h3>Linked targets</h3>' +
            (targetCards || '<div class="target-card"><strong>No linked targets</strong><span>Link an entity, source record, candidate, or accepted match to make this case navigable.</span></div>') +
          '</section>' +
          '<section class="packet-section">' +
            '<h3>Source-backed evidence</h3>' +
            (evidenceRows || '<div class="evidence-row"><strong>No evidence links</strong><span>Open a source record and link it as evidence to build a packet.</span></div>') +
          '</section>' +
          '<section class="packet-section">' +
            '<h3>Timeline</h3>' +
            (timelineRows || '<div class="timeline-card"><strong>No timeline events</strong><span>Case creation, notes, evidence links, and public reviews will appear here.</span></div>') +
          '</section>' +
        '</div>';

      attachOpenActions(container);
    }

    async function openCase(caseId) {
      currentCaseId = caseId;
      const payload = await getJson('/api/analyst-cases/' + caseId + '?limit=50');
      renderCaseSummary(payload.data);
      renderCaseReviewPacket(payload.data);
      setJson('case-detail', payload.data);
      const status = payload.data.case && payload.data.case.public_review_status;
      if (status) {
        document.getElementById('public-review-status').value = status;
      }
      await fetchCaseArtifacts(true).catch(() => undefined);
    }

    async function createCase() {
      const token = document.getElementById('write-token').value;
      const title = document.getElementById('case-title').value;
      const priority = document.getElementById('case-priority').value;
      const analyst = document.getElementById('analyst-name').value || 'centinela-operator';
      const payload = await postJson('/api/analyst-cases', {
        title,
        priority,
        createdBy: analyst,
        metadata: {
          source: 'internal_console',
          nonAccusatoryUse: true
        }
      }, token);
      document.getElementById('case-title').value = '';
      await loadCases();
      await openCase(payload.data.id);
    }

    async function linkCurrentEntityToCase() {
      if (!currentEntityId || !currentCaseId) {
        document.getElementById('case-detail').textContent = 'Open both an entity and a case before linking.';
        return;
      }
      const token = document.getElementById('write-token').value;
      const analyst = document.getElementById('analyst-name').value || 'centinela-operator';
      const payload = await postJson('/api/analyst-cases/' + currentCaseId + '/links', {
        targetType: 'entity',
        targetId: String(currentEntityId),
        label: 'Entity #' + currentEntityId,
        rationale: 'Linked from internal console for analyst review. This is a lead, not a conclusion.',
        createdBy: analyst,
        metadata: {
          source: 'internal_console',
          nonAccusatoryUse: true
        }
      }, token);
      await loadCases();
      await openCase(currentCaseId);
      document.getElementById('detail').textContent = JSON.stringify(payload.data, null, 2);
    }

    async function openCurrentEntitySourcePackCase() {
      if (!currentEntityId) {
        document.getElementById('case-detail').textContent = 'Open an entity before opening its source-pack case.';
        return;
      }

      const shortcut = sourcePackShortcutForEntity(currentEntityId);
      if (!shortcut) {
        document.getElementById('case-detail').textContent =
          'No known source-pack shortcut for entity #' + currentEntityId + '. Use Preview entity source pack or Write entity source pack if this entity needs a packet.';
        return;
      }

      await openSourcePackShortcut(shortcut);
    }

    async function searchCaseSourceRecords() {
      const q = document.getElementById('case-source-query').value;
      const path = q
        ? '/api/source-records?q=' + encodeURIComponent(q) + '&limit=8'
        : '/api/source-records?limit=8';
      const payload = await getJson(path);
      const container = document.getElementById('case-source-record-results');
      container.innerHTML = '';
      if (!payload.data.length) {
        renderItem(container, 'No source records found', [
          'case evidence search',
          'Try a company name, external ID, RUC, or source-specific term.'
        ]);
        return;
      }
      payload.data.forEach((record) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Open and suggest fields';
        button.onclick = () => openSourceRecord(record.id);
        renderItem(container, record.source_key + ' #' + record.external_id, [
          record.record_kind,
          'record ID: ' + record.id
        ], button);
      });
    }

    async function linkCurrentSourceRecordEvidence() {
      if (!currentCaseId || !currentSourceRecordId) {
        document.getElementById('case-detail').textContent = 'Open both a case and a source record before linking evidence.';
        return;
      }

      const token = document.getElementById('write-token').value;
      const analyst = document.getElementById('analyst-name').value || 'centinela-operator';
      const summary = document.getElementById('evidence-summary').value ||
        'Source record linked for analyst review context. This is not a conclusion.';
      const targetType = currentEntityId ? 'entity' : 'source_record';
      const targetId = currentEntityId ? String(currentEntityId) : String(currentSourceRecordId);
      const payload = await postJson('/api/analyst-cases/' + currentCaseId + '/evidence-links', {
        sourceRecordId: Number(currentSourceRecordId),
        noteId: currentNoteId ? Number(currentNoteId) : undefined,
        targetType,
        targetId,
        fieldPath: document.getElementById('evidence-field-path').value,
        fieldValue: document.getElementById('evidence-field-value').value,
        evidenceSummary: summary,
        limitations: document.getElementById('evidence-limitations').value,
        evidenceRole: document.getElementById('evidence-role').value,
        createdBy: analyst,
        metadata: {
          source: 'internal_console',
          nonAccusatoryUse: true
        }
      }, token);
      document.getElementById('evidence-summary').value = '';
      document.getElementById('evidence-limitations').value = '';
      await loadCases();
      await openCase(currentCaseId);
      document.getElementById('detail').textContent = JSON.stringify(payload.data, null, 2);
    }

    async function savePublicReview() {
      if (!currentCaseId) {
        document.getElementById('case-export').textContent = 'Open a case before saving public-safety review.';
        return;
      }

      const token = document.getElementById('write-token').value;
      const analyst = document.getElementById('analyst-name').value || 'centinela-operator';
      const payload = await postJson('/api/analyst-cases/' + currentCaseId + '/public-review', {
        reviewStatus: document.getElementById('public-review-status').value,
        publicSummary: document.getElementById('public-summary').value,
        publicLimitations: document.getElementById('public-limitations').value,
        reviewedBy: analyst,
        metadata: {
          source: 'internal_console',
          nonAccusatoryUse: true,
          publicSafetyGate: true
        }
      }, token);
      await loadCases();
      await openCase(currentCaseId);
      document.getElementById('case-export').textContent = JSON.stringify(payload.data, null, 2);
    }

    async function loadCaseEvidenceExport(publicOnly) {
      if (!currentCaseId) {
        document.getElementById('case-export').textContent = 'Open a case before loading evidence export.';
        return;
      }

      const path = '/api/analyst-cases/' + currentCaseId + '/evidence-export?limit=50' +
        (publicOnly ? '&public_only=true' : '');
      const payload = await getJson(path);
      document.getElementById('case-export').textContent = JSON.stringify(payload.data, null, 2);
    }

    function artifactLimit() {
      const parsed = Number(document.getElementById('artifact-limit').value);
      return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
    }

    function artifactRequestBody(extra) {
      const body = Object.assign({
        publicOnly: document.getElementById('artifact-public-only').checked,
        limit: artifactLimit(),
        provenance: {
          source: 'internal_console',
          nonAccusatoryUse: true,
          localArtifactOnly: true
        }
      }, extra || {});
      return body;
    }

    function sourcePackLimit() {
      const parsed = Number(document.getElementById('source-pack-limit').value);
      return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : undefined;
    }

    function sourcePackRecordKinds() {
      const raw = document.getElementById('source-pack-record-kinds').value;
      const items = raw.split(',').map((item) => item.trim()).filter(Boolean);
      return items.length ? items : undefined;
    }

    function sourcePackRequestBody(dryRun) {
      const body = {
        caseId: currentCaseId ? Number(currentCaseId) : undefined,
        caseKey: document.getElementById('source-pack-case-key').value || undefined,
        sourceRecordLimit: sourcePackLimit(),
        recordKinds: sourcePackRecordKinds(),
        query: document.getElementById('source-pack-query').value || undefined,
        sourceIndexQuery: document.getElementById('source-index-query').value || undefined,
        publicOnly: document.getElementById('artifact-public-only').checked,
        copyAssets: true,
        createdBy: document.getElementById('analyst-name').value || 'centinela-operator',
        dryRun,
        provenance: {
          source: 'internal_console',
          nonAccusatoryUse: true,
          localArtifactOnly: true
        }
      };

      Object.keys(body).forEach((key) => {
        if (body[key] === undefined) {
          delete body[key];
        }
      });

      return body;
    }

    function artifactCountsText(artifact) {
      const counts = artifact.counts || {};
      return Object.entries(counts)
        .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
        .slice(0, 4)
        .map(([key, value]) => key + ': ' + numberText(value))
        .join(' | ');
    }

    function artifactDetailButton(label, artifactPath) {
      if (!artifactPath) {
        return '';
      }

      return '<button type="button" class="secondary" data-artifact-path="' + html(artifactPath) + '">' + html(label) + '</button>';
    }

    function renderVerificationPanel(verification) {
      const data = object(verification);
      const summary = object(data.summary);
      const checks = Array.isArray(data.checks) ? data.checks : [];
      const nextSteps = Array.isArray(data.nextSteps) ? data.nextSteps : [];
      if (!checks.length) {
        return '';
      }

      const status = text(summary.status || 'review');
      const rows = checks.map((check) => {
        const item = object(check);
        const itemStatus = text(item.status || 'review');
        return '<article class="verification-check" data-status="' + html(itemStatus) + '">' +
          '<strong>' + html(text(item.label || item.key || 'Verification check')) + '</strong>' +
          '<span>Status: ' + html(itemStatus) + '</span>' +
          '<span>' + html(shortText(item.detail || 'Review this artifact before relying on it.', 220)) + '</span>' +
        '</article>';
      }).join('');
      const nextStepRows = nextSteps
        .slice(0, 4)
        .map((step) => '<li>' + html(shortText(step, 180)) + '</li>')
        .join('');

      return '<div class="packet-section" id="artifact-verification-panel">' +
        '<h3>Artifact and source verification</h3>' +
        '<p class="product-note">' + html(text(summary.headline || 'Use this as a local review aid, not as publication clearance.')) + '</p>' +
        '<div class="chip-row">' +
          pill('verification: ' + status, status !== 'pass') +
          pill('passed: ' + numberText(summary.passedChecks), false) +
          pill('review: ' + numberText(summary.reviewChecks), Number(summary.reviewChecks || 0) > 0) +
          pill('blocked: ' + numberText(summary.blockedChecks), Number(summary.blockedChecks || 0) > 0) +
        '</div>' +
        '<div class="verification-grid">' + rows + '</div>' +
        (nextStepRows ? '<ul class="method-list">' + nextStepRows + '</ul>' : '') +
      '</div>';
    }

    function renderArtifactBrowser(registry) {
      const container = document.getElementById('artifact-browser');
      if (!container) {
        return;
      }

      const data = registry && registry.data ? registry.data : registry;
      const artifacts = (data && data.artifacts) || [];
      if (!artifacts.length) {
        container.innerHTML = '<div class="summary-card"><strong>No generated artifacts found</strong><span>Write or load a case source pack to browse local evidence packets and source bundles.</span></div>';
        return;
      }

      container.innerHTML =
        '<div class="summary-card">' +
          '<strong>Generated local artifacts</strong>' +
          '<span>' + html(numberText(artifacts.length)) + ' artifact summaries under ' + html(data.artifactRootRelativePath || data.artifactRoot || 'the runtime case folder') + '.</span>' +
          '<div class="chip-row">' + pill('local review only', true) + pill('not publication-ready', true) + '</div>' +
        '</div>' +
        '<div class="artifact-grid">' +
          artifacts.map((artifact) => {
            const files = artifact.files || {};
            const jsonPath = files.json && files.json.path;
            const markdownPath = files.markdown && files.markdown.path;
            const bundleIndexPath = files.bundleIndex && files.bundleIndex.path;
            const sourceIndexPath = files.sourceDocumentIndexJson && files.sourceDocumentIndexJson.path;
            const bundlePath = artifact.bundlePath;
            return '<article class="artifact-card">' +
              '<strong>' + html(artifact.kind) + '</strong>' +
              '<span>' + html(artifactCountsText(artifact) || 'No count summary returned') + '</span>' +
              '<span>' + html(artifact.useLimit || 'Local review artifact only.') + '</span>' +
              '<div class="chip-row">' +
                pill('public: ' + text(artifact.publicOnly === true), artifact.publicOnly !== true) +
                pill('gate: ' + text(artifact.publicSafetyStatus || 'n/a'), artifact.publicSafetyStatus !== 'approved_public') +
              '</div>' +
              artifactDetailButton('Open JSON', jsonPath || bundleIndexPath) +
              artifactDetailButton('Open Markdown', markdownPath) +
              artifactDetailButton('Open bundle', bundlePath) +
              artifactDetailButton('Open source index', sourceIndexPath) +
            '</article>';
          }).join('') +
        '</div>';

      container.querySelectorAll('[data-artifact-path]').forEach((button) => {
        button.addEventListener('click', () => {
          loadArtifactDetail(button.getAttribute('data-artifact-path')).catch((error) => {
            document.getElementById('case-artifacts').textContent = error.message;
          });
        });
      });
    }

    function renderArtifactDetailPreview(detail) {
      const container = document.getElementById('artifact-detail-preview');
      if (!container) {
        return;
      }

      const parsedJson = object(detail && detail.parsedJson);
      const index = detail && detail.sourceDocumentIndex
        ? detail.sourceDocumentIndex
        : Array.isArray(parsedJson.documents)
          ? parsedJson
          : null;
      const bundleIndex = object(detail && detail.bundleIndex);
      const file = object(detail && detail.file);
      const counts = object(index && index.counts);
      const documents = Array.isArray(index && index.documents) ? index.documents : [];
      const matchedDocuments = documents.filter((document) => document.queryMatched === true);
      const previewDocuments = (matchedDocuments.length ? matchedDocuments : documents).slice(0, 6);

      const rows = previewDocuments.map((document) => {
        const sourceRecordIds = Array.isArray(document.sourceRecordIds) ? document.sourceRecordIds.map(text) : [];
        const evidenceLinkIds = Array.isArray(document.evidenceLinkIds) ? document.evidenceLinkIds.map(text) : [];
        const firstSourceRecordId = sourceRecordIds[0];
        return '<article class="source-match-row">' +
          '<strong>' + html(text(document.documentId) + ': ' + text(document.fileName || document.bundleRelativePath)) + '</strong>' +
          '<span>' + html(text(document.status) + ' | copied: ' + text(document.copiedStatus || 'n/a') + ' | query match: ' + text(document.queryMatched === true)) + '</span>' +
          '<span>Source records: ' + html(sourceRecordIds.join(', ') || 'n/a') + ' | Evidence links: ' + html(evidenceLinkIds.join(', ') || 'n/a') + '</span>' +
          '<span>Snippet: ' + html(shortText(document.querySnippet || document.indexedTextPreview || 'No snippet available.', 220)) + '</span>' +
          '<span>Use limit: ' + html(shortText(document.useLimit || 'Verify original source context before reuse.', 170)) + '</span>' +
          (firstSourceRecordId ? '<button type="button" class="secondary" data-open-source-record="' + html(firstSourceRecordId) + '">Open source record</button>' : '') +
        '</article>';
      }).join('');

      const bundleCounts = object(bundleIndex.counts);
      const bundleText = Object.keys(bundleCounts).length
        ? 'Bundle counts: ' + Object.entries(bundleCounts).slice(0, 6).map(([key, value]) => key + ': ' + numberText(value)).join(' | ')
        : 'No bundle counts returned for this artifact.';

      container.innerHTML =
        '<div class="packet-section">' +
          '<h3>Artifact preview</h3>' +
          '<p class="product-note">' + html(detail.disclaimer || 'Local artifact preview for review navigation only.') + '</p>' +
          '<div class="chip-row">' +
            pill('kind: ' + text(detail.kind), false) +
            pill('file: ' + shortText(file.name || file.path || 'selected artifact', 44), false) +
            pill('query: ' + text(index && index.query), false) +
            pill('matches: ' + numberText(counts.queryMatchCount), Number(counts.queryMatchCount || 0) === 0) +
          '</div>' +
          '<span>' + html(bundleText) + '</span>' +
        '</div>' +
        renderVerificationPanel(detail.verification) +
        '<div class="packet-section">' +
          '<h3>Source-document matches</h3>' +
          (rows || '<div class="source-match-row"><strong>No source-document index rows</strong><span>Open a source bundle or source-document-index JSON artifact to see document-level matches.</span></div>') +
        '</div>';

      attachOpenActions(container);
    }

    async function loadArtifactDetail(artifactPath) {
      if (!currentCaseId || !artifactPath) {
        document.getElementById('case-artifacts').textContent = 'Open a case and choose an artifact path first.';
        return;
      }

      const payload = await getJson(
        '/api/analyst-cases/' + currentCaseId + '/artifact-detail?path=' +
        encodeURIComponent(artifactPath) +
        '&max_text_chars=16000'
      );
      document.getElementById('case-artifacts').textContent = JSON.stringify(payload.data, null, 2);
      renderArtifactDetailPreview(payload.data);
    }

    async function fetchCaseArtifacts(updateOutput) {
      if (!currentCaseId) {
        if (updateOutput) {
          document.getElementById('case-artifacts').textContent = 'Open a case before loading artifacts.';
        }
        return null;
      }

      const payload = await getJson('/api/analyst-cases/' + currentCaseId + '/artifacts?limit=25');
      if (payload.data.latestBundlePath) {
        currentBundlePath = payload.data.latestBundlePath;
        document.getElementById('source-bundle-path').value = currentBundlePath;
      }
      if (updateOutput) {
        document.getElementById('case-artifacts').textContent = JSON.stringify(payload.data, null, 2);
      }
      renderArtifactBrowser(payload);
      return payload;
    }

    async function writeEvidenceArtifact() {
      if (!currentCaseId) {
        document.getElementById('case-artifacts').textContent = 'Open a case before writing artifacts.';
        return;
      }

      const token = document.getElementById('write-token').value;
      const payload = await postJson(
        '/api/analyst-cases/' + currentCaseId + '/evidence-artifacts',
        artifactRequestBody(),
        token
      );
      const registry = await fetchCaseArtifacts(false);
      document.getElementById('case-artifacts').textContent = JSON.stringify({
        created: payload.data,
        registry: registry ? registry.data : null
      }, null, 2);
    }

    async function writeSourceManifest() {
      if (!currentCaseId) {
        document.getElementById('case-artifacts').textContent = 'Open a case before writing artifacts.';
        return;
      }

      const token = document.getElementById('write-token').value;
      const payload = await postJson(
        '/api/analyst-cases/' + currentCaseId + '/source-manifests',
        artifactRequestBody(),
        token
      );
      const registry = await fetchCaseArtifacts(false);
      document.getElementById('case-artifacts').textContent = JSON.stringify({
        created: payload.data,
        registry: registry ? registry.data : null
      }, null, 2);
    }

    async function writeSourceBundle() {
      if (!currentCaseId) {
        document.getElementById('case-artifacts').textContent = 'Open a case before writing artifacts.';
        return;
      }

      const token = document.getElementById('write-token').value;
      const query = document.getElementById('source-index-query').value;
      const payload = await postJson(
        '/api/analyst-cases/' + currentCaseId + '/source-bundles',
        artifactRequestBody({
          copyAssets: true,
          query
        }),
        token
      );
      const bundle = payload.data.bundle || payload.data;
      if (bundle.bundlePath) {
        currentBundlePath = bundle.bundlePath;
        document.getElementById('source-bundle-path').value = currentBundlePath;
      }
      const registry = await fetchCaseArtifacts(false);
      document.getElementById('case-artifacts').textContent = JSON.stringify({
        created: payload.data,
        registry: registry ? registry.data : null
      }, null, 2);
    }

    async function refreshSourceIndex() {
      const bundlePath = document.getElementById('source-bundle-path').value || currentBundlePath;
      if (!bundlePath) {
        document.getElementById('case-artifacts').textContent = 'Write a source bundle first, or paste a bundle path.';
        return;
      }

      const token = document.getElementById('write-token').value;
      const query = document.getElementById('source-index-query').value;
      const payload = await postJson('/api/source-document-indexes', {
        bundlePath,
        query,
        provenance: {
          source: 'internal_console',
          nonAccusatoryUse: true,
          localArtifactOnly: true
        }
      }, token);
      const registry = await fetchCaseArtifacts(false);
      document.getElementById('case-artifacts').textContent = JSON.stringify({
        refreshed: payload.data,
        registry: registry ? registry.data : null
      }, null, 2);
    }

    async function runEntitySourcePack(dryRun) {
      if (!currentEntityId) {
        document.getElementById('case-artifacts').textContent = 'Open an entity before generating a source pack.';
        return;
      }

      const token = document.getElementById('write-token').value;
      const payload = await postJson(
        '/api/entities/' + currentEntityId + '/source-packs',
        sourcePackRequestBody(dryRun),
        token
      );

      if (payload.data.caseId) {
        currentCaseId = Number(payload.data.caseId);
        await loadCases();
        await openCase(currentCaseId);
      }

      if (payload.data.sourceBundlePath) {
        currentBundlePath = payload.data.sourceBundlePath;
        document.getElementById('source-bundle-path').value = currentBundlePath;
      }

      const registry = currentCaseId && !dryRun ? await fetchCaseArtifacts(false).catch(() => null) : null;
      document.getElementById('case-artifacts').textContent = JSON.stringify({
        sourcePack: payload.data,
        registry: registry ? registry.data : null
      }, null, 2);
    }

    async function loadEntityQueue() {
      const params = new URLSearchParams();
      params.set('limit', String(positiveInput('entity-queue-limit', 8)));
      addQueryParam(params, 'lane', document.getElementById('entity-queue-lane').value);
      addQueryParam(params, 'priority', document.getElementById('entity-queue-priority').value);
      const queue = await getJson('/api/queue/entities?' + params.toString());
      const queueNode = document.getElementById('entity-queue');
      queueNode.innerHTML = '';
      if (!queue.data.length) {
        renderItem(queueNode, 'No entity queue rows returned', [
          'entity review',
          'Queue rows appear after the entity-intelligence views refresh.'
        ]);
      }
      queue.data.forEach((item) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Open dossier';
        button.onclick = () => loadEntity(item.entity_id);
        renderItem(queueNode, item.entity_name, [
          item.review_priority + ' / ' + item.review_lane,
          item.lead_question
        ], button);
      });
    }

    async function loadExternalCandidateQueue() {
      const params = new URLSearchParams();
      params.set('limit', String(positiveInput('candidate-limit', 8)));
      addQueryParam(params, 'review_status', document.getElementById('candidate-review-status').value);
      addQueryParam(params, 'second_review_decision', document.getElementById('candidate-second-review').value);
      const candidates = await getJson('/api/external-candidates?' + params.toString());
      const candidateNode = document.getElementById('candidates');
      candidateNode.innerHTML = '';
      if (!candidates.data.length) {
        renderItem(candidateNode, 'No candidate rows returned', [
          'external candidate review',
          'Review-only candidates and diagnostics appear here.'
        ]);
      }
      candidates.data.forEach((item) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Open local entity';
        button.onclick = () => loadEntity(item.entity_id);
        renderItem(candidateNode, item.entity_name + ' -> ' + item.external_name, [
          item.suggested_review_status || item.review_status,
          'candidate #' + item.id,
          text(item.review_next_step)
        ], button);
      });
    }

    async function loadProcessQueue() {
      const params = new URLSearchParams();
      params.set('limit', String(positiveInput('process-queue-limit', 8)));
      addQueryParam(params, 'lane', document.getElementById('process-queue-lane').value);
      addQueryParam(params, 'priority', document.getElementById('process-queue-priority').value);
      const processes = await getJson('/api/queue/processes?' + params.toString());
      const processNode = document.getElementById('process-queue');
      processNode.innerHTML = '';
      if (!processes.data.length) {
        renderItem(processNode, 'No process queue rows returned', [
          'process review',
          'Try a different lane or priority filter.'
        ]);
        return;
      }
      processes.data.forEach((item) => {
        renderItem(processNode, item.title || item.process_id, [
          text(item.review_priority) + ' / ' + text(item.review_lane),
          'buyer: ' + text(item.buyer_name),
          'signals: ' + text(item.risk_signal_count) + ', value: ' + text(item.total_contract_value),
          text(item.lead_question)
        ]);
      });
    }

    async function loadSourcePackReadiness() {
      const params = new URLSearchParams();
      params.set('limit', String(positiveInput('readiness-limit', 8)));
      params.set('source_record_limit', String(positiveInput('readiness-source-limit', 10)));
      const readiness = await getJson('/api/entity-source-pack-readiness?' + params.toString());
      const container = document.getElementById('source-pack-readiness');
      container.innerHTML = '';
      if (!readiness.data.items.length) {
        renderItem(container, 'No readiness rows returned', [
          'source-pack readiness',
          'The readiness query returned no ranked companies.'
        ]);
        return;
      }
      readiness.data.items.forEach((item) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Open dossier';
        button.onclick = () => loadEntity(item.entityId);
        renderItem(container, item.entityName, [
          item.recommendedAction,
          item.rationale,
          'source records: ' + numberText(item.sourceRecordCount) + ', evidence links: ' + numberText(item.sourcePackEvidenceCount),
          item.command
        ], button);
      });
    }

    async function loadQueues() {
      await Promise.all([
        loadEntityQueue(),
        loadExternalCandidateQueue(),
        loadProcessQueue(),
        loadSourcePackReadiness()
      ]);
    }

    document.getElementById('search-form').addEventListener('submit', searchEntities);
    document.getElementById('save-note').addEventListener('click', () => {
      saveCurrentEntityNote().catch((error) => {
        document.getElementById('detail').textContent = error.message;
      });
    });
    document.getElementById('export-graph').addEventListener('click', () => {
      exportCurrentGraph().catch((error) => {
        document.getElementById('graph-export').textContent = error.message;
      });
    });
    document.getElementById('refresh-network').addEventListener('click', () => {
      refreshCurrentNetwork().catch((error) => {
        document.getElementById('network-summary').innerHTML = '<div class="summary-card"><strong>Graph refresh failed</strong><span>' + html(error.message) + '</span></div>';
      });
    });
    document.getElementById('graph-relation-filter').addEventListener('change', rerenderCurrentNetwork);
    document.getElementById('graph-kind-filter').addEventListener('change', rerenderCurrentNetwork);
    document.getElementById('create-case').addEventListener('click', () => {
      createCase().catch((error) => {
        document.getElementById('case-detail').textContent = error.message;
      });
    });
    document.getElementById('link-entity-case').addEventListener('click', () => {
      linkCurrentEntityToCase().catch((error) => {
        document.getElementById('case-detail').textContent = error.message;
      });
    });
    document.getElementById('open-entity-source-pack-case').addEventListener('click', () => {
      openCurrentEntitySourcePackCase().catch((error) => {
        document.getElementById('case-detail').textContent = error.message;
      });
    });
    document.getElementById('search-case-source-records').addEventListener('click', () => {
      searchCaseSourceRecords().catch((error) => {
        document.getElementById('case-detail').textContent = error.message;
      });
    });
    document.getElementById('link-source-evidence').addEventListener('click', () => {
      linkCurrentSourceRecordEvidence().catch((error) => {
        document.getElementById('case-detail').textContent = error.message;
      });
    });
    document.getElementById('save-public-review').addEventListener('click', () => {
      savePublicReview().catch((error) => {
        document.getElementById('case-export').textContent = error.message;
      });
    });
    document.getElementById('load-evidence-export').addEventListener('click', () => {
      loadCaseEvidenceExport(false).catch((error) => {
        document.getElementById('case-export').textContent = error.message;
      });
    });
    document.getElementById('load-public-export').addEventListener('click', () => {
      loadCaseEvidenceExport(true).catch((error) => {
        document.getElementById('case-export').textContent = error.message;
      });
    });
    document.getElementById('write-evidence-artifact').addEventListener('click', () => {
      writeEvidenceArtifact().catch((error) => {
        document.getElementById('case-artifacts').textContent = error.message;
      });
    });
    document.getElementById('write-source-manifest').addEventListener('click', () => {
      writeSourceManifest().catch((error) => {
        document.getElementById('case-artifacts').textContent = error.message;
      });
    });
    document.getElementById('write-source-bundle').addEventListener('click', () => {
      writeSourceBundle().catch((error) => {
        document.getElementById('case-artifacts').textContent = error.message;
      });
    });
    document.getElementById('refresh-source-index').addEventListener('click', () => {
      refreshSourceIndex().catch((error) => {
        document.getElementById('case-artifacts').textContent = error.message;
      });
    });
    document.getElementById('preview-entity-source-pack').addEventListener('click', () => {
      runEntitySourcePack(true).catch((error) => {
        document.getElementById('case-artifacts').textContent = error.message;
      });
    });
    document.getElementById('write-entity-source-pack').addEventListener('click', () => {
      runEntitySourcePack(false).catch((error) => {
        document.getElementById('case-artifacts').textContent = error.message;
      });
    });
    document.getElementById('load-case-artifacts').addEventListener('click', () => {
      fetchCaseArtifacts(true).catch((error) => {
        document.getElementById('case-artifacts').textContent = error.message;
      });
    });
    document.getElementById('refresh-entity-queue').addEventListener('click', () => {
      loadEntityQueue().catch((error) => {
        document.getElementById('entity-queue').textContent = error.message;
      });
    });
    document.getElementById('refresh-candidates').addEventListener('click', () => {
      loadExternalCandidateQueue().catch((error) => {
        document.getElementById('candidates').textContent = error.message;
      });
    });
    document.getElementById('refresh-process-queue').addEventListener('click', () => {
      loadProcessQueue().catch((error) => {
        document.getElementById('process-queue').textContent = error.message;
      });
    });
    document.getElementById('refresh-readiness').addEventListener('click', () => {
      loadSourcePackReadiness().catch((error) => {
        document.getElementById('source-pack-readiness').textContent = error.message;
      });
    });
    renderShowcase();
    loadOverview().then(loadAccepted).then(loadQueues).then(loadCases).then(() => searchEntities()).catch((error) => {
      document.getElementById('detail').textContent = error.message;
    });
  </script>
</body>
</html>`;
}

async function handleApiRequest(url: URL, request: http.IncomingMessage): Promise<unknown> {
  const method = request.method ?? "GET";

  if (method === "POST") {
    requireWriteAccess(request);
    const body = await readJsonBody(request);
    const dryRun = booleanParam(url, "dry_run") ?? false;

    if (url.pathname === "/api/analyst-notes") {
      return createAnalystNote({
        targetType: stringField(body, "targetType") ?? stringField(body, "target_type") ?? "",
        targetId: stringField(body, "targetId") ?? stringField(body, "target_id") ?? "",
        noteText: stringField(body, "noteText") ?? stringField(body, "note_text") ?? "",
        analyst: stringField(body, "analyst") ?? "centinela-operator",
        noteType: stringField(body, "noteType") ?? stringField(body, "note_type"),
        caseId: numberField(body, "caseId") ?? numberField(body, "case_id"),
        visibility: stringField(body, "visibility"),
        provenance: recordField(body, "provenance"),
        dryRun,
      });
    }

    if (url.pathname === "/api/analyst-cases") {
      return createAnalystCase({
        title: stringField(body, "title") ?? "",
        caseKey: stringField(body, "caseKey") ?? stringField(body, "case_key"),
        status: stringField(body, "status"),
        priority: stringField(body, "priority"),
        summary: stringField(body, "summary"),
        createdBy: stringField(body, "createdBy") ?? stringField(body, "created_by"),
        metadata: recordField(body, "metadata"),
        dryRun,
      });
    }

    const entitySourcePackId = parseEntitySourcePackRoute(url.pathname);
    if (entitySourcePackId !== undefined) {
      return buildEntitySourcePackArtifacts({
        entityId: entitySourcePackId,
        caseId: numberField(body, "caseId") ?? numberField(body, "case_id"),
        caseKey: stringField(body, "caseKey") ?? stringField(body, "case_key"),
        title: stringField(body, "title"),
        sourceRecordLimit:
          numberField(body, "sourceRecordLimit") ??
          numberField(body, "source_record_limit") ??
          numberField(body, "limit"),
        recordKinds: stringListField(body, "recordKinds") ?? stringListField(body, "record_kinds"),
        query: stringField(body, "query"),
        sourceIndexQuery: stringField(body, "sourceIndexQuery") ?? stringField(body, "source_index_query"),
        publicOnly: booleanField(body, "publicOnly") ?? booleanField(body, "public_only"),
        copyAssets: booleanField(body, "copyAssets") ?? booleanField(body, "copy_assets"),
        createdBy: stringField(body, "createdBy") ?? stringField(body, "created_by"),
        dryRun: booleanField(body, "dryRun") ?? booleanField(body, "dry_run") ?? dryRun,
      });
    }

    const evidenceCaseId = parseCaseEvidenceRoute(url.pathname);
    if (evidenceCaseId !== undefined) {
      return createAnalystEvidenceLink({
        caseId: evidenceCaseId,
        sourceRecordId: numberField(body, "sourceRecordId") ?? numberField(body, "source_record_id") ?? 0,
        noteId: numberField(body, "noteId") ?? numberField(body, "note_id"),
        targetType: stringField(body, "targetType") ?? stringField(body, "target_type") ?? "",
        targetId: stringField(body, "targetId") ?? stringField(body, "target_id") ?? "",
        fieldPath: stringField(body, "fieldPath") ?? stringField(body, "field_path"),
        fieldValue: stringField(body, "fieldValue") ?? stringField(body, "field_value"),
        evidenceSummary: stringField(body, "evidenceSummary") ?? stringField(body, "evidence_summary") ?? "",
        analystInterpretation:
          stringField(body, "analystInterpretation") ?? stringField(body, "analyst_interpretation"),
        limitations: stringField(body, "limitations"),
        evidenceRole: stringField(body, "evidenceRole") ?? stringField(body, "evidence_role"),
        createdBy: stringField(body, "createdBy") ?? stringField(body, "created_by"),
        metadata: recordField(body, "metadata"),
        dryRun,
      });
    }

    const publicReviewCaseId = parseCasePublicReviewRoute(url.pathname);
    if (publicReviewCaseId !== undefined) {
      return reviewAnalystCasePublicSafety({
        caseId: publicReviewCaseId,
        reviewStatus: stringField(body, "reviewStatus") ?? stringField(body, "review_status") ?? "",
        publicSummary: stringField(body, "publicSummary") ?? stringField(body, "public_summary"),
        publicLimitations: stringField(body, "publicLimitations") ?? stringField(body, "public_limitations"),
        reviewedBy: stringField(body, "reviewedBy") ?? stringField(body, "reviewed_by"),
        metadata: recordField(body, "metadata"),
        dryRun,
      });
    }

    const evidenceArtifactCaseId = parseCaseEvidenceArtifactRoute(url.pathname);
    if (evidenceArtifactCaseId !== undefined) {
      return buildCaseEvidenceExportArtifacts(artifactBuildOptions(evidenceArtifactCaseId, body));
    }

    const sourceManifestCaseId = parseCaseSourceManifestRoute(url.pathname);
    if (sourceManifestCaseId !== undefined) {
      return buildCaseSourceAttachmentManifestArtifacts(artifactBuildOptions(sourceManifestCaseId, body));
    }

    const sourceBundleCaseId = parseCaseSourceBundleRoute(url.pathname);
    if (sourceBundleCaseId !== undefined) {
      const bundleOptions: {
        caseId: number;
        publicOnly?: boolean;
        limit?: number;
        copyAssets?: boolean;
      } = artifactBuildOptions(sourceBundleCaseId, body);
      const copyAssets = booleanField(body, "copyAssets") ?? booleanField(body, "copy_assets");
      if (copyAssets !== undefined) {
        bundleOptions.copyAssets = copyAssets;
      }

      const bundle = await buildCaseSourceBundleArtifacts(bundleOptions);
      const query = stringField(body, "query")?.trim();
      const sourceIndex =
        query && query.length > 0
          ? await buildCaseSourceDocumentIndexArtifacts({
              bundlePath: bundle.bundlePath,
              query,
            })
          : null;

      return {
        bundle,
        sourceIndex,
        disclaimer:
          "Generated case source bundles and indexes are local review artifacts. They are not proof of wrongdoing or public findings.",
      };
    }

    if (url.pathname === "/api/source-document-indexes") {
      const bundlePath = stringField(body, "bundlePath") ?? stringField(body, "bundle_path");
      if (!bundlePath?.trim()) {
        throw new Error("bundlePath is required to refresh a source-document index.");
      }

      const sourceIndexOptions: {
        bundlePath: string;
        query?: string;
        maxTextBytes?: number;
        maxTextPreviewChars?: number;
      } = { bundlePath: bundlePath.trim() };
      const query = stringField(body, "query")?.trim();
      const maxTextBytes = numberField(body, "maxTextBytes") ?? numberField(body, "max_text_bytes");
      const maxTextPreviewChars =
        numberField(body, "maxTextPreviewChars") ?? numberField(body, "max_text_preview_chars");

      if (query) {
        sourceIndexOptions.query = query;
      }

      if (maxTextBytes !== undefined) {
        sourceIndexOptions.maxTextBytes = maxTextBytes;
      }

      if (maxTextPreviewChars !== undefined) {
        sourceIndexOptions.maxTextPreviewChars = maxTextPreviewChars;
      }

      return buildCaseSourceDocumentIndexArtifacts(sourceIndexOptions);
    }

    const caseId = parseCaseLinkRoute(url.pathname);
    if (caseId !== undefined) {
      return linkAnalystCaseTarget({
        caseId,
        targetType: stringField(body, "targetType") ?? stringField(body, "target_type") ?? "",
        targetId: stringField(body, "targetId") ?? stringField(body, "target_id") ?? "",
        label: stringField(body, "label"),
        rationale: stringField(body, "rationale"),
        createdBy: stringField(body, "createdBy") ?? stringField(body, "created_by"),
        metadata: recordField(body, "metadata"),
        dryRun,
      });
    }

    throw new Error(`Unknown POST API path: ${url.pathname}`);
  }

  if (method !== "GET") {
    throw new Error("Only GET and selected POST requests are supported in the internal console.");
  }

  if (url.pathname === "/api/overview") {
    return getInternalOverview();
  }

  if (url.pathname === "/api/entity-source-pack-readiness") {
    return getEntitySourcePackReadiness({
      limit: numberParam(url, "limit"),
      sourceRecordLimit: numberParam(url, "source_record_limit") ?? numberParam(url, "sourceRecordLimit"),
    });
  }

  if (url.pathname === "/api/entities") {
    return searchEntities(searchOptions(url));
  }

  const entityRoute = parseEntityRoute(url.pathname);
  if (entityRoute) {
    if (entityRoute.exportNetwork) {
      return getEntityNetworkExport(entityRoute.entityId, networkExportOptions(url));
    }

    if (entityRoute.network) {
      return getEntityNetwork(entityRoute.entityId, listOptions(url));
    }

    return getEntityProfile(entityRoute.entityId);
  }

  if (url.pathname === "/api/queue/entities") {
    return getEntityReviewQueue(queueOptions(url));
  }

  if (url.pathname === "/api/queue/processes") {
    return getProcessReviewQueue(queueOptions(url));
  }

  if (url.pathname === "/api/external-candidates") {
    return getExternalCandidates(externalCandidateOptions(url));
  }

  if (url.pathname === "/api/accepted-matches") {
    return getAcceptedExternalMatches(listOptions(url));
  }

  if (url.pathname === "/api/source-records") {
    return listSourceRecords(sourceRecordOptions(url));
  }

  const sourceRecordId = parseSourceRecordRoute(url.pathname);
  if (sourceRecordId !== undefined) {
    return getSourceRecord(sourceRecordId);
  }

  if (url.pathname === "/api/analyst-notes") {
    return listAnalystNotes(analystNoteOptions(url));
  }

  const caseEvidenceExportId = parseCaseEvidenceExportRoute(url.pathname);
  if (caseEvidenceExportId !== undefined) {
    return getAnalystCaseEvidenceExport(caseEvidenceExportId, {
      publicOnly: booleanParam(url, "public_only") ?? false,
      limit: numberParam(url, "limit"),
    });
  }

  const caseArtifactsId = parseCaseArtifactsRoute(url.pathname);
  if (caseArtifactsId !== undefined) {
    return listCaseArtifacts(caseArtifactsId, listOptions(url));
  }

  const caseArtifactDetailId = parseCaseArtifactDetailRoute(url.pathname);
  if (caseArtifactDetailId !== undefined) {
    const artifactPath = textParam(url, "path") ?? textParam(url, "artifact_path");
    if (!artifactPath) {
      throw new Error("path is required for artifact detail.");
    }

    return getCaseArtifactDetail(caseArtifactDetailId, {
      artifactPath,
      maxTextChars: numberParam(url, "max_text_chars") ?? numberParam(url, "maxTextChars"),
    });
  }

  const analystCaseId = parseAnalystCaseRoute(url.pathname);
  if (analystCaseId !== undefined) {
    return getAnalystCase(analystCaseId, listOptions(url));
  }

  if (url.pathname === "/api/analyst-cases") {
    return listAnalystCases(analystCaseOptions(url));
  }

  throw new Error(`Unknown API path: ${url.pathname}`);
}

export async function serveInternalConsole(options: InternalConsoleOptions = {}): Promise<http.Server> {
  const host = options.host ?? process.env.CENTINELA_INTERNAL_HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.CENTINELA_INTERNAL_PORT ?? 8787);
  const allowRemote = process.env.CENTINELA_ALLOW_REMOTE_CONSOLE === "true";

  if (!allowRemote && host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      "The internal console is local-only by default. Use --host 127.0.0.1 or set CENTINELA_ALLOW_REMOTE_CONSOLE=true intentionally.",
    );
  }

  const server = http.createServer((request, response) => {
    void (async () => {
      if (!request.url) {
        sendJson(response, 400, { error: "Missing request URL." });
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`);

      if (request.method !== "GET" && request.method !== "POST") {
        sendJson(response, 405, { error: "Only GET and selected POST requests are supported." });
        return;
      }

      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/console")) {
        sendHtml(response, 200, consoleHtml());
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        try {
          const data = await handleApiRequest(url, request);
          sendJson(response, 200, {
            data,
            meta: {
              generatedAt: new Date().toISOString(),
              disclaimer:
                "Centinela outputs are risk signals, anomalies, identity context, or leads for review. They are not proof of wrongdoing.",
            },
          });
        } catch (error) {
          const statusCode =
            error instanceof Error && "statusCode" in error
              ? Number((error as Error & { statusCode?: number }).statusCode)
              : 500;
          sendJson(response, Number.isFinite(statusCode) ? statusCode : 500, {
            error: error instanceof Error ? error.message : String(error),
            statusCode: Number.isFinite(statusCode) ? statusCode : 500,
          });
        }
        return;
      }

      sendJson(response, 404, { error: `Unknown path: ${url.pathname}` });
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  console.log(`Centinela internal console listening at http://${host}:${port}/`);
  console.log("Local-only analyst surface. Outputs are leads and identity context, not proof of wrongdoing.");
  return server;
}
