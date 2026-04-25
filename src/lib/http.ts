import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string, delayMs = 0): Promise<T> {
  if (delayMs > 0) {
    await sleep(delayMs);
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "Centinela/0.1 (+https://github.com/local/centinela)",
      accept: "application/json, text/plain, */*",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as T;
}

export async function downloadToFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Centinela/0.1 (+https://github.com/local/centinela)",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }

  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(outputPath));
}
