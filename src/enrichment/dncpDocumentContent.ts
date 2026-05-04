import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { outputRoot, projectRoot } from "../config";
import { writeOutputJson, writeOutputText } from "../storage/files";
import { connectToPostgres } from "../storage/postgres";

const SOURCE_KEY = "py-dncp-document-content";
const PARENT_SOURCE_KEY = "py-dncp-release-source-check";

interface SourceRecordRow {
  id: string;
  source_key: string;
  external_id: string;
  record_kind: string;
  source_url: string | null;
  retrieved_at: string;
  payload: Record<string, unknown>;
}

interface DocumentContentResult {
  parentSourceKey: string;
  parentSourceRecordId: string;
  parentExternalId: string;
  centinelaTarget: Record<string, unknown>;
  process: Record<string, unknown>;
  release: Record<string, unknown>;
  fieldPath: string | null;
  document: Record<string, unknown>;
  title: string;
  documentType: string | null;
  sourceUrl: string | null;
  downloaded: boolean;
  downloadStatus: string;
  downloadError?: string;
  contentType?: string | null;
  bytes?: number;
  sha256?: string;
  localDocumentPath?: string;
  extractionStatus: string;
  extractionError?: string;
  extractedTextPath?: string;
  extractedCharCount: number;
  textPreview: string | null;
  sourceRecordId?: string;
}

export interface DncpDocumentContentOptions {
  entityName?: string;
  entityId?: number;
  sourceRecordId?: number;
  query?: string;
  limit?: number;
  dryRun?: boolean;
  maxBytes?: number;
  timeoutMs?: number;
  maxPdfPages?: number;
  maxTextChars?: number;
}

export interface DncpDocumentContentRunResult {
  checkedDocuments: number;
  downloadedDocuments: number;
  extractedDocuments: number;
  persistedRecords: number;
  rawPath: string;
  reportPath: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function text(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "n/a";
  }
  return String(value);
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "dncp-document";
}

function safeFileName(input: string): string {
  return input
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110) || "dncp-document";
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function documentPayload(row: SourceRecordRow): Record<string, unknown> {
  return asRecord(row.payload.document);
}

function releasePayload(row: SourceRecordRow): Record<string, unknown> {
  return asRecord(row.payload.release);
}

function targetPayload(row: SourceRecordRow): Record<string, unknown> {
  return asRecord(row.payload.centinelaTarget);
}

function processPayload(row: SourceRecordRow): Record<string, unknown> {
  return asRecord(row.payload.process);
}

function documentTitle(row: SourceRecordRow): string {
  return asString(documentPayload(row).title) ?? row.external_id;
}

function documentType(row: SourceRecordRow): string | null {
  return asString(documentPayload(row).documentTypeDetails) ?? asString(documentPayload(row).documentType) ?? null;
}

function entitySlug(row: SourceRecordRow): string {
  return slugify(asString(targetPayload(row).entity_name) ?? asString(targetPayload(row).entityName) ?? "unknown-entity");
}

function documentExtension(row: SourceRecordRow, contentType?: string | null): string {
  const titleExtension = path.extname(documentTitle(row)).toLowerCase();
  if (titleExtension && titleExtension.length <= 8) {
    return titleExtension;
  }

  if (contentType?.toLowerCase().includes("pdf")) {
    return ".pdf";
  }

  if (contentType?.toLowerCase().includes("html")) {
    return ".html";
  }

  if (contentType?.toLowerCase().includes("json")) {
    return ".json";
  }

  return ".bin";
}

function localFileBaseName(row: SourceRecordRow): string {
  const fileName = safeFileName(documentTitle(row));
  const extension = path.extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}

function sha256Buffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function textPreview(value: string, maxChars = 800): string | null {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return null;
  }
  return compact.length > maxChars ? `${compact.slice(0, maxChars - 3)}...` : compact;
}

function runKey(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function pythonCandidates(): Array<{ command: string; argsPrefix: string[] }> {
  const candidates: Array<{ command: string; argsPrefix: string[] }> = [];
  if (process.env.CENTINELA_PYTHON) {
    candidates.push({ command: process.env.CENTINELA_PYTHON, argsPrefix: [] });
  }
  if (process.env.PYTHON) {
    candidates.push({ command: process.env.PYTHON, argsPrefix: [] });
  }
  candidates.push({ command: "py", argsPrefix: ["-3"] });
  candidates.push({ command: "python", argsPrefix: [] });
  return candidates;
}

function extractPdfText(inputPath: string, outputPath: string, maxPages: number, maxChars: number): {
  status: string;
  charCount: number;
  error?: string;
} {
  const scriptPath = path.join(projectRoot, "scripts", "extract_pdf_text.py");
  let lastError = "No Python extractor was available.";

  for (const candidate of pythonCandidates()) {
    const result = spawnSync(
      candidate.command,
      [
        ...candidate.argsPrefix,
        scriptPath,
        "--input",
        inputPath,
        "--output",
        outputPath,
        "--max-pages",
        String(maxPages),
        "--max-chars",
        String(maxChars),
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    );

    if (result.error) {
      lastError = result.error.message;
      continue;
    }

    const stdout = result.stdout.trim();
    if (!stdout) {
      lastError = result.stderr.trim() || "Python extractor returned no output.";
      continue;
    }

    try {
      const parsed = JSON.parse(stdout) as { status?: string; charCount?: number; error?: string };
      return {
        status: parsed.status ?? "unknown_extraction_status",
        charCount: Number(parsed.charCount ?? 0),
        ...(parsed.error ? { error: parsed.error } : {}),
      };
    } catch {
      lastError = stdout;
    }
  }

  fs.writeFileSync(outputPath, "", "utf8");
  return {
    status: "extractor_unavailable",
    charCount: 0,
    error: lastError,
  };
}

async function fetchWithLimit(
  url: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Centinela/0.1 (+https://github.com/Axel-Acosta/Centinela)",
        accept: "application/pdf,text/plain,text/html,application/octet-stream,*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new Error(`Document exceeds max bytes (${contentLength} > ${maxBytes})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength > maxBytes) {
      throw new Error(`Document exceeds max bytes (${buffer.byteLength} > ${maxBytes})`);
    }

    return {
      buffer,
      contentType: response.headers.get("content-type"),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadSelectedDocuments(options: DncpDocumentContentOptions): Promise<SourceRecordRow[]> {
  const { client, schema } = await connectToPostgres();
  const query = options.query ? `%${normalizeSearch(options.query).replace(/\s+/g, "%")}%` : null;

  try {
    const result = await client.query<SourceRecordRow>(
      `with candidates as (
         select
           records.id::text,
           records.source_key,
           records.external_id,
           records.record_kind,
           records.source_url,
           records.retrieved_at::text,
           records.payload,
           lower(regexp_replace(
             coalesce(records.payload #>> '{document,title}', '') || ' ' ||
             coalesce(records.payload #>> '{document,documentTypeDetails}', '') || ' ' ||
             coalesce(records.payload #>> '{document,documentType}', '') || ' ' ||
             coalesce(records.payload #>> '{process,title}', '') || ' ' ||
             coalesce(records.source_url, ''),
             '[^a-zA-Z0-9]+',
             ' ',
             'g'
           )) as search_text,
           coalesce(records.payload #>> '{centinelaTarget,entity_id}', records.payload #>> '{centinelaTarget,entityId}') as entity_id,
           coalesce(records.payload #>> '{centinelaTarget,entity_name}', records.payload #>> '{centinelaTarget,entityName}') as entity_name
         from ${schema}.source_records as records
         where records.source_key = $1
           and records.record_kind = 'ocds_document_metadata'
           and records.source_url is not null
       )
       select id, source_key, external_id, record_kind, source_url, retrieved_at, payload
       from candidates
       where ($2::bigint is null or id::bigint = $2)
         and ($3::bigint is null or entity_id::bigint = $3)
         and ($4::text is null or lower(entity_name) = lower($4) or lower(entity_name) like lower($5))
         and ($6::text is null or search_text like $6)
       order by
         case
           when lower(coalesce(payload #>> '{document,documentTypeDetails}', '')) like '%contrato%' then 4
           when lower(coalesce(payload #>> '{document,title}', '')) like '%contrato%' then 4
           when lower(coalesce(payload #>> '{document,documentTypeDetails}', '')) like '%resoluci%' then 3
           when lower(coalesce(payload #>> '{document,title}', '')) like '%resoluci%' then 3
           when lower(coalesce(payload #>> '{document,documentTypeDetails}', '')) like '%informe%' then 2
           else 1
         end desc,
         retrieved_at desc,
         id::bigint desc
       limit $7`,
      [
        PARENT_SOURCE_KEY,
        options.sourceRecordId ?? null,
        options.entityId ?? null,
        options.entityName ?? null,
        options.entityName ? `%${options.entityName}%` : null,
        query,
        options.limit ?? 5,
      ],
    );

    return result.rows;
  } finally {
    await client.end();
  }
}

async function persistResults(input: {
  results: DocumentContentResult[];
  rawPath: string;
  reportPath: string;
}): Promise<number> {
  const { client, schema } = await connectToPostgres();
  let persistedRecords = 0;

  try {
    await client.query("begin");
    const runResult = await client.query<{ id: string }>(
      `insert into ${schema}.source_runs (source_key, country_code, status, notes)
       values ($1, $2, $3, $4)
       returning id`,
      [SOURCE_KEY, "PY", "running", `DNCP document content extraction started for ${input.results.length} documents`],
    );
    const sourceRunId = runResult.rows[0]?.id;
    if (!sourceRunId) {
      throw new Error("Failed to create DNCP document content source run.");
    }

    await client.query(
      `insert into ${schema}.source_assets (source_run_id, asset_kind, path)
       values ($1, $2, $3), ($1, $4, $5)`,
      [sourceRunId, "dncp_document_content_raw", input.rawPath, "dncp_document_content_report", input.reportPath],
    );

    for (const result of input.results) {
      if (result.localDocumentPath) {
        await client.query(
          `insert into ${schema}.source_assets (source_run_id, asset_kind, path, source_url, sha256)
           values ($1, $2, $3, $4, $5)`,
          [sourceRunId, "dncp_official_document", result.localDocumentPath, result.sourceUrl, result.sha256 ?? null],
        );
      }

      if (result.extractedTextPath) {
        const textSha256 = fs.existsSync(result.extractedTextPath)
          ? sha256Buffer(fs.readFileSync(result.extractedTextPath))
          : null;
        await client.query(
          `insert into ${schema}.source_assets (source_run_id, asset_kind, path, source_url, sha256)
           values ($1, $2, $3, $4, $5)`,
          [sourceRunId, "dncp_extracted_text", result.extractedTextPath, result.sourceUrl, textSha256],
        );
      }

      const recordResult = await client.query<{ id: string }>(
        `insert into ${schema}.source_records (
           source_run_id,
           source_key,
           external_id,
           record_kind,
           source_url,
           payload
         )
         values ($1, $2, $3, $4, $5, $6::jsonb)
         on conflict (source_key, external_id, record_kind)
         do update set
           source_run_id = excluded.source_run_id,
           source_url = excluded.source_url,
           retrieved_at = now(),
           payload = excluded.payload
         returning id::text`,
        [
          sourceRunId,
          SOURCE_KEY,
          `source-record-${result.parentSourceRecordId}`,
          "document_content_extract",
          result.sourceUrl,
          JSON.stringify(result),
        ],
      );
      const persistedRecordId = recordResult.rows[0]?.id;
      if (persistedRecordId) {
        result.sourceRecordId = persistedRecordId;
      }
      persistedRecords += 1;
    }

    await client.query(
      `update ${schema}.source_runs
       set finished_at = now(), status = $2, notes = $3
       where id = $1`,
      [
        sourceRunId,
        "completed",
        `DNCP document content extraction completed: ${persistedRecords} content records persisted`,
      ],
    );
    await client.query("commit");
    return persistedRecords;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

function renderReport(results: DocumentContentResult[], options: DncpDocumentContentOptions, persistedRecords: number): string {
  const lines: string[] = [];
  const extracted = results.filter((result) => result.extractionStatus === "extracted_text").length;
  const downloaded = results.filter((result) => result.downloaded).length;

  lines.push("# DNCP document content extraction");
  lines.push("");
  lines.push("This report contains official-source document capture and best-effort text extraction for review. It is not proof of wrongdoing.");
  lines.push("");
  lines.push("## Coverage");
  lines.push("");
  lines.push(`- Documents checked: ${results.length}`);
  lines.push(`- Documents downloaded: ${downloaded}`);
  lines.push(`- Documents with extracted text: ${extracted}`);
  lines.push(`- Persisted content records: ${persistedRecords}`);
  lines.push(`- Dry run: ${options.dryRun ? "yes" : "no"}`);
  lines.push(`- Query filter: ${options.query ?? "n/a"}`);
  lines.push("");

  for (const result of results) {
    lines.push(`## Source record ${result.parentSourceRecordId}: ${result.title}`);
    lines.push("");
    lines.push(`- Document type: ${result.documentType ?? "n/a"}`);
    lines.push(`- Source URL: ${result.sourceUrl ?? "n/a"}`);
    lines.push(`- Download status: ${result.downloadStatus}`);
    lines.push(`- Content type: ${result.contentType ?? "n/a"}`);
    lines.push(`- Bytes: ${result.bytes ?? "n/a"}`);
    lines.push(`- SHA-256: ${result.sha256 ?? "n/a"}`);
    lines.push(`- Extraction status: ${result.extractionStatus}`);
    lines.push(`- Extracted characters: ${result.extractedCharCount}`);
    lines.push(`- Local document path: ${result.localDocumentPath ?? "n/a"}`);
    lines.push(`- Extracted text path: ${result.extractedTextPath ?? "n/a"}`);
    lines.push(`- Persisted source record ID: ${result.sourceRecordId ?? "n/a"}`);
    if (result.downloadError) {
      lines.push(`- Download error: ${result.downloadError}`);
    }
    if (result.extractionError) {
      lines.push(`- Extraction error: ${result.extractionError}`);
    }
    lines.push(`- Text preview: ${result.textPreview ?? "n/a"}`);
    lines.push("");
  }

  lines.push("## Methodology and limits");
  lines.push("");
  lines.push("- Documents are selected from already persisted DNCP document metadata source records.");
  lines.push("- PDF text extraction uses a bounded local parser. Scanned/image-only PDFs can produce `no_extractable_text`.");
  lines.push("- Extracted text is a navigation aid. Analysts should verify the official PDF before relying on any field publicly.");
  lines.push("- This command stores source assets and content-extract source records separately from accepted matches, candidates, and risk signals.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function processDocument(row: SourceRecordRow, options: DncpDocumentContentOptions, runSlug: string): Promise<DocumentContentResult> {
  const sourceUrl = row.source_url;
  const title = documentTitle(row);
  const docType = documentType(row);
  const resultBase: DocumentContentResult = {
    parentSourceKey: row.source_key,
    parentSourceRecordId: row.id,
    parentExternalId: row.external_id,
    centinelaTarget: targetPayload(row),
    process: processPayload(row),
    release: releasePayload(row),
    fieldPath: asString(row.payload.fieldPath) ?? null,
    document: documentPayload(row),
    title,
    documentType: docType,
    sourceUrl,
    downloaded: false,
    downloadStatus: "not_attempted",
    extractionStatus: "not_attempted",
    extractedCharCount: 0,
    textPreview: null,
  };

  if (!sourceUrl) {
    return {
      ...resultBase,
      downloadStatus: "missing_source_url",
      extractionStatus: "not_attempted_missing_source_url",
    };
  }

  try {
    const fetched = await fetchWithLimit(sourceUrl, options.timeoutMs ?? 30000, options.maxBytes ?? 25_000_000);
    const extension = documentExtension(row, fetched.contentType);
    const relativeDir = path.join("raw", "paraguay", "dncp", "documents", entitySlug(row), runSlug);
    const outputDir = path.join(outputRoot, relativeDir);
    fs.mkdirSync(outputDir, { recursive: true });
    const baseName = localFileBaseName(row);
    const fileName = `${row.id}-${baseName}${extension}`;
    const documentPath = path.join(outputDir, fileName);
    fs.writeFileSync(documentPath, fetched.buffer);
    const sha256 = sha256Buffer(fetched.buffer);
    const textPath = path.join(outputDir, `${row.id}-${baseName}.txt`);
    const isPdf = extension === ".pdf" || fetched.contentType?.toLowerCase().includes("pdf");
    const isText = fetched.contentType?.toLowerCase().startsWith("text/") || [".txt", ".csv", ".html", ".htm"].includes(extension);

    if (isPdf) {
      const extraction = extractPdfText(
        documentPath,
        textPath,
        options.maxPdfPages ?? 20,
        options.maxTextChars ?? 120000,
      );
      const extractedText = fs.existsSync(textPath) ? fs.readFileSync(textPath, "utf8") : "";
      return {
        ...resultBase,
        downloaded: true,
        downloadStatus: "downloaded",
        contentType: fetched.contentType,
        bytes: fetched.buffer.byteLength,
        sha256,
        localDocumentPath: documentPath,
        extractionStatus: extraction.status,
        ...(extraction.error ? { extractionError: extraction.error } : {}),
        extractedTextPath: textPath,
        extractedCharCount: extractedText.length || extraction.charCount,
        textPreview: textPreview(extractedText),
      };
    }

    if (isText) {
      const extractedText = fetched.buffer.toString("utf8");
      fs.writeFileSync(textPath, extractedText, "utf8");
      return {
        ...resultBase,
        downloaded: true,
        downloadStatus: "downloaded",
        contentType: fetched.contentType,
        bytes: fetched.buffer.byteLength,
        sha256,
        localDocumentPath: documentPath,
        extractionStatus: "copied_text",
        extractedTextPath: textPath,
        extractedCharCount: extractedText.length,
        textPreview: textPreview(extractedText),
      };
    }

    fs.writeFileSync(textPath, "", "utf8");
    return {
      ...resultBase,
      downloaded: true,
      downloadStatus: "downloaded",
      contentType: fetched.contentType,
      bytes: fetched.buffer.byteLength,
      sha256,
      localDocumentPath: documentPath,
      extractionStatus: "unsupported_content_type",
      extractedTextPath: textPath,
      extractedCharCount: 0,
      textPreview: null,
    };
  } catch (error) {
    return {
      ...resultBase,
      downloadStatus: "download_failed",
      downloadError: error instanceof Error ? error.message : "unknown download error",
      extractionStatus: "not_attempted_download_failed",
    };
  }
}

export async function runDncpDocumentContentExtraction(
  options: DncpDocumentContentOptions,
): Promise<DncpDocumentContentRunResult> {
  const selected = await loadSelectedDocuments(options);
  const currentRunKey = runKey();
  const results: DocumentContentResult[] = [];

  for (const row of selected) {
    results.push(await processDocument(row, options, currentRunKey));
  }

  const rawPath = await writeOutputJson(
    ["raw", "paraguay", "dncp", `document-content-extraction-${currentRunKey}.json`],
    {
      generatedAt: new Date().toISOString(),
      sourceKey: SOURCE_KEY,
      options,
      selectedSourceRecords: selected.map((row) => ({
        id: row.id,
        externalId: row.external_id,
        sourceUrl: row.source_url,
        title: documentTitle(row),
        documentType: documentType(row),
        target: targetPayload(row),
        process: processPayload(row),
      })),
      results,
    },
  );

  let persistedRecords = 0;
  const initialReport = renderReport(results, options, persistedRecords);
  const reportPath = await writeOutputText(
    ["reports", "paraguay", `dncp-document-content-extraction-${currentRunKey}.md`],
    initialReport,
  );

  if (!options.dryRun) {
    persistedRecords = await persistResults({ results, rawPath, reportPath });
    const persistedReport = renderReport(results, options, persistedRecords);
    await writeOutputText(
      ["reports", "paraguay", `dncp-document-content-extraction-${currentRunKey}.md`],
      persistedReport,
    );
  }

  return {
    checkedDocuments: results.length,
    downloadedDocuments: results.filter((result) => result.downloaded).length,
    extractedDocuments: results.filter((result) => result.extractionStatus === "extracted_text" || result.extractionStatus === "copied_text").length,
    persistedRecords,
    rawPath,
    reportPath,
  };
}
