import type {
  DncpBulkContractRow,
  DncpBulkRecordRow,
  DncpBulkTransactionRow,
  DncpBulkYearSnapshot,
} from "../sources/paraguay/dncpBulk";
import type {
  NormalizedContract,
  NormalizedParty,
  NormalizedProcess,
  NormalizedTransaction,
} from "./model";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferEntityType(name: string, externalId?: string): NormalizedParty["entityType"] {
  if (externalId?.startsWith("DNCP-SICP-CODE")) {
    return "institution";
  }

  if (externalId?.startsWith("PY-RUC")) {
    return "company";
  }

  if (name.includes(" ") && !name.includes("S.A") && !name.includes("SRL") && !name.includes("S.R.L")) {
    return "person";
  }

  return "unknown";
}

function makeParty(name?: string, externalId?: string): NormalizedParty | undefined {
  if (!name) {
    return undefined;
  }

  const party: NormalizedParty = {
    key: externalId ?? slugify(name),
    name,
    entityType: inferEntityType(name, externalId),
  };

  if (externalId) {
    party.externalId = externalId;
  }

  return party;
}

function upsertProcessFromRecord(
  processMap: Map<string, NormalizedProcess>,
  record: DncpBulkRecordRow,
  year: number,
  datasetLabel: string,
): void {
  const existing = processMap.get(record.ocid);
  const buyer = makeParty(record.buyerName ?? record.procuringEntityName, record.buyerId ?? record.procuringEntityId);

  if (!existing) {
    const tenderPeriod: NormalizedProcess["tenderPeriod"] = {};
    const metadata: NormalizedProcess["metadata"] = {
      bulkYear: year,
      sourceDataset: datasetLabel,
    };

    if (record.tenderStartDate) {
      tenderPeriod.startDate = record.tenderStartDate;
    }
    if (record.tenderEndDate) {
      tenderPeriod.endDate = record.tenderEndDate;
    }
    if (record.tenderDurationInDays !== undefined) {
      tenderPeriod.durationInDays = record.tenderDurationInDays;
    }

    const process: NormalizedProcess = {
      sourceKey: `py-dncp-bulk-${year}`,
      countryCode: "PY",
      stage: "bulk_record",
      ocid: record.ocid,
      tenderId: record.tenderId,
      title: record.title,
      suppliers: [],
      coveredBy: record.coveredBy,
      contracts: [],
      tenderPeriod,
      sourceUrls: [record.releaseUrl],
      flags: [],
      metadata,
    };

    if (buyer) {
      process.buyer = buyer;
    }
    if (record.planningIdentifier) {
      process.planningIdentifier = record.planningIdentifier;
    }
    if (record.procurementMethod) {
      process.procurementMethod = record.procurementMethod;
    }
    if (record.procurementMethodDetails) {
      process.procurementMethodDetails = record.procurementMethodDetails;
    }
    const statusDetails = record.statusDetails ?? record.status;
    if (statusDetails) {
      process.statusDetails = statusDetails;
    }
    if (record.mainProcurementCategoryDetails) {
      process.mainProcurementCategoryDetails = record.mainProcurementCategoryDetails;
    }
    const publishedDate = record.datePublished ?? record.releaseDate;
    if (publishedDate) {
      process.publishedDate = publishedDate;
    }
    if (record.awardDate) {
      process.awardDate = record.awardDate;
    }
    if (record.numberOfTenderers !== undefined) {
      process.numberOfTenderers = record.numberOfTenderers;
    }

    processMap.set(record.ocid, process);
    return;
  }

  existing.coveredBy = [...new Set([...(existing.coveredBy ?? []), ...record.coveredBy])];
  if (!existing.buyer && buyer) {
    existing.buyer = buyer;
  }
  if (!existing.planningIdentifier && record.planningIdentifier) {
    existing.planningIdentifier = record.planningIdentifier;
  }
  if (!existing.procurementMethod && record.procurementMethod) {
    existing.procurementMethod = record.procurementMethod;
  }
  if (!existing.procurementMethodDetails && record.procurementMethodDetails) {
    existing.procurementMethodDetails = record.procurementMethodDetails;
  }
  const mergedStatusDetails = record.statusDetails ?? record.status;
  if (!existing.statusDetails && mergedStatusDetails) {
    existing.statusDetails = mergedStatusDetails;
  }
  if (!existing.mainProcurementCategoryDetails && record.mainProcurementCategoryDetails) {
    existing.mainProcurementCategoryDetails = record.mainProcurementCategoryDetails;
  }
  const mergedPublishedDate = record.datePublished ?? record.releaseDate;
  if (!existing.publishedDate && mergedPublishedDate) {
    existing.publishedDate = mergedPublishedDate;
  }
  if (!existing.awardDate && record.awardDate) {
    existing.awardDate = record.awardDate;
  }
  if (existing.numberOfTenderers === undefined && record.numberOfTenderers !== undefined) {
    existing.numberOfTenderers = record.numberOfTenderers;
  }
  if (!existing.sourceUrls.includes(record.releaseUrl)) {
    existing.sourceUrls.push(record.releaseUrl);
  }
}

function transactionToNormalized(transactionRow: DncpBulkTransactionRow): NormalizedTransaction {
  const transaction: NormalizedTransaction = {
    id: transactionRow.transactionId,
  };

  if (transactionRow.sourceSystem) {
    transaction.sourceSystem = transactionRow.sourceSystem;
  }
  if (transactionRow.amount !== undefined) {
    transaction.amount = transactionRow.amount;
  }
  if (transactionRow.currency) {
    transaction.currency = transactionRow.currency;
  }
  if (transactionRow.date) {
    transaction.date = transactionRow.date;
  }
  if (transactionRow.requestDate) {
    transaction.requestDate = transactionRow.requestDate;
  }
  if (transactionRow.financialCode) {
    transaction.financialCode = transactionRow.financialCode;
  }

  const payer = makeParty(transactionRow.payerName, transactionRow.payerId);
  const payee = makeParty(transactionRow.payeeName, transactionRow.payeeId);
  if (payer) {
    transaction.payer = payer;
  }
  if (payee) {
    transaction.payee = payee;
  }

  return transaction;
}

function contractToNormalized(
  contractRow: DncpBulkContractRow,
  transactionRows: DncpBulkTransactionRow[],
): NormalizedContract {
  const contract: NormalizedContract = {
    id: contractRow.contractId,
    transactions: transactionRows.map(transactionToNormalized),
  };

  if (contractRow.awardId) {
    contract.awardId = contractRow.awardId;
  }
  if (contractRow.status) {
    contract.status = contractRow.status;
  }
  if (contractRow.statusDetails) {
    contract.statusDetails = contractRow.statusDetails;
  }
  if (contractRow.startDate) {
    contract.startDate = contractRow.startDate;
  }
  if (contractRow.endDate) {
    contract.endDate = contractRow.endDate;
  }
  if (contractRow.durationInDays !== undefined) {
    contract.durationInDays = contractRow.durationInDays;
  }
  if (contractRow.amount !== undefined) {
    contract.amount = contractRow.amount;
  }
  if (contractRow.currency) {
    contract.currency = contractRow.currency;
  }
  if (contractRow.dateSigned) {
    contract.dateSigned = contractRow.dateSigned;
  }

  return contract;
}

export function normalizeDncpBulkYear(snapshot: DncpBulkYearSnapshot): NormalizedProcess[] {
  const processMap = new Map<string, NormalizedProcess>();

  for (const record of snapshot.tenderRecords) {
    upsertProcessFromRecord(processMap, record, snapshot.year, "dncp-bulk-tenders");
  }

  for (const record of snapshot.contractRecords) {
    upsertProcessFromRecord(processMap, record, snapshot.year, "dncp-bulk-contracts");
  }

  const contractRecordsByReleaseId = new Map(snapshot.contractRecords.map((record) => [record.releaseId, record]));
  const contractsByReleaseId = new Map<string, DncpBulkContractRow[]>();
  const transactionsByContractId = new Map<string, DncpBulkTransactionRow[]>();

  for (const contractRow of snapshot.contracts) {
    const existing = contractsByReleaseId.get(contractRow.releaseId) ?? [];
    existing.push(contractRow);
    contractsByReleaseId.set(contractRow.releaseId, existing);
  }

  for (const transactionRow of snapshot.transactions) {
    const existing = transactionsByContractId.get(transactionRow.contractId) ?? [];
    existing.push(transactionRow);
    transactionsByContractId.set(transactionRow.contractId, existing);
  }

  for (const [releaseId, contractRecord] of contractRecordsByReleaseId.entries()) {
    const process = processMap.get(contractRecord.ocid);
    if (!process) {
      continue;
    }

    const contractRows = contractsByReleaseId.get(releaseId) ?? [];
    for (const contractRow of contractRows) {
      const contract = contractToNormalized(
        contractRow,
        transactionsByContractId.get(contractRow.contractId) ?? [],
      );

      process.contracts.push(contract);
      process.totalContractValue = (process.totalContractValue ?? 0) + (contract.amount ?? 0);

      for (const transaction of contract.transactions) {
        if (transaction.payee) {
          const exists = process.suppliers.some((supplier) => supplier.key === transaction.payee?.key);
          if (!exists) {
            process.suppliers.push(transaction.payee);
          }
        }
      }
    }
  }

  return [...processMap.values()];
}
