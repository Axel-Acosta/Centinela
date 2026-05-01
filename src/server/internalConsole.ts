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
import { listCaseArtifacts } from "../storage/caseArtifacts";

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
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Centinela<br />Internal Console</h1>
      <p class="lede">A local analyst surface for entity search, review queues, accepted enrichment matches, and graph-ready relationship pivots. This is an internal tool, not a public accusation engine.</p>
      <p class="guardrail">All outputs are risk signals, anomalies, identity context, or leads for review. They are not proof of wrongdoing.</p>
    </header>

    <section class="grid">
      <article class="panel span-12">
        <h2>Live Overview</h2>
        <div id="stats" class="stats"></div>
      </article>

      <article class="panel span-7">
        <h2>Entity Search</h2>
        <form id="search-form">
          <input id="search-input" value="CONSULTORA GUARANI" aria-label="Search entities" />
          <button type="submit">Search</button>
        </form>
        <div id="results" class="list"></div>
      </article>

      <article class="panel span-5">
        <h2>Entity / Network Detail</h2>
        <pre id="detail">Search and choose an entity to inspect.</pre>
      </article>

      <article class="panel span-4">
        <h2>Source Records</h2>
        <div id="source-records" class="list"></div>
      </article>

      <article class="panel span-4">
        <h2>Analyst Notes</h2>
        <div class="mini-form">
          <input id="write-token" type="password" placeholder="Write token for saved notes" aria-label="Write token" />
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
        <h2>Graph Export</h2>
        <button id="export-graph" type="button" class="secondary">Load Cytoscape export</button>
        <pre id="graph-export">Open an entity first.</pre>
      </article>

      <article class="panel span-12">
        <h2>Case Timeline Workbench</h2>
        <div class="grid">
          <div class="span-4">
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
              <button id="write-evidence-artifact" type="button" class="secondary">Write evidence artifact</button>
              <button id="write-source-manifest" type="button" class="secondary">Write source manifest</button>
              <button id="write-source-bundle" type="button" class="secondary">Write source bundle + index</button>
              <button id="refresh-source-index" type="button" class="secondary">Refresh bundle source index</button>
              <button id="load-case-artifacts" type="button" class="secondary">Load generated artifacts</button>
            </div>
            <div id="cases" class="list"></div>
            <div id="case-source-record-results" class="list"></div>
            <div id="field-suggestions" class="list"></div>
          </div>
          <div class="span-7">
            <pre id="case-detail">Create or open a case to see the timeline.</pre>
            <pre id="case-export">Evidence export appears here after public-safety review.</pre>
            <pre id="case-artifacts">Artifact, bundle, and source index paths appear here.</pre>
          </div>
        </div>
      </article>

      <article class="panel span-4">
        <h2>Accepted Matches</h2>
        <div id="accepted" class="list"></div>
      </article>

      <article class="panel span-4">
        <h2>Entity Queue</h2>
        <div id="entity-queue" class="list"></div>
      </article>

      <article class="panel span-4">
        <h2>External Candidates</h2>
        <div id="candidates" class="list"></div>
      </article>
    </section>
  </main>

  <script>
    let currentEntityId = null;
    let currentCaseId = null;
    let currentSourceRecordId = null;
    let currentNoteId = null;
    let currentBundlePath = null;

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
        ['Risk signals', counts.procurement_risk_signals],
        ['Relationships', counts.relationship_edges],
        ['Accepted matches', counts.accepted_second_reviews],
        ['Evidence links', counts.analyst_evidence_links],
        ['Public reviews', counts.analyst_public_reviews],
        ['External risk signals', counts.external_risk_signals]
      ].forEach(([label, value]) => {
        const stat = document.createElement('div');
        stat.className = 'stat';
        stat.innerHTML = '<strong>' + text(value) + '</strong><span>' + label + '</span>';
        stats.appendChild(stat);
      });
    }

    async function searchEntities(event) {
      if (event) {
        event.preventDefault();
      }
      const q = document.getElementById('search-input').value;
      const payload = await getJson('/api/entities?q=' + encodeURIComponent(q) + '&limit=8');
      const results = document.getElementById('results');
      results.innerHTML = '';
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

    async function loadEntity(entityId) {
      currentEntityId = entityId;
      const [profile, network] = await Promise.all([
        getJson('/api/entities/' + entityId),
        getJson('/api/entities/' + entityId + '/network?limit=18')
      ]);
      document.getElementById('detail').textContent = JSON.stringify({
        profile: profile.data,
        network: network.data
      }, null, 2);
      renderSourceRecords(profile.data.sourceRecords || []);
      renderNotes(profile.data.analystNotes || []);
      document.getElementById('graph-export').textContent = 'Ready to export entity #' + entityId + '.';
    }

    async function openSourceRecord(recordId) {
      currentSourceRecordId = Number(recordId);
      const payload = await getJson('/api/source-records/' + recordId);
      document.getElementById('detail').textContent = JSON.stringify(payload.data, null, 2);
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
      const payload = await getJson('/api/entities/' + currentEntityId + '/network/export?format=cytoscape&limit=30');
      document.getElementById('graph-export').textContent = JSON.stringify(payload.data, null, 2);
    }

    async function loadAccepted() {
      const payload = await getJson('/api/accepted-matches?limit=5');
      const container = document.getElementById('accepted');
      container.innerHTML = '';
      payload.data.forEach((match) => renderItem(container, match.entity_name + ' -> ' + match.external_name, [
        match.decision,
        'accepted match ID: ' + text(match.accepted_match_id),
        'limit: ' + text(match.limitations)
      ]));
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
        button.textContent = 'Open case timeline';
        button.onclick = () => openCase(item.id);
        renderItem(container, item.title, [
          item.priority + ' / ' + item.status,
          'public review: ' + text(item.public_review_status),
          'links: ' + text(item.linked_target_count) + ', notes: ' + text(item.note_count)
        ], button);
      });
    }

    async function openCase(caseId) {
      currentCaseId = caseId;
      const payload = await getJson('/api/analyst-cases/' + caseId + '?limit=50');
      document.getElementById('case-detail').textContent = JSON.stringify(payload.data, null, 2);
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

    async function loadQueues() {
      const [queue, candidates] = await Promise.all([
        getJson('/api/queue/entities?limit=5'),
        getJson('/api/external-candidates?limit=5')
      ]);
      const queueNode = document.getElementById('entity-queue');
      queueNode.innerHTML = '';
      queue.data.forEach((item) => renderItem(queueNode, item.entity_name, [
        item.review_priority + ' / ' + item.review_lane,
        item.lead_question
      ]));
      const candidateNode = document.getElementById('candidates');
      candidateNode.innerHTML = '';
      candidates.data.forEach((item) => renderItem(candidateNode, item.entity_name + ' -> ' + item.external_name, [
        item.suggested_review_status || item.review_status,
        'candidate #' + item.id,
        text(item.review_next_step)
      ]));
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
    document.getElementById('load-case-artifacts').addEventListener('click', () => {
      fetchCaseArtifacts(true).catch((error) => {
        document.getElementById('case-artifacts').textContent = error.message;
      });
    });
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

  const analystCaseId = parseAnalystCaseRoute(url.pathname);
  if (analystCaseId !== undefined) {
    return getAnalystCase(analystCaseId, listOptions(url));
  }

  if (url.pathname === "/api/analyst-cases") {
    return listAnalystCases(analystCaseOptions(url));
  }

  throw new Error(`Unknown API path: ${url.pathname}`);
}

export async function serveInternalConsole(options: InternalConsoleOptions = {}): Promise<void> {
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
}
