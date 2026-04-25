import type { NormalizedProcess } from "./model";

export interface NormalizedBundle {
  generatedAt: string;
  bundleKind: "api-slice" | "bulk-year";
  sourceKey: string;
  countryCode: "PY";
  stats: {
    processCount: number;
    riskSignalCount: number;
    flaggedProcessCount: number;
  };
  sourceAssets?: string[];
  year?: number;
  processes: NormalizedProcess[];
}
