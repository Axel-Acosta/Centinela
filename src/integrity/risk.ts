import type { NormalizedContract, NormalizedParty, NormalizedProcess, RiskSeverity, RiskSignal } from "./model";
import { buildRiskSignal } from "./ruleRegistry";

const exceptionalProcedurePattern =
  /contrataci[oó]n v[ií]a excepci[oó]n|adjudicaci[oó]n directa|excepci[oó]n|locaci[oó]n/i;
const contextualMarkerPattern = /ad refer[eé]ndum|urgencia|emergencia/i;
const adjudicatedPattern = /adjudic|complete|publicado|firmado|cerrada/i;

function hasShortWindow(process: NormalizedProcess): boolean {
  const duration = process.tenderPeriod?.durationInDays;
  return typeof duration === "number" && duration <= 7;
}

function buildPairKey(process: NormalizedProcess, supplierKey: string): string | undefined {
  if (!process.buyer) {
    return undefined;
  }

  return `${process.buyer.key}::${supplierKey}`;
}

function uniqueSuppliers(process: NormalizedProcess) {
  const byKey = new Map(process.suppliers.map((supplier) => [supplier.key, supplier]));
  return [...byKey.values()];
}

function formatPairEvidence(process: NormalizedProcess, supplier: NormalizedParty, pairCount: number): string {
  return `buyer_supplier_pair=${process.buyer?.name ?? "unknown"} -> ${supplier.name}; pair_occurrences_in_loaded_bundle=${pairCount}`;
}

function contractTotal(contract: NormalizedContract): number {
  return contract.transactions.reduce((sum, transaction) => sum + (transaction.amount ?? 0), 0);
}

function computeTotalPaid(process: NormalizedProcess): number {
  return process.contracts.reduce((sum, contract) => sum + contractTotal(contract), 0);
}

export function applyRiskSignals(processes: NormalizedProcess[]): NormalizedProcess[] {
  const pairCounts = new Map<string, number>();

  for (const process of processes) {
    for (const supplier of uniqueSuppliers(process)) {
      const key = buildPairKey(process, supplier.key);
      if (!key) {
        continue;
      }

      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }
  }

  return processes.map((process) => {
    const flags: RiskSignal[] = [];
    const totalPaidAmount = process.totalPaidAmount ?? computeTotalPaid(process);

    if (hasShortWindow(process)) {
      flags.push(
        buildRiskSignal("PY-DNCP-T001", [
          `tenderPeriod.durationInDays=${process.tenderPeriod?.durationInDays ?? "unknown"}`,
        ]),
      );
    }

    const methodText = `${process.procurementMethod ?? ""} ${process.procurementMethodDetails ?? ""}`.trim();
    if (methodText && exceptionalProcedurePattern.test(methodText)) {
      flags.push(
        buildRiskSignal("PY-DNCP-T002", [
          `procurementMethodDetails=${process.procurementMethodDetails ?? process.procurementMethod}`,
        ]),
      );
    }

    const contextualText = `${process.title} ${process.statusDetails ?? ""} ${(process.coveredBy ?? []).join(" ")}`;
    if (contextualMarkerPattern.test(contextualText)) {
      flags.push(
        buildRiskSignal("PY-DNCP-T003", [`title/status=${process.title} | ${process.statusDetails ?? "n/a"}`]),
      );
    }

    if (
      process.numberOfTenderers !== undefined &&
      process.numberOfTenderers <= 1 &&
      adjudicatedPattern.test(process.statusDetails ?? "")
    ) {
      flags.push(
        buildRiskSignal("PY-DNCP-B001", [
          `numberOfTenderers=${process.numberOfTenderers}`,
          `statusDetails=${process.statusDetails ?? "n/a"}`,
        ]),
      );
    }

    if (process.stage === "recent_award" && process.suppliers.length === 0) {
      flags.push(buildRiskSignal("PY-DNCP-A002", ["suppliers=[]"]));
    }

    const repeatedSuppliers = uniqueSuppliers(process)
      .map((supplier) => {
        const pairKey = buildPairKey(process, supplier.key);
        return {
          supplier,
          pairCount: pairKey ? pairCounts.get(pairKey) ?? 0 : 0,
        };
      })
      .filter((item) => item.pairCount > 1)
      .sort((left, right) => right.pairCount - left.pairCount || left.supplier.name.localeCompare(right.supplier.name));

    if (repeatedSuppliers.length > 0) {
      const highestPairCount = repeatedSuppliers[0]?.pairCount ?? 2;
      const repeatedSupplierCount = repeatedSuppliers.length;
      const severity: RiskSeverity = highestPairCount >= 3 ? "high" : "medium";
      const score = highestPairCount >= 5 ? 0.84 : highestPairCount >= 3 ? 0.78 : 0.61;
      const evidence = [
        `buyer=${process.buyer?.name ?? "unknown"}`,
        `repeated_supplier_count=${repeatedSupplierCount}`,
        ...repeatedSuppliers.slice(0, 10).map((item) => formatPairEvidence(process, item.supplier, item.pairCount)),
      ];

      if (repeatedSuppliers.length > 10) {
        evidence.push(`additional_repeated_suppliers=${repeatedSuppliers.length - 10}`);
      }

      flags.push(
        buildRiskSignal("PY-DNCP-P001", evidence, {
          severity,
          score,
          rationale:
            repeatedSupplierCount > 1
              ? "Multiple supplier relationships in this process recur with the same buyer across the loaded procurement bundle and may warrant concentration review."
              : "The same buyer and supplier/payee pairing appears repeatedly in the loaded procurement bundle and may warrant concentration review.",
        }),
      );
    }

    if (
      process.totalContractValue !== undefined &&
      totalPaidAmount > 0 &&
      totalPaidAmount > process.totalContractValue * 1.02
    ) {
      flags.push(
        buildRiskSignal("PY-DNCP-P002", [
          `totalContractValue=${process.totalContractValue}`,
          `observedPaidAmount=${totalPaidAmount}`,
        ]),
      );
    }

    return {
      ...process,
      totalPaidAmount,
      flags,
    };
  });
}
