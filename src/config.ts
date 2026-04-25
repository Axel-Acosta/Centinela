import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

function defaultOutputDir(): string {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData && localAppData.trim().length > 0) {
    return path.join(localAppData, "Centinela", "data");
  }

  return path.join(os.homedir(), ".centinela", "data");
}

const envSchema = z.object({
  CENTINELA_OUTPUT_DIR: z.preprocess(emptyStringToUndefined, z.string().default(defaultOutputDir())),
  CENTINELA_DEFAULT_COUNTRY: z.preprocess(emptyStringToUndefined, z.string().default("py")),
});

export const env = envSchema.parse(process.env);
export const projectRoot = process.cwd();
export const outputRoot = path.isAbsolute(env.CENTINELA_OUTPUT_DIR)
  ? path.resolve(env.CENTINELA_OUTPUT_DIR)
  : path.resolve(projectRoot, env.CENTINELA_OUTPUT_DIR);

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getDefaultWindow(daysBack = 14): { from: string; to: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - daysBack);

  return {
    from: toDateString(start),
    to: toDateString(end),
  };
}
