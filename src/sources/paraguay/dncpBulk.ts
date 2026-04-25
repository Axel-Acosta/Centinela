import fs from "node:fs/promises";
import path from "node:path";
import { outputRoot } from "../../config";
import { ensureDir } from "../../lib/fs";
import { downloadToFile } from "../../lib/http";
import { readZipCsvEntries } from "../../lib/zip";

export interface DncpBulkRecordRow {
  releaseId: string;
  ocid: string;
  tenderId: string;
  title: string;
  status?: string;
  statusDetails?: string;
  coveredBy: string[];
  mainProcurementCategoryDetails?: string;
  procurementMethod?: string;
  procurementMethodDetails?: string;
  buyerId?: string;
  buyerName?: string;
  procuringEntityId?: string;
  procuringEntityName?: string;
  planningIdentifier?: string;
  datePublished?: string;
  releaseDate?: string;
  tenderStartDate?: string;
  tenderEndDate?: string;
  tenderDurationInDays?: number;
  awardDate?: string;
  enquiryEndDate?: string;
  enquiryStartDate?: string;
  enquiryDurationInDays?: number;
  numberOfTenderers?: number;
  valueAmount?: number;
  valueCurrency?: string;
  releaseUrl: string;
}

export interface DncpBulkContractRow {
  releaseId: string;
  contractId: string;
  awardId?: string;
  status?: string;
  statusDetails?: string;
  startDate?: string;
  endDate?: string;
  durationInDays?: number;
  amount?: number;
  currency?: string;
  dateSigned?: string;
}

export interface DncpBulkTransactionRow {
  releaseId: string;
  contractId: string;
  transactionId: string;
  sourceSystem?: string;
  currency?: string;
  amount?: number;
  date?: string;
  payerId?: string;
  payerName?: string;
  payeeId?: string;
  payeeName?: string;
  requestDate?: string;
  financialCode?: string;
}

export interface DncpBulkYearSnapshot {
  year: number;
  sourceKey: string;
  tenderZipPath: string;
  contractZipPath: string;
  tenderRecords: DncpBulkRecordRow[];
  contractRecords: DncpBulkRecordRow[];
  contracts: DncpBulkContractRow[];
  transactions: DncpBulkTransactionRow[];
}

function toNumber(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toList(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildReleaseUrl(releaseId: string): string {
  return `https://www.contrataciones.gov.py/datos/api/v3/doc/ocds/releases/id/${encodeURIComponent(releaseId)}`;
}

function mapRecordRow(row: Record<string, string>): DncpBulkRecordRow {
  const releaseId = row["compiledRelease/id"] ?? "";
  const record: DncpBulkRecordRow = {
    releaseId,
    ocid: row["compiledRelease/ocid"] ?? "",
    tenderId: row["compiledRelease/tender/id"] ?? "",
    title: row["compiledRelease/tender/title"] ?? releaseId,
    coveredBy: toList(row["compiledRelease/tender/coveredBy"]),
    releaseUrl: buildReleaseUrl(releaseId),
  };

  const optionalValues: Array<[keyof DncpBulkRecordRow, string | number | undefined]> = [
    ["status", row["compiledRelease/tender/status"]],
    ["statusDetails", row["compiledRelease/tender/statusDetails"]],
    ["mainProcurementCategoryDetails", row["compiledRelease/tender/mainProcurementCategoryDetails"]],
    ["procurementMethod", row["compiledRelease/tender/procurementMethod"]],
    ["procurementMethodDetails", row["compiledRelease/tender/procurementMethodDetails"]],
    ["buyerId", row["compiledRelease/buyer/id"]],
    ["buyerName", row["compiledRelease/buyer/name"]],
    ["procuringEntityId", row["compiledRelease/tender/procuringEntity/id"]],
    ["procuringEntityName", row["compiledRelease/tender/procuringEntity/name"]],
    ["planningIdentifier", row["compiledRelease/planning/identifier"]],
    ["datePublished", row["compiledRelease/tender/datePublished"]],
    ["releaseDate", row["compiledRelease/date"]],
    ["tenderStartDate", row["compiledRelease/tender/tenderPeriod/startDate"]],
    ["tenderEndDate", row["compiledRelease/tender/tenderPeriod/endDate"]],
    ["tenderDurationInDays", toNumber(row["compiledRelease/tender/tenderPeriod/durationInDays"])],
    ["awardDate", row["compiledRelease/tender/awardPeriod/startDate"]],
    ["enquiryEndDate", row["compiledRelease/tender/enquiryPeriod/endDate"]],
    ["enquiryStartDate", row["compiledRelease/tender/enquiryPeriod/startDate"]],
    ["enquiryDurationInDays", toNumber(row["compiledRelease/tender/enquiryPeriod/durationInDays"])],
    ["numberOfTenderers", toNumber(row["compiledRelease/tender/numberOfTenderers"])],
    ["valueAmount", toNumber(row["compiledRelease/tender/value/amount"])],
    ["valueCurrency", row["compiledRelease/tender/value/currency"]],
  ];

  for (const [key, value] of optionalValues) {
    if (value !== undefined && value !== "") {
      record[key] = value as never;
    }
  }

  return record;
}

function mapContractRow(row: Record<string, string>): DncpBulkContractRow {
  const contract: DncpBulkContractRow = {
    releaseId: row["compiledRelease/id"] ?? "",
    contractId: row["compiledRelease/contracts/0/id"] ?? "",
  };

  const optionalValues: Array<[keyof DncpBulkContractRow, string | number | undefined]> = [
    ["awardId", row["compiledRelease/contracts/0/awardID"]],
    ["status", row["compiledRelease/contracts/0/status"]],
    ["statusDetails", row["compiledRelease/contracts/0/statusDetails"]],
    ["startDate", row["compiledRelease/contracts/0/period/startDate"]],
    ["endDate", row["compiledRelease/contracts/0/period/endDate"]],
    ["durationInDays", toNumber(row["compiledRelease/contracts/0/period/durationInDays"])],
    ["amount", toNumber(row["compiledRelease/contracts/0/value/amount"])],
    ["currency", row["compiledRelease/contracts/0/value/currency"]],
    ["dateSigned", row["compiledRelease/contracts/0/dateSigned"]],
  ];

  for (const [key, value] of optionalValues) {
    if (value !== undefined && value !== "") {
      contract[key] = value as never;
    }
  }

  return contract;
}

function mapTransactionRow(row: Record<string, string>): DncpBulkTransactionRow {
  const transaction: DncpBulkTransactionRow = {
    releaseId: row["compiledRelease/id"] ?? "",
    contractId: row["compiledRelease/contracts/0/id"] ?? "",
    transactionId: row["compiledRelease/contracts/0/implementation/transactions/0/id"] ?? "",
  };

  const optionalValues: Array<[keyof DncpBulkTransactionRow, string | number | undefined]> = [
    ["sourceSystem", row["compiledRelease/contracts/0/implementation/transactions/0/sourceSystem"]],
    ["currency", row["compiledRelease/contracts/0/implementation/transactions/0/value/currency"]],
    ["amount", toNumber(row["compiledRelease/contracts/0/implementation/transactions/0/value/amount"])],
    ["date", row["compiledRelease/contracts/0/implementation/transactions/0/date"]],
    ["payerId", row["compiledRelease/contracts/0/implementation/transactions/0/payer/id"]],
    ["payerName", row["compiledRelease/contracts/0/implementation/transactions/0/payer/name"]],
    ["payeeId", row["compiledRelease/contracts/0/implementation/transactions/0/payee/id"]],
    ["payeeName", row["compiledRelease/contracts/0/implementation/transactions/0/payee/name"]],
    ["requestDate", row["compiledRelease/contracts/0/implementation/transactions/0/requestDate"]],
    ["financialCode", row["compiledRelease/contracts/0/implementation/transactions/0/financialCode"]],
  ];

  for (const [key, value] of optionalValues) {
    if (value !== undefined && value !== "") {
      transaction[key] = value as never;
    }
  }

  return transaction;
}

async function ensureZipFile(year: number, kind: "ten" | "con", forceDownload: boolean): Promise<string> {
  const outputPath = path.join(outputRoot, "raw", "paraguay", "dncp", `${year}-${kind}-masivo.zip`);

  if (!forceDownload) {
    try {
      await fs.access(outputPath);
      return outputPath;
    } catch {
      // Continue to download.
    }
  }

  await ensureDir(path.dirname(outputPath));
  const url = `https://www.contrataciones.gov.py/images/opendata-v3/final/ocds/${year}/${kind}-masivo.zip`;
  await downloadToFile(url, outputPath);
  return outputPath;
}

export async function fetchDncpBulkYear(
  year: number,
  options?: { forceDownload?: boolean },
): Promise<DncpBulkYearSnapshot> {
  const forceDownload = options?.forceDownload ?? false;
  const tenderZipPath = await ensureZipFile(year, "ten", forceDownload);
  const contractZipPath = await ensureZipFile(year, "con", forceDownload);

  const tenderEntries = await readZipCsvEntries(tenderZipPath, ["records.csv"]);
  const contractEntries = await readZipCsvEntries(contractZipPath, [
    "records.csv",
    "contracts.csv",
    "con_imp_transactions.csv",
  ]);

  const tenderRecordsCsv = tenderEntries["records.csv"] ?? [];
  const contractRecordsCsv = contractEntries["records.csv"] ?? [];
  const contractsCsv = contractEntries["contracts.csv"] ?? [];
  const transactionsCsv = contractEntries["con_imp_transactions.csv"] ?? [];

  return {
    year,
    sourceKey: `py-dncp-bulk-${year}`,
    tenderZipPath,
    contractZipPath,
    tenderRecords: tenderRecordsCsv.map(mapRecordRow),
    contractRecords: contractRecordsCsv.map(mapRecordRow),
    contracts: contractsCsv.map(mapContractRow),
    transactions: transactionsCsv.map(mapTransactionRow),
  };
}
