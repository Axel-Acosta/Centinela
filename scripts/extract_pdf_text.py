import argparse
import json
import sys
from pathlib import Path

from pypdf import PdfReader


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract bounded text from a PDF for Centinela source review.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--max-pages", type=int, default=20)
    parser.add_argument("--max-chars", type=int, default=120000)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        reader = PdfReader(str(input_path))
        total_pages = len(reader.pages)
        pages_to_read = min(total_pages, max(1, args.max_pages))
        chunks = []

        for index in range(pages_to_read):
            text = reader.pages[index].extract_text() or ""
            if text.strip():
                chunks.append(f"\n\n--- Page {index + 1} ---\n{text.strip()}")

            if sum(len(chunk) for chunk in chunks) >= args.max_chars:
                break

        extracted_text = "\n".join(chunks).strip()
        truncated = len(extracted_text) > args.max_chars
        if truncated:
            extracted_text = extracted_text[: args.max_chars]

        output_path.write_text(extracted_text, encoding="utf-8")
        print(
            json.dumps(
                {
                    "status": "extracted_text" if extracted_text else "no_extractable_text",
                    "pageCount": total_pages,
                    "pagesAttempted": pages_to_read,
                    "charCount": len(extracted_text),
                    "truncated": truncated,
                }
            )
        )
        return 0
    except Exception as exc:
        output_path.write_text("", encoding="utf-8")
        print(
            json.dumps(
                {
                    "status": "extraction_failed",
                    "error": str(exc),
                }
            )
        )
        return 0


if __name__ == "__main__":
    sys.exit(main())
