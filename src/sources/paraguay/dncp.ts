import { fetchJson } from "../../lib/http";

const DNCP_BASE = "https://www.contrataciones.gov.py/datos/api/v3/doc";

export interface DNCPMinimalTender {
  tender: {
    id: string;
    title?: string;
    tenderPeriod?: {
      endDate?: string;
    };
  };
}

export interface DNCPPagination {
  total_items?: number;
  total_pages?: number;
  current_page?: number;
  items_per_page?: number;
  total_in_page?: number;
}

export interface DNCPMinimalTendersResponse {
  list: DNCPMinimalTender[];
  pagination?: DNCPPagination;
}

export interface DNCPSearchSupplier {
  name?: string;
  id?: string;
}

export interface DNCPSearchAward {
  id?: string;
  suppliers?: DNCPSearchSupplier[];
}

export interface DNCPSearchRecord {
  ocid?: string;
  compiledRelease?: {
    date?: string;
    planning?: {
      identifier?: string;
    };
    buyer?: {
      id?: string;
      name?: string;
    };
    tender?: {
      id?: string;
      title?: string;
      procurementMethod?: string;
      procurementMethodDetails?: string;
      statusDetails?: string;
      mainProcurementCategoryDetails?: string;
      tenderPeriod?: {
        startDate?: string;
        endDate?: string;
        durationInDays?: number;
      };
      procuringEntity?: {
        id?: string;
        name?: string;
      };
    };
    awards?: DNCPSearchAward[];
  };
  releases?: Array<{
    date?: string;
    url?: string;
    tag?: string[];
  }>;
}

export interface DNCPSearchResponse {
  uri?: string;
  records: DNCPSearchRecord[];
  pagination?: DNCPPagination;
}

export interface DNCPTenderDetailResponse {
  tender: {
    id: string;
    title?: string;
    procurementMethod?: string;
    procurementMethodDetails?: string;
    status?: string;
    statusDetails?: string;
    datePublished?: string;
    mainProcurementCategory?: string;
    mainProcurementCategoryDetails?: string;
    tenderPeriod?: {
      startDate?: string;
      endDate?: string;
    };
    enquiryPeriod?: {
      startDate?: string;
      endDate?: string;
      durationInDays?: number;
    };
    awardPeriod?: {
      startDate?: string;
    };
    techniques?: {
      hasFrameworkAgreement?: boolean;
    };
    procuringEntity?: {
      id?: string;
      name?: string;
    };
  };
}

function buildUrl(pathname: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(`${DNCP_BASE}${pathname}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function fetchOpenTenderMinimals(from: string, to: string): Promise<DNCPMinimalTendersResponse> {
  const url = buildUrl("/visualizations/minimal/tenders", {
    tenderPeriod_from: from,
    tenderPeriod_until: to,
  });

  return fetchJson<DNCPMinimalTendersResponse>(url);
}

export async function fetchTenderDetail(tenderId: string): Promise<DNCPTenderDetailResponse> {
  const url = buildUrl(`/tender/${encodeURIComponent(tenderId)}`);
  return fetchJson<DNCPTenderDetailResponse>(url, 120);
}

export async function searchRecentProcesses(from: string, to: string, itemsPerPage: number): Promise<DNCPSearchResponse> {
  const url = buildUrl("/search/processes", {
    items_per_page: itemsPerPage,
    page: 1,
    tipo_fecha: "fecha_release",
    fecha_desde: from,
    fecha_hasta: to,
  });

  return fetchJson<DNCPSearchResponse>(url);
}

export async function fetchRelease(releaseUrl: string): Promise<unknown> {
  return fetchJson<unknown>(releaseUrl, 120);
}

