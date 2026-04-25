import { writeOutputText } from "./files";
import { connectToPostgres } from "./postgres";
import type { RuleInfluence } from "../integrity/ruleRegistry";

interface RuleCoverageRow {
  code: string;
  family: string;
  name: string;
  category: string;
  default_severity: string;
  default_score: string;
  review_lane: string;
  review_priority_hint: string;
  public_description: string;
  analyst_question: string;
  recommended_action: string;
  dncp_alignment: string | null;
  methodology_notes: string[] | null;
  field_dependencies: string[] | null;
  evidence_requirements: string[] | null;
  exclusions: string[] | null;
  limitations: string[] | null;
  precedent_influences: RuleInfluence[] | null;
  process_count: string;
  signal_count: string;
  avg_observed_score: string | null;
}

function formatList(values: string[] | null | undefined): string {
  const items = (values ?? []).filter(Boolean);
  return items.length > 0 ? items.join(", ") : "n/a";
}

function formatInfluences(influences: RuleInfluence[] | null | undefined): string[] {
  return (influences ?? []).map(
    (influence) => `- ${influence.reference}: ${influence.contribution}`,
  );
}

function toNumber(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderRulebook(scopeLabel: string, rows: RuleCoverageRow[]): string {
  const totalRules = rows.length;
  const observedRules = rows.filter((row) => toNumber(row.process_count) > 0).length;
  const totalMatchedProcesses = rows.reduce((sum, row) => sum + toNumber(row.process_count), 0);
  const totalMatchedSignals = rows.reduce((sum, row) => sum + toNumber(row.signal_count), 0);
  const lines: string[] = [];

  lines.push(`# Rulebook for ${scopeLabel}`);
  lines.push("");
  lines.push("This rulebook documents investigatory risk signals and follow-up logic, not proof of wrongdoing.");
  lines.push("");
  lines.push("## Coverage");
  lines.push("");
  lines.push(`- Rules in registry: ${totalRules}`);
  lines.push(`- Rules observed in scope: ${observedRules}`);
  lines.push(`- Matched processes in scope: ${totalMatchedProcesses}`);
  lines.push(`- Matched signals in scope: ${totalMatchedSignals}`);
  lines.push("");
  lines.push("## Registry structure");
  lines.push("");
  lines.push("- The registry carries rule IDs, categories, review lanes, priority hints, evidence expectations, exclusions, limitations, and precedent influences.");
  lines.push("- It is intended to translate Cardinal/OCDS, GTI, DNCP, Integrity Watch, FUNES, Rosie, and RUBLI pressures into reusable system metadata.");
  lines.push("- Counts below reflect currently loaded data in the selected scope.");
  lines.push("");
  lines.push("## Rules");
  lines.push("");

  for (const row of rows) {
    lines.push(`### ${row.code} - ${row.name}`);
    lines.push(`- Family: ${row.family}`);
    lines.push(`- Category: ${row.category}`);
    lines.push(`- Default severity: ${row.default_severity}`);
    lines.push(`- Default score: ${row.default_score}`);
    lines.push(`- Review lane: ${row.review_lane}`);
    lines.push(`- Review priority hint: ${row.review_priority_hint}`);
    lines.push(`- Observed processes in scope: ${row.process_count}`);
    lines.push(`- Observed signals in scope: ${row.signal_count}`);
    lines.push(`- Average observed score: ${row.avg_observed_score ?? "n/a"}`);
    lines.push(`- Public description: ${row.public_description}`);
    lines.push(`- Analyst question: ${row.analyst_question}`);
    lines.push(`- Recommended action: ${row.recommended_action}`);
    lines.push(`- Field dependencies: ${formatList(row.field_dependencies)}`);
    lines.push(`- Evidence requirements: ${formatList(row.evidence_requirements)}`);
    lines.push(`- Exclusions: ${formatList(row.exclusions)}`);
    lines.push(`- Limitations: ${formatList(row.limitations)}`);
    lines.push(`- Methodology notes: ${formatList(row.methodology_notes)}`);
    lines.push(`- DNCP alignment: ${row.dncp_alignment ?? "n/a"}`);
    lines.push("- Precedent influences:");

    const influences = formatInfluences(row.precedent_influences);
    if (influences.length === 0) {
      lines.push("- n/a");
    } else {
      lines.push(...influences);
    }

    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

export async function buildRulebookReport(
  sourceKey?: string,
): Promise<{ report: string; reportPath: string }> {
  const { client, schema } = await connectToPostgres();

  try {
    const result = await client.query<RuleCoverageRow>(
      `with scoped_signals as (
         select signals.*
         from ${schema}.risk_signals as signals
         join ${schema}.procurement_processes as processes
           on processes.id = signals.process_id
         where ($1::text is null or processes.source_key = $1)
       )
       select
         registry.code,
         registry.family,
         registry.name,
         registry.category,
         registry.default_severity,
         registry.default_score::text,
         registry.review_lane,
         registry.review_priority_hint,
         registry.public_description,
         registry.analyst_question,
         registry.recommended_action,
         registry.dncp_alignment,
         registry.methodology_notes,
         registry.field_dependencies,
         registry.evidence_requirements,
         registry.exclusions,
         registry.limitations,
         registry.precedent_influences,
         count(scoped_signals.id)::text as signal_count,
         count(distinct scoped_signals.process_id)::text as process_count,
         round(avg(scoped_signals.score)::numeric, 2)::text as avg_observed_score
       from ${schema}.risk_rule_registry as registry
       left join scoped_signals
         on scoped_signals.signal_code = registry.code
       where registry.country_code = 'PY'
       group by
         registry.code,
         registry.family,
         registry.name,
         registry.category,
         registry.default_severity,
         registry.default_score,
         registry.review_lane,
         registry.review_priority_hint,
         registry.public_description,
         registry.analyst_question,
         registry.recommended_action,
         registry.dncp_alignment,
         registry.methodology_notes,
         registry.field_dependencies,
         registry.evidence_requirements,
         registry.exclusions,
         registry.limitations,
         registry.precedent_influences
       order by registry.code`,
      [sourceKey ?? null],
    );

    const scopeLabel = sourceKey ?? "all loaded Paraguay procurement sources";
    const report = renderRulebook(scopeLabel, result.rows);
    const fileName = sourceKey ? `${sourceKey}-rulebook.md` : "all-sources-rulebook.md";
    const reportPath = await writeOutputText(["reports", "paraguay", fileName], report);

    return {
      report,
      reportPath,
    };
  } finally {
    await client.end();
  }
}
