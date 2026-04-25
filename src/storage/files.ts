import path from "node:path";
import { ensureDir, writeJson as baseWriteJson, writeText as baseWriteText } from "../lib/fs";
import { outputRoot } from "../config";

export function resolveOutputPath(...segments: string[]): string {
  return path.join(outputRoot, ...segments);
}

export async function writeOutputJson(relativePath: string[], value: unknown): Promise<string> {
  const targetPath = resolveOutputPath(...relativePath);
  await ensureDir(path.dirname(targetPath));
  await baseWriteJson(targetPath, value);
  return targetPath;
}

export async function writeOutputText(relativePath: string[], value: string): Promise<string> {
  const targetPath = resolveOutputPath(...relativePath);
  await ensureDir(path.dirname(targetPath));
  await baseWriteText(targetPath, value);
  return targetPath;
}

