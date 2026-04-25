import unzipper from "unzipper";
import { parseCsvStream, type CsvRow } from "./csv";

export async function readZipCsvEntries(
  zipPath: string,
  entryNames: string[],
): Promise<Record<string, CsvRow[]>> {
  const directory = await unzipper.Open.file(zipPath);
  const result: Record<string, CsvRow[]> = {};

  for (const entryName of entryNames) {
    const entry = directory.files.find((file) => file.path === entryName);
    if (!entry) {
      throw new Error(`Zip entry not found: ${entryName} in ${zipPath}`);
    }

    result[entryName] = await parseCsvStream(entry.stream());
  }

  return result;
}
