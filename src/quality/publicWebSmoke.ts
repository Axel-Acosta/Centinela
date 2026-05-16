import type http from "node:http";
import "../config";
import { servePublicSite } from "../server/publicSite";

function serverUrl(server: http.Server): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Public web smoke test could not read the server address.");
  }

  return `http://127.0.0.1:${address.port}`;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`Request failed: ${url} ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function data(payload: Record<string, unknown>): Record<string, unknown> {
  const value = payload.data;
  assert(value && typeof value === "object" && !Array.isArray(value), "Expected payload.data object.");
  return value as Record<string, unknown>;
}

async function main(): Promise<void> {
  const server = await servePublicSite({ host: "127.0.0.1", port: 0 });

  try {
    const baseUrl = serverUrl(server);

    const page = await fetch(`${baseUrl}/`);
    const html = await page.text();
    assert(page.ok, "Public page did not return 200.");
    assert(html.includes("Public records, organized for review."), "Public page headline missing.");
    assert(html.includes("api/public/overview"), "Public page does not call the public overview API.");
    assert(!html.includes("/api/analyst-cases/"), "Public page should not call internal analyst-case APIs.");
    assert(!html.includes("CENTINELA_WRITE_TOKEN"), "Public page should not mention write-token internals.");

    const head = await fetch(`${baseUrl}/`, { method: "HEAD" });
    assert(head.ok, "Public page HEAD request did not return 200.");

    const health = await getJson(`${baseUrl}/healthz`);
    assert(health.ok === true, "Health endpoint did not return ok.");

    const overviewPayload = await getJson(`${baseUrl}/api/public/overview`);
    const overview = data(overviewPayload);
    const counts = overview.counts as Record<string, unknown> | undefined;
    assert(counts, "Public overview counts missing.");
    assert(Number(counts.procurement_processes) > 0, "Public overview has no procurement processes.");
    assert(Array.isArray(overview.ruleCoverage), "Public overview rule coverage missing.");

    const searchPayload = await getJson(`${baseUrl}/api/public/entities?q=CONSULTORA%20GUARANI&limit=5`);
    const searchRows = searchPayload.data;
    assert(Array.isArray(searchRows), "Public entity search did not return a row array.");
    assert(searchRows.length > 0, "Public entity search returned no Consultora Guarani rows.");
    const firstRow = searchRows[0] as Record<string, unknown>;
    const entityId = Number(firstRow.entity_id);
    assert(Number.isInteger(entityId) && entityId > 0, "Public entity search returned an invalid entity ID.");

    const entityPayload = await getJson(`${baseUrl}/api/public/entities/${entityId}`);
    const entityProfile = data(entityPayload);
    assert(entityProfile.entity, "Public entity profile missing entity object.");
    assert(Array.isArray(entityProfile.procurementRiskRules), "Public entity risk-rule section missing.");
    assert(Array.isArray(entityProfile.sourcePackCases), "Public entity source-pack case section missing.");
    assert(
      JSON.stringify(entityProfile).includes("not proof") || JSON.stringify(entityProfile).includes("not a finding"),
      "Public entity profile should preserve non-accusatory limits.",
    );

    console.log("Centinela public web smoke passed.");
    console.log(`Local smoke URL: ${baseUrl}/`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
