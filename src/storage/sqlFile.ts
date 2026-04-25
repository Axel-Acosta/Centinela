import fs from "node:fs/promises";
import { connectToPostgres } from "./postgres";

export async function applySqlFile(filePath: string): Promise<void> {
  const sql = await fs.readFile(filePath, "utf8");
  const { client } = await connectToPostgres();

  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
