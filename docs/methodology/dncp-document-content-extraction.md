# DNCP document content extraction methodology

## Purpose

The DNCP document content extraction connector turns already persisted DNCP document metadata into captured official document assets.

It starts from `py-dncp-release-source-check` source records, downloads selected official DNCP document URLs, stores local source assets with hashes, attempts bounded text extraction for PDFs and text-like files, and persists a new `document_content_extract` source record under `py-dncp-document-content`.

This is source capture and navigation support. It is not proof of wrongdoing, identity guilt, or an automated risk conclusion.

## Command

```bash
npm run enrichment:dncp-document-content -- --entity-name "Entity Name" --query "contrato" --limit 2
```

Alternatives:

```bash
npm run enrichment:dncp-document-content -- --entity-id 3940 --query "contrato" --limit 2
npm run enrichment:dncp-document-content -- --source-record-id 10226
```

Use `--dry-run true` to write local artifacts without persisting content source records.

Useful bounds:

```bash
npm run enrichment:dncp-document-content -- --entity-name "Entity Name" --query "contrato" --limit 1 --max-bytes 25000000 --max-pdf-pages 20 --max-chars 120000 --timeout-ms 45000
```

## What It Stores

- `source_runs` with source key `py-dncp-document-content`.
- `source_assets` for the raw JSON artifact and Markdown report.
- `source_assets` for downloaded official documents, including source URL and SHA-256 hash.
- `source_assets` for extracted text files, even when the text file is empty because the PDF is scanned or image-only.
- `source_records` with `record_kind = document_content_extract`.

The persisted payload keeps:

- parent source key, parent source-record ID, and parent external ID
- local target entity ID/name/type through `centinelaTarget`
- related process and release metadata
- document title, type, field path, and source URL
- downloaded file path, bytes, content type, and SHA-256 hash
- extraction status, extracted character count, extracted text path, and preview when text exists
- explicit limitations

## Current Live Use

On 2026-05-04, the connector captured two official DNCP contract PDFs:

- `MENDEZ GONZALEZ FLORIANA *`, source record `10785`, parent document metadata record `10178`.
- `CONSULTORA GUARANI SA INGENIEROS CIVILES`, source record `10786`, parent document metadata record `10226`.

Both files downloaded and were hashed successfully. Both returned `no_extractable_text` with the current local PDF parser, which likely means they are scanned/image-only PDFs or otherwise not text-bearing for the installed parser.

## Analyst Use

Entity briefs now show document-content source records inside `Official source records and documents`, including:

- extraction status
- extracted character count
- SHA-256 hash
- local captured document path
- local extracted text path

Analysts can use these records to:

- link exact official documents into cases
- build source bundles with captured PDFs
- cite hashes and source-record IDs in evidence links
- decide which documents need OCR or manual visual review
- avoid treating unavailable text extraction as absence of source evidence

## Limits

- PDF text extraction currently uses a bounded local parser through `scripts/extract_pdf_text.py`.
- Scanned/image-only PDFs produce `no_extractable_text`; this is a parser/OCR limitation, not a finding about the document.
- OCR is not installed in the current local runtime. Add OCR only when the specific case value justifies the extra dependency and review burden.
- Extracted text is a navigation aid. Analysts should verify the official PDF before relying on a field publicly.
- Public use still requires case public-safety review, methodology review, privacy review, source-license review, and careful non-accusatory language.

