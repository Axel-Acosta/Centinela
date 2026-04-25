export type ProcessStage = "open_tender" | "recent_award" | "bulk_record";
export type RiskSeverity = "low" | "medium" | "high";
export type RiskCategory = "competition" | "context" | "concentration" | "data_quality" | "payment";
export type ReviewLane =
  | "competition_review"
  | "procedure_review"
  | "context_review"
  | "repeat_supplier_review"
  | "payment_trace"
  | "data_quality_review"
  | "general_triage";
export type ReviewPriority = "triage" | "enhanced_review" | "priority";

export interface NormalizedParty {
  key: string;
  name: string;
  externalId?: string;
  entityType: "institution" | "company" | "person" | "unknown";
}

export interface RiskSignal {
  code: string;
  name: string;
  severity: RiskSeverity;
  category: RiskCategory;
  score: number;
  rationale: string;
  evidence: string[];
}

export interface NormalizedTransaction {
  id: string;
  sourceSystem?: string;
  amount?: number;
  currency?: string;
  date?: string;
  requestDate?: string;
  financialCode?: string;
  payer?: NormalizedParty;
  payee?: NormalizedParty;
}

export interface NormalizedContract {
  id: string;
  awardId?: string;
  status?: string;
  statusDetails?: string;
  startDate?: string;
  endDate?: string;
  durationInDays?: number;
  amount?: number;
  currency?: string;
  dateSigned?: string;
  transactions: NormalizedTransaction[];
}

export interface NormalizedProcess {
  sourceKey: string;
  countryCode: "PY";
  stage: ProcessStage;
  ocid?: string;
  tenderId: string;
  planningIdentifier?: string;
  title: string;
  procurementMethod?: string;
  procurementMethodDetails?: string;
  statusDetails?: string;
  mainProcurementCategoryDetails?: string;
  buyer?: NormalizedParty;
  suppliers: NormalizedParty[];
  numberOfTenderers?: number;
  coveredBy?: string[];
  publishedDate?: string;
  awardDate?: string;
  totalContractValue?: number;
  totalPaidAmount?: number;
  tenderPeriod?: {
    startDate?: string;
    endDate?: string;
    durationInDays?: number;
  };
  contracts: NormalizedContract[];
  sourceUrls: string[];
  flags: RiskSignal[];
  metadata: {
    hasFrameworkAgreement?: boolean;
    rawReleaseIncluded?: boolean;
    bulkYear?: number;
    sourceDataset?: string;
  };
}
