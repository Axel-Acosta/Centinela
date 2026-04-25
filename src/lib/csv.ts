import type { Readable } from "node:stream";
import { parse } from "csv-parse";

export type CsvRow = Record<string, string>;

export async function parseCsvStream(stream: Readable): Promise<CsvRow[]> {
  const parser = stream.pipe(
    parse({
      bom: true,
      columns: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
    }),
  );

  const rows: CsvRow[] = [];

  for await (const record of parser) {
    rows.push(record as CsvRow);
  }

  return rows;
}
