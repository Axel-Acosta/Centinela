import type {
  DNCPSearchRecord,
  DNCPTenderDetailResponse,
} from "../sources/paraguay/dncp";
import type { NormalizedParty, NormalizedProcess } from "./model";

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

export function normalizeOpenTender(detail: DNCPTenderDetailResponse): NormalizedProcess {
  const buyer = makeParty(detail.tender.procuringEntity?.name, detail.tender.procuringEntity?.id);
  const publishedDate = detail.tender.datePublished ?? detail.tender.tenderPeriod?.startDate;
  const tenderPeriod: NormalizedProcess["tenderPeriod"] = {};

  if (detail.tender.tenderPeriod?.startDate) {
    tenderPeriod.startDate = detail.tender.tenderPeriod.startDate;
  }
  if (detail.tender.tenderPeriod?.endDate) {
    tenderPeriod.endDate = detail.tender.tenderPeriod.endDate;
  }
  if (detail.tender.enquiryPeriod?.durationInDays !== undefined) {
    tenderPeriod.durationInDays = detail.tender.enquiryPeriod.durationInDays;
  }

  const metadata: NormalizedProcess["metadata"] = {};
  if (detail.tender.techniques?.hasFrameworkAgreement !== undefined) {
    metadata.hasFrameworkAgreement = detail.tender.techniques.hasFrameworkAgreement;
  }

  const process: NormalizedProcess = {
    sourceKey: "py-dncp-api-v3",
    countryCode: "PY",
    stage: "open_tender",
    tenderId: detail.tender.id,
    title: detail.tender.title ?? detail.tender.id,
    suppliers: [],
    tenderPeriod,
    contracts: [],
    sourceUrls: [
      `https://www.contrataciones.gov.py/datos/api/v3/doc/tender/${encodeURIComponent(detail.tender.id)}`,
    ],
    flags: [],
    metadata: {
      ...metadata,
      sourceDataset: "dncp-api-v3",
    },
  };

  if (buyer) {
    process.buyer = buyer;
  }

  if (detail.tender.procurementMethod) {
    process.procurementMethod = detail.tender.procurementMethod;
  }
  if (detail.tender.procurementMethodDetails) {
    process.procurementMethodDetails = detail.tender.procurementMethodDetails;
  }
  const openTenderStatus = detail.tender.statusDetails ?? detail.tender.status;
  if (openTenderStatus) {
    process.statusDetails = openTenderStatus;
  }
  if (detail.tender.mainProcurementCategoryDetails) {
    process.mainProcurementCategoryDetails = detail.tender.mainProcurementCategoryDetails;
  }
  if (publishedDate) {
    process.publishedDate = publishedDate;
  }
  if (detail.tender.awardPeriod?.startDate) {
    process.awardDate = detail.tender.awardPeriod.startDate;
  }

  return process;
}

export function normalizeAwardRecord(record: DNCPSearchRecord, hydratedRelease?: unknown): NormalizedProcess {
  const compiled = record.compiledRelease;
  const tender = compiled?.tender;
  const buyer = makeParty(
    compiled?.buyer?.name ?? tender?.procuringEntity?.name,
    compiled?.buyer?.id ?? tender?.procuringEntity?.id,
  );

  const suppliers = (compiled?.awards ?? [])
    .flatMap((award) => award.suppliers ?? [])
    .map((supplier) => makeParty(supplier.name, supplier.id))
    .filter((party): party is NormalizedParty => Boolean(party));

  const releaseUrl = record.releases?.[0]?.url;
  const tenderPeriod: NormalizedProcess["tenderPeriod"] = {};
  if (tender?.tenderPeriod?.startDate) {
    tenderPeriod.startDate = tender.tenderPeriod.startDate;
  }
  if (tender?.tenderPeriod?.endDate) {
    tenderPeriod.endDate = tender.tenderPeriod.endDate;
  }
  if (tender?.tenderPeriod?.durationInDays !== undefined) {
    tenderPeriod.durationInDays = tender.tenderPeriod.durationInDays;
  }

  const metadata: NormalizedProcess["metadata"] = {};
  if (hydratedRelease !== undefined) {
    metadata.rawReleaseIncluded = true;
  }

  const process: NormalizedProcess = {
    sourceKey: "py-dncp-api-v3",
    countryCode: "PY",
    stage: "recent_award",
    tenderId: tender?.id ?? record.ocid ?? "unknown-tender",
    title: tender?.title ?? record.ocid ?? "Untitled procurement process",
    suppliers,
    tenderPeriod,
    contracts: [],
    sourceUrls: releaseUrl ? [releaseUrl] : [],
    flags: [],
    metadata: {
      ...metadata,
      sourceDataset: "dncp-api-v3",
    },
  };

  if (buyer) {
    process.buyer = buyer;
  }

  if (record.ocid) {
    process.ocid = record.ocid;
  }
  if (compiled?.planning?.identifier) {
    process.planningIdentifier = compiled.planning.identifier;
  }
  if (tender?.procurementMethod) {
    process.procurementMethod = tender.procurementMethod;
  }
  if (tender?.procurementMethodDetails) {
    process.procurementMethodDetails = tender.procurementMethodDetails;
  }
  if (tender?.statusDetails) {
    process.statusDetails = tender.statusDetails;
  }
  if (tender?.mainProcurementCategoryDetails) {
    process.mainProcurementCategoryDetails = tender.mainProcurementCategoryDetails;
  }
  const publishedDate = compiled?.date ?? record.releases?.[0]?.date;
  if (publishedDate) {
    process.publishedDate = publishedDate;
  }

  return process;
}
