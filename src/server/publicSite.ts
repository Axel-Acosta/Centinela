import http from "node:http";
import {
  PUBLIC_DISCLAIMER,
  getPublicEntityProfile,
  getPublicOverview,
  getPublicRiskStory,
  searchPublicEntities,
  searchPublicInstitutions,
} from "../storage/publicApi";

export interface PublicSiteOptions {
  host?: string;
  port?: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 180;
const buckets = new Map<string, RateLimitBucket>();

function numberParam(url: URL, name: string): number | undefined {
  const value = url.searchParams.get(name);
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function textParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)?.trim();
  return value && value.length > 0 ? value : undefined;
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "cache-control": "public, max-age=60, stale-while-revalidate=120",
    "content-type": "application/json; charset=utf-8",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response: http.ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "cache-control": "public, max-age=120, stale-while-revalidate=300",
    "content-security-policy":
      "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "content-type": "text/html; charset=utf-8",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });
  response.end(body);
}

function sendText(response: http.ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "cache-control": "public, max-age=3600",
    "content-type": "text/plain; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(body);
}

function parseEntityRoute(pathname: string): number | undefined {
  const match = pathname.match(/^\/api\/public\/entities\/(\d+)$/);
  if (!match) {
    return undefined;
  }

  const entityId = Number(match[1]);
  return Number.isInteger(entityId) && entityId > 0 ? entityId : undefined;
}

function clientKey(request: http.IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value?.split(",")[0] ?? request.socket.remoteAddress ?? "unknown").trim();
}

function checkRateLimit(request: http.IncomingMessage): boolean {
  const key = clientKey(request);
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX_REQUESTS;
}

async function handlePublicApi(url: URL): Promise<unknown> {
  if (url.pathname === "/api/public/overview") {
    return getPublicOverview();
  }

  if (url.pathname === "/api/public/risk-story") {
    return getPublicRiskStory();
  }

  if (url.pathname === "/api/public/entities") {
    const options: { q?: string; limit?: number } = {};
    const q = textParam(url, "q");
    const limit = numberParam(url, "limit");

    if (q !== undefined) {
      options.q = q;
    }

    if (limit !== undefined) {
      options.limit = limit;
    }

    return searchPublicEntities(options);
  }

  if (url.pathname === "/api/public/institutions") {
    const options: { q?: string; limit?: number } = {};
    const q = textParam(url, "q");
    const limit = numberParam(url, "limit");

    if (q !== undefined) {
      options.q = q;
    }

    if (limit !== undefined) {
      options.limit = limit;
    }

    return searchPublicInstitutions(options);
  }

  const entityId = parseEntityRoute(url.pathname);
  if (entityId !== undefined) {
    return getPublicEntityProfile(entityId);
  }

  const error = new Error(`Unknown public API path: ${url.pathname}`);
  (error as Error & { statusCode?: number }).statusCode = 404;
  throw error;
}

function publicHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Centinela | Paraguay Public-Integrity Intelligence</title>
  <style>
    :root {
      color-scheme: light;
      --paper: oklch(0.975 0.006 92);
      --paper-quiet: oklch(0.948 0.009 92);
      --panel: oklch(0.988 0.006 96);
      --panel-strong: oklch(0.924 0.013 94);
      --ink: oklch(0.245 0.023 154);
      --ink-muted: oklch(0.438 0.025 147);
      --ink-soft: oklch(0.565 0.025 142);
      --line: oklch(0.842 0.017 100);
      --green: oklch(0.36 0.082 151);
      --green-deep: oklch(0.282 0.071 151);
      --green-wash: oklch(0.913 0.039 146);
      --amber: oklch(0.69 0.119 77);
      --amber-wash: oklch(0.936 0.053 82);
      --red-wash: oklch(0.924 0.036 28);
      --red-ink: oklch(0.42 0.102 30);
      --shadow: 0 24px 70px oklch(0.34 0.03 120 / 0.12);
      --radius: 24px;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      background:
        radial-gradient(circle at 12% 6%, oklch(0.91 0.036 145 / 0.56), transparent 28rem),
        linear-gradient(145deg, var(--paper), oklch(0.958 0.011 83));
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      line-height: 1.5;
    }

    a {
      color: var(--green-deep);
      text-underline-offset: 0.18em;
    }

    button,
    input {
      font: inherit;
    }

    button {
      border: 1px solid var(--green-deep);
      border-radius: 999px;
      background: var(--green-deep);
      color: var(--panel);
      cursor: pointer;
      font-weight: 700;
      padding: 0.78rem 1rem;
      transition: background-color 180ms ease-out, border-color 180ms ease-out, transform 180ms ease-out;
    }

    button:hover {
      background: var(--green);
      border-color: var(--green);
      transform: translateY(-1px);
    }

    button:focus-visible,
    input:focus-visible,
    a:focus-visible {
      outline: 3px solid oklch(0.72 0.1 84 / 0.75);
      outline-offset: 3px;
    }

    .shell {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      border-bottom: 1px solid oklch(0.84 0.018 96 / 0.72);
      background: oklch(0.972 0.007 92 / 0.94);
      backdrop-filter: blur(14px);
    }

    .topbar-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      min-height: 68px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-weight: 850;
      letter-spacing: -0.03em;
    }

    .mark {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border: 1px solid var(--green);
      border-radius: 14px;
      background: var(--green-wash);
      color: var(--green-deep);
      font-weight: 900;
    }

    nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.8rem;
      font-size: 0.92rem;
    }

    nav a {
      color: var(--ink-muted);
      font-weight: 650;
      text-decoration: none;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
      gap: clamp(1.5rem, 3vw, 3rem);
      padding: clamp(3rem, 7vw, 6rem) 0 2.4rem;
      align-items: center;
    }

    .eyebrow {
      color: var(--green-deep);
      font-size: 0.78rem;
      font-weight: 850;
      letter-spacing: 0.11em;
      text-transform: uppercase;
    }

    h1,
    h2,
    h3 {
      line-height: 1.04;
      margin: 0;
      letter-spacing: -0.045em;
    }

    h1 {
      max-width: 12ch;
      font-size: clamp(3rem, 7vw, 6.4rem);
    }

    h2 {
      font-size: clamp(2rem, 4vw, 3.2rem);
      max-width: 15ch;
    }

    h3 {
      font-size: 1.12rem;
      letter-spacing: -0.025em;
    }

    p {
      margin: 0;
      color: var(--ink-muted);
    }

    .lede {
      max-width: 68ch;
      margin-top: 1.2rem;
      font-size: 1.16rem;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.8rem;
      margin-top: 1.7rem;
    }

    .secondary-link {
      display: inline-flex;
      align-items: center;
      min-height: 42px;
      color: var(--green-deep);
      font-weight: 750;
    }

    .scope-panel {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      box-shadow: var(--shadow);
      padding: clamp(1.2rem, 3vw, 2rem);
    }

    .scope-panel .status {
      display: inline-flex;
      border-radius: 999px;
      background: var(--amber-wash);
      color: oklch(0.39 0.075 75);
      font-size: 0.76rem;
      font-weight: 850;
      letter-spacing: 0.06em;
      margin-bottom: 1rem;
      padding: 0.42rem 0.7rem;
      text-transform: uppercase;
    }

    .section {
      padding: clamp(2rem, 5vw, 4.2rem) 0;
    }

    .section-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 1.4rem;
      margin-bottom: 1.4rem;
    }

    .section-heading p {
      max-width: 60ch;
    }

    .metric-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.8rem;
    }

    .metric {
      border: 1px solid var(--line);
      border-radius: 20px;
      background: oklch(0.988 0.005 96);
      padding: 1rem;
    }

    .metric strong {
      display: block;
      color: var(--ink);
      font-size: 1.55rem;
      letter-spacing: -0.045em;
    }

    .metric span {
      color: var(--ink-soft);
      font-size: 0.86rem;
      font-weight: 650;
    }

    .split {
      display: grid;
      grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr);
      gap: 1rem;
      align-items: start;
    }

    .panel {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--panel);
      padding: clamp(1rem, 2vw, 1.4rem);
    }

    .panel.subtle {
      background: var(--paper-quiet);
    }

    .stack {
      display: grid;
      gap: 0.85rem;
    }

    .list {
      display: grid;
      gap: 0.7rem;
      margin-top: 0.9rem;
    }

    .item {
      border: 1px solid oklch(0.858 0.018 97);
      border-radius: 18px;
      background: oklch(0.982 0.006 95);
      padding: 0.9rem;
    }

    .item strong {
      display: block;
      margin-bottom: 0.28rem;
    }

    .item p,
    .small {
      color: var(--ink-soft);
      font-size: 0.9rem;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-top: 0.7rem;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      border: 1px solid oklch(0.805 0.025 95);
      border-radius: 999px;
      background: var(--paper);
      color: var(--ink-muted);
      font-size: 0.78rem;
      font-weight: 750;
      padding: 0.34rem 0.58rem;
    }

    .chip.review {
      border-color: oklch(0.805 0.07 78);
      background: var(--amber-wash);
      color: oklch(0.38 0.075 74);
    }

    .chip.safe {
      border-color: oklch(0.75 0.055 148);
      background: var(--green-wash);
      color: var(--green-deep);
    }

    .chip.limit {
      border-color: oklch(0.806 0.052 32);
      background: var(--red-wash);
      color: var(--red-ink);
    }

    .search {
      display: flex;
      gap: 0.65rem;
      margin-top: 1rem;
    }

    .search input {
      flex: 1;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      color: var(--ink);
      padding: 0.78rem 1rem;
    }

    .profile-header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .profile-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.65rem;
      margin: 1rem 0;
    }

    .profile-grid .metric {
      border-radius: 16px;
      padding: 0.8rem;
    }

    .method-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .story-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
      gap: 1rem;
      align-items: start;
    }

    .story-lede {
      color: var(--ink);
      font-size: 1.02rem;
      margin-top: 0.7rem;
    }

    .meter {
      display: grid;
      gap: 0.38rem;
      margin-top: 0.7rem;
    }

    .meter-track {
      overflow: hidden;
      height: 10px;
      border-radius: 999px;
      background: var(--panel-strong);
    }

    .meter-fill {
      width: var(--meter-width, 0%);
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--green), var(--amber));
    }

    .footer {
      border-top: 1px solid var(--line);
      padding: 2rem 0 3rem;
    }

    .loading {
      color: var(--ink-soft);
      font-weight: 650;
    }

    .error {
      border-color: oklch(0.78 0.071 31);
      background: var(--red-wash);
      color: var(--red-ink);
    }

    @media (max-width: 920px) {
      .hero,
      .split,
      .story-grid,
      .method-grid {
        grid-template-columns: 1fr;
      }

      .metric-row,
      .profile-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .section-heading {
        display: grid;
      }
    }

    @media (max-width: 640px) {
      .shell {
        width: min(100% - 22px, 1180px);
      }

      .topbar {
        position: static;
      }

      .topbar-inner {
        align-items: start;
        flex-direction: column;
        padding: 0.85rem 0;
      }

      nav {
        justify-content: start;
      }

      h1 {
        font-size: 3rem;
      }

      .metric-row,
      .profile-grid {
        grid-template-columns: 1fr;
      }

      .search {
        align-items: stretch;
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="shell topbar-inner">
      <div class="brand"><span class="mark">C</span><span>Centinela</span></div>
      <nav aria-label="Main navigation">
        <a href="#country">Country Lens</a>
        <a href="#risk-story">Risk Story</a>
        <a href="#institutions">Institutions</a>
        <a href="#entity">Entity Profile</a>
        <a href="#methodology">Methodology</a>
        <a href="#profile-model">Transparency Profile</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="shell hero">
      <div>
        <div class="eyebrow">Paraguay public-integrity intelligence</div>
        <h1>Public records, organized for review.</h1>
        <p class="lede">
          Centinela turns procurement and company-source records into traceable risk signals, entity context, and evidence trails. It is a review system, not an accusation engine.
        </p>
        <div class="hero-actions">
          <button id="open-demo">Open example profile</button>
          <button id="open-institution-demo">Open institution lens</button>
          <a class="secondary-link" href="#methodology">See what Centinela can and cannot claim</a>
        </div>
      </div>
      <aside class="scope-panel">
        <span class="status">Public pilot surface</span>
        <h2>What this web view exposes</h2>
        <p>
          This page shows public-safe summaries from the live Centinela database: country-scale procurement signals, institution lenses, company profiles, identity anchors, source-pack status, and limitations.
        </p>
        <div class="chips">
          <span class="chip safe">Read-only</span>
          <span class="chip review">Review-first</span>
          <span class="chip limit">No legal conclusions</span>
        </div>
      </aside>
    </section>

    <section id="country" class="shell section">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Country lens</div>
          <h2>How Centinela shows risk at national scale</h2>
        </div>
        <p>
          The country view groups procurement records by explainable rule families. These are signals for prioritization, not findings of corruption.
        </p>
      </div>
      <div id="overview-status" class="loading">Loading live public snapshot...</div>
      <div id="metrics" class="metric-row" aria-live="polite"></div>
      <div class="split section">
        <div class="panel">
          <h3>Procurement rule coverage</h3>
          <p class="small">Rules are explainable checks inspired by OCDS/Cardinal, DNCP red-flag practice, GTI/OpenTender, RUBLI, and local review needs.</p>
          <div id="rules" class="list"></div>
        </div>
        <div class="panel subtle">
          <h3>Company review lens</h3>
          <p class="small">A public-safe list of company-level review context. It avoids person-level staged relationship rows and internal analyst notes.</p>
          <div id="risk-lens" class="list"></div>
        </div>
      </div>
    </section>

    <section id="risk-story" class="shell section">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Risk story</div>
          <h2>A concrete way to read corruption risk</h2>
        </div>
        <p>
          Centinela converts raw public records into a review story: what triggered attention, what evidence exists, what is missing, and what a human should check next.
        </p>
      </div>
      <div id="risk-story-status" class="loading">Loading public risk story...</div>
      <div class="story-grid">
        <div class="panel">
          <h3>Paraguay story</h3>
          <div id="country-story" class="list"></div>
        </div>
        <div class="panel subtle">
          <h3>What review intensity means</h3>
          <p class="story-lede">
            Review intensity is not a corruption score. It is a triage label that rises when public procurement signals, flagged-process share, source-pack context, and reviewed identity context accumulate.
          </p>
          <div id="story-limits" class="list"></div>
        </div>
      </div>
    </section>

    <section id="institutions" class="shell section">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Institution lens</div>
          <h2>Buyer institutions with review signals</h2>
        </div>
        <p>
          This lens is useful for oversight prioritization. It must be read with procurement volume, sector, and budget context.
        </p>
      </div>
      <div class="panel">
        <h3>Search institutions</h3>
        <div class="search">
          <input id="institution-query" value="Ministerio de Salud" aria-label="Search institution" />
          <button id="institution-search">Search</button>
        </div>
        <div id="institution-results" class="list"></div>
      </div>
    </section>

    <section id="entity" class="shell section">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Entity profile</div>
          <h2>One company, one evidence trail</h2>
        </div>
        <p>
          Search a supplier or open the guided example. The profile separates procurement signals, identity context, source packs, and limitations.
        </p>
      </div>
      <div class="panel">
        <h3>Search company profiles</h3>
        <div class="search">
          <input id="entity-query" value="CONSULTORA GUARANI" aria-label="Search entity" />
          <button id="entity-search">Search</button>
        </div>
        <div id="entity-results" class="list"></div>
      </div>
      <div id="entity-profile" class="panel section" aria-live="polite">
        <div class="loading">Open the guided example or search for a company.</div>
      </div>
    </section>

    <section id="methodology" class="shell section">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Methodology boundaries</div>
          <h2>What Centinela can responsibly say</h2>
        </div>
        <p>${PUBLIC_DISCLAIMER}</p>
      </div>
      <div class="method-grid">
        <div class="panel">
          <h3>Allowed claims</h3>
          <div class="list">
            <div class="item"><strong>Source context exists</strong><p>Centinela can show which public sources were checked and what records were linked.</p></div>
            <div class="item"><strong>A rule triggered</strong><p>A signal means a defined review rule matched the data. It is a lead, not a verdict.</p></div>
            <div class="item"><strong>A profile has limits</strong><p>Missing documents, 404s, weak matches, and privacy boundaries remain visible.</p></div>
          </div>
        </div>
        <div class="panel">
          <h3>Blocked claims</h3>
          <div class="list">
            <div class="item"><strong>No guilt claim</strong><p>Centinela does not claim a person or company committed corruption.</p></div>
            <div class="item"><strong>No clean certificate</strong><p>It does not prove that an entity is clean, compliant, or free of hidden conflicts.</p></div>
            <div class="item"><strong>No public person graph</strong><p>Person-level relationship staging is privacy-protected and not exposed here.</p></div>
          </div>
        </div>
        <div class="panel">
          <h3>Evidence ladder</h3>
          <div class="list">
            <div class="item"><strong>Public record</strong><p>Official or external source record captured with provenance.</p></div>
            <div class="item"><strong>Review signal</strong><p>Rule, candidate, or source limitation that needs analyst inspection.</p></div>
            <div class="item"><strong>Reviewed context</strong><p>Accepted identity context or source pack only after rationale and limitations are recorded.</p></div>
          </div>
        </div>
      </div>
    </section>

    <section id="profile-model" class="shell section">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Future product path</div>
          <h2>Verified transparency profiles</h2>
        </div>
        <p>
          A later Centinela profile should certify evidence completeness and review scope, never that an entity is clean.
        </p>
      </div>
      <div class="panel">
        <div class="list">
          <div class="item"><strong>Could certify</strong><p>Sources checked, identifiers verified, source packs assembled, limitations recorded, and review date/scope.</p></div>
          <div class="item"><strong>Must not certify</strong><p>No corruption, no hidden ownership, no legal compliance, no quality guarantee, and no moral endorsement.</p></div>
          <div class="item"><strong>Needed before public certification</strong><p>Published methodology, reviewer governance, expiry dates, correction process, privacy review, and legal review.</p></div>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="shell">
      <p class="small">Centinela public web pilot. Data is public-record review context. Generated at the moment the page queries the live service.</p>
    </div>
  </footer>

  <script>
    const demoEntityId = 3940;
    const demoInstitutionId = 223;

    function html(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function number(value) {
      const numeric = Number(value ?? 0);
      return Number.isFinite(numeric) ? numeric.toLocaleString('en-US') : '0';
    }

    function money(value) {
      const numeric = Number(value ?? 0);
      return Number.isFinite(numeric)
        ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric)
        : '0';
    }

    async function getJson(path) {
      const response = await fetch(path);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Request failed');
      }
      return payload.data;
    }

    function metric(label, value) {
      return '<div class="metric"><strong>' + html(value) + '</strong><span>' + html(label) + '</span></div>';
    }

    function chip(text, kind) {
      return '<span class="chip ' + html(kind || '') + '">' + html(text) + '</span>';
    }

    function item(title, body, chips) {
      return '<div class="item"><strong>' + html(title) + '</strong><p>' + body + '</p>' +
        (chips && chips.length ? '<div class="chips">' + chips.join('') + '</div>' : '') +
        '</div>';
    }

    function reviewMeter(reviewIntensity) {
      const intensity = reviewIntensity || {};
      const score = Math.max(0, Math.min(100, Number(intensity.score || 0)));
      return '<div class="meter" aria-label="Review intensity">' +
        '<div class="chips">' + chip(intensity.label || 'review intensity', 'review') +
        chip(score + '/100 triage', '') + '</div>' +
        '<div class="meter-track"><div class="meter-fill" style="--meter-width:' + score + '%"></div></div>' +
        '<p class="small">' + html(intensity.explanation || 'A review label, not a finding.') + '</p>' +
        '</div>';
    }

    function renderOverview(data) {
      const counts = data.counts || {};
      document.getElementById('overview-status').textContent = '';
      document.getElementById('metrics').innerHTML = [
        metric('Procurement processes', number(counts.procurement_processes)),
        metric('Contracts', number(counts.contracts)),
        metric('Risk signals for review', number(counts.procurement_risk_signals)),
        metric('Source records', number(counts.source_records))
      ].join('');

      const rules = Array.isArray(data.ruleCoverage) ? data.ruleCoverage : [];
      document.getElementById('rules').innerHTML = rules.map(function(rule) {
        return item(
          rule.code + ': ' + rule.name,
          html(rule.public_description || 'Defined procurement review signal.') +
            '<br><span class="small">Observed in ' + number(rule.process_count) +
            ' processes, ' + number(rule.signal_count) + ' signal records.</span>',
          [
            chip(rule.category || 'rule', 'safe'),
            chip(rule.default_severity || 'severity', 'review'),
            chip(rule.review_lane || 'review lane', '')
          ]
        );
      }).join('');

      const lens = Array.isArray(data.publicRiskLens) ? data.publicRiskLens : [];
      document.getElementById('risk-lens').innerHTML = lens.map(function(entity) {
        return item(
          entity.entity_name,
          'Public-record review context: ' + number(entity.total_process_count) +
            ' processes, ' + number(entity.flagged_process_count) +
            ' flagged processes, ' + number(entity.total_risk_signals) + ' signals.',
          [
            chip(entity.review_priority || 'priority', 'review'),
            chip(entity.anchor_status || 'anchor status', 'safe'),
            chip('relationship leads hidden: ' + number(entity.staged_relationship_lead_count), 'limit')
          ]
        );
      }).join('');
    }

    function renderRiskStory(data) {
      document.getElementById('risk-story-status').textContent = '';
      const signals = Array.isArray(data.headlineSignals) ? data.headlineSignals : [];
      const institutions = Array.isArray(data.topInstitutions) ? data.topInstitutions : [];
      const companies = Array.isArray(data.topCompanies) ? data.topCompanies : [];
      const limits = Array.isArray(data.limitations) ? data.limitations : [];

      document.getElementById('country-story').innerHTML =
        signals.map(function(signal) {
          const body = html(signal.body || '') +
            (signal.detail ? '<br><span class="small">' + html(signal.detail) + '</span>' : '') +
            (signal.processCount ? '<br><span class="small">Processes: ' + number(signal.processCount) +
              ', signal rows: ' + number(signal.evidenceCount) + '.</span>' : '');
          return item(signal.title || 'Public-record signal', body, [chip('review lead', 'review')]);
        }).join('') +
        item(
          'High-signal institution examples',
          institutions.slice(0, 3).map(function(row) {
            return html(row.entity_name) + ' (' + number(row.total_risk_signals) + ' signals)';
          }).join('; ') || 'No institution examples loaded.',
          [chip('compare with volume', 'limit')]
        ) +
        item(
          'High-signal company examples',
          companies.slice(0, 3).map(function(row) {
            return html(row.entity_name) + ' (' + number(row.total_risk_signals) + ' signals)';
          }).join('; ') || 'No company examples loaded.',
          [chip('entity review', 'safe')]
        );

      document.getElementById('story-limits').innerHTML =
        limits.map(function(limit) {
          return item('Limit', html(limit), [chip('public boundary', 'limit')]);
        }).join('');
    }

    function renderSearchResults(rows) {
      const container = document.getElementById('entity-results');
      if (!rows.length) {
        container.innerHTML = item('No public company profile found', 'Try another supplier name or RUC fragment.', []);
        return;
      }

      container.innerHTML = rows.map(function(row) {
        return '<div class="item"><strong>' + html(row.entity_name) + '</strong>' +
          '<p>' + number(row.total_process_count) + ' processes, ' +
          number(row.total_risk_signals) + ' risk signals, anchor: ' +
          html(row.anchor_status || 'unknown') + '.</p>' +
          '<div class="chips">' +
          chip(row.review_priority || 'review priority', 'review') +
          chip(row.review_lane || 'review lane', '') +
          '<button data-open-entity="' + html(row.entity_id) + '">Open profile</button>' +
          '</div></div>';
      }).join('');

      container.querySelectorAll('[data-open-entity]').forEach(function(button) {
        button.addEventListener('click', function() {
          loadEntity(Number(button.getAttribute('data-open-entity'))).catch(showEntityError);
        });
      });
    }

    function renderInstitutionResults(rows) {
      const container = document.getElementById('institution-results');
      if (!rows.length) {
        container.innerHTML = item('No public institution profile found', 'Try a ministry, municipality, or buyer institution name.', []);
        return;
      }

      container.innerHTML = rows.map(function(row) {
        return '<div class="item"><strong>' + html(row.entity_name) + '</strong>' +
          '<p>' + number(row.total_process_count) + ' buyer processes, ' +
          number(row.flagged_process_count) + ' flagged processes, ' +
          number(row.total_risk_signals) + ' risk signals for review.</p>' +
          reviewMeter(row.reviewIntensity) +
          '<div class="chips">' +
          chip('institution lens', 'safe') +
          chip('volume context needed', 'limit') +
          '<button data-open-institution="' + html(row.entity_id) + '">Open institution profile</button>' +
          '</div></div>';
      }).join('');

      container.querySelectorAll('[data-open-institution]').forEach(function(button) {
        button.addEventListener('click', function() {
          loadEntity(Number(button.getAttribute('data-open-institution'))).catch(showEntityError);
        });
      });
    }

    function renderEntityProfile(data) {
      const entity = data.entity || {};
      const isInstitution = entity.entity_type === 'institution';
      const identifiers = Array.isArray(data.identifiers) ? data.identifiers : [];
      const rules = Array.isArray(data.procurementRiskRules) ? data.procurementRiskRules : [];
      const localProfiles = Array.isArray(data.localProfiles) ? data.localProfiles : [];
      const sourceMentions = Array.isArray(data.sourceMentions) ? data.sourceMentions : [];
      const accepted = Array.isArray(data.acceptedIdentityContext) ? data.acceptedIdentityContext : [];
      const staged = Array.isArray(data.privateRelationshipLeadSummary) ? data.privateRelationshipLeadSummary : [];
      const cases = Array.isArray(data.sourcePackCases) ? data.sourcePackCases : [];

      const profile = document.getElementById('entity-profile');
      profile.innerHTML =
        '<div class="profile-header"><div><div class="eyebrow">' + (isInstitution ? 'Public institution profile' : 'Public company profile') + '</div>' +
        '<h2>' + html(entity.entity_name) + '</h2>' +
        '<p>' + (isInstitution
          ? 'Buyer-institution procurement context. Higher signal volume can reflect higher purchasing volume and is not a finding of wrongdoing.'
          : 'Company-level public-record context. This is not a finding of wrongdoing or integrity.') + '</p></div>' +
        '<div class="chips">' + chip(entity.review_priority || 'review priority', 'review') +
        chip(entity.anchor_status || 'anchor status', 'safe') + '</div></div>' +
        reviewMeter(entity.reviewIntensity) +
        '<div class="profile-grid">' +
        metric('Procurement processes', number(entity.total_process_count)) +
        metric('Processes with signals', number(entity.flagged_process_count)) +
        metric('Risk signals', number(entity.total_risk_signals)) +
        metric(isInstitution ? 'Buyer contract value' : 'Supplier contract value', money(isInstitution ? entity.buyer_linked_contract_value : entity.supplier_linked_contract_value)) +
        metric('Local profiles', number(entity.local_profile_count)) +
        metric('Source-pack cases', number(cases.length)) +
        '</div>' +
        '<div class="split">' +
        '<div class="stack">' +
        '<div><h3>Identity anchors</h3><div class="list">' +
        (identifiers.length ? identifiers.map(function(identifier) {
          return item(identifier.scheme, html(identifier.value), [chip('public identifier', 'safe')]);
        }).join('') : item('No displayed public identifiers', 'Centinela may still have internal source context.', [])) +
        '</div></div>' +
        '<div><h3>' + (isInstitution ? 'Institution review note' : 'Accepted identity context') + '</h3><div class="list">' +
        (isInstitution ? item(
          'Institution lenses need context',
          'A ministry or public institution can trigger many signals because it buys more. Compare this profile with budget, service outcomes, procurement category, and process mix before drawing conclusions.',
          [chip('not an accusation', 'limit')]
        ) : accepted.length ? accepted.map(function(match) {
          return item(
            match.external_name || 'Accepted external identity context',
            html(match.rationale || 'Accepted after review with recorded limitations.') +
              '<br><span class="small">Limitations: ' + html(match.limitations || 'See internal review record.') + '</span>',
            [chip(match.candidate_source_key || 'external source', 'safe'), chip(match.decision || 'reviewed', 'review')]
          );
        }).join('') : item('No accepted external identity context displayed', 'Absence here is not proof that no external records exist.', [])) +
        '</div></div>' +
        '<div><h3>Private relationship lead summary</h3><div class="list">' +
        (isInstitution ? item('No public person relationship rows', 'This public institution lens does not expose person-level relationship staging.', [chip('privacy boundary', 'limit')]) : staged.length ? staged.map(function(row) {
          return item(
            row.relation_label || row.relation_type,
            number(row.lead_count) + ' redacted lead records. Public display status: ' + html(row.public_display_status || 'blocked') + '.',
            [chip(row.review_status || 'review status', 'review'), chip('person rows not public', 'limit')]
          );
        }).join('') : item('No staged relationship summary displayed', 'This public page does not expose person-level relationship rows.', [])) +
        '</div></div>' +
        '</div>' +
        '<div class="stack">' +
        '<div><h3>Risk signal families</h3><div class="list">' +
        (rules.length ? rules.map(function(rule) {
          return item(
            rule.code + ': ' + rule.name,
            html(rule.public_description || 'Review signal.') +
              '<br><span class="small">' + number(rule.process_count) + ' linked processes, ' +
              number(rule.signal_count) + ' signal records.</span>',
            [chip(rule.default_severity || 'severity', 'review'), chip(rule.review_lane || 'lane', '')]
          );
        }).join('') : item('No procurement risk rules triggered', 'This does not prove the entity has no risk. It only means current rules did not match linked procurement records.', [])) +
        '</div></div>' +
        '<div><h3>Source context</h3><div class="list">' +
        sourceMentions.map(function(source) {
          return item(
            source.source_key + ' (' + source.role + ')',
            number(source.mention_count) + ' source mentions linked to this entity.',
            [chip('source record context', 'safe')]
          );
        }).join('') +
        '</div></div>' +
        '<div><h3>Local profiles and source packs</h3><div class="list">' +
        localProfiles.slice(0, 4).map(function(profileRow) {
          return item(
            profileRow.source_key + ': ' + (profileRow.profile_title || profileRow.official_name || 'local profile'),
            'Match method: ' + html(profileRow.match_method || 'unknown') +
              '. Review status: ' + html(profileRow.review_status || 'unknown') + '.',
            [chip(profileRow.profile_kind || 'profile', 'safe')]
          );
        }).join('') +
        cases.map(function(caseRow) {
          return item(
            caseRow.title || 'Source pack case',
            number(caseRow.evidence_link_count) + ' evidence links. Publication state: ' +
              html(caseRow.public_review_status || 'internal_only') + '.',
            [chip('source pack', 'safe'), chip(caseRow.public_review_status || 'internal_only', 'limit')]
          );
        }).join('') +
        '</div></div>' +
        '</div>' +
        '</div>';
    }

    function showEntityError(error) {
      document.getElementById('entity-profile').innerHTML =
        '<div class="item error"><strong>Could not load entity profile</strong><p>' + html(error.message) + '</p></div>';
    }

    async function loadOverview() {
      try {
        const data = await getJson('/api/public/overview');
        renderOverview(data);
      } catch (error) {
        document.getElementById('overview-status').innerHTML =
          '<div class="item error"><strong>Could not load public snapshot</strong><p>' + html(error.message) + '</p></div>';
      }
    }

    async function loadRiskStory() {
      try {
        const data = await getJson('/api/public/risk-story');
        renderRiskStory(data);
      } catch (error) {
        document.getElementById('risk-story-status').innerHTML =
          '<div class="item error"><strong>Could not load public risk story</strong><p>' + html(error.message) + '</p></div>';
      }
    }

    async function searchEntities() {
      const query = document.getElementById('entity-query').value.trim();
      const rows = await getJson('/api/public/entities?q=' + encodeURIComponent(query) + '&limit=8');
      renderSearchResults(rows);
    }

    async function searchInstitutions() {
      const query = document.getElementById('institution-query').value.trim();
      const rows = await getJson('/api/public/institutions?q=' + encodeURIComponent(query) + '&limit=8');
      renderInstitutionResults(rows);
    }

    async function loadEntity(entityId) {
      const data = await getJson('/api/public/entities/' + encodeURIComponent(entityId));
      renderEntityProfile(data);
      document.getElementById('entity').scrollIntoView({ behavior: 'smooth' });
    }

    document.getElementById('entity-search').addEventListener('click', function() {
      searchEntities().catch(showEntityError);
    });

    document.getElementById('entity-query').addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        searchEntities().catch(showEntityError);
      }
    });

    document.getElementById('open-demo').addEventListener('click', function() {
      loadEntity(demoEntityId).catch(showEntityError);
    });

    document.getElementById('open-institution-demo').addEventListener('click', function() {
      loadEntity(demoInstitutionId).catch(showEntityError);
    });

    document.getElementById('institution-search').addEventListener('click', function() {
      searchInstitutions().catch(function(error) {
        document.getElementById('institution-results').innerHTML =
          '<div class="item error"><strong>Could not search institutions</strong><p>' + html(error.message) + '</p></div>';
      });
    });

    document.getElementById('institution-query').addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        searchInstitutions().catch(function(error) {
          document.getElementById('institution-results').innerHTML =
            '<div class="item error"><strong>Could not search institutions</strong><p>' + html(error.message) + '</p></div>';
        });
      }
    });

    loadOverview();
    loadRiskStory();
    searchInstitutions().catch(function() {
      return getJson('/api/public/institutions?limit=5').then(renderInstitutionResults);
    });
    searchEntities().then(function(rows) {
      if (Array.isArray(rows) && rows[0] && rows[0].entity_id) {
        return loadEntity(Number(rows[0].entity_id));
      }
      return loadEntity(demoEntityId);
    }).catch(function() {
      return loadEntity(demoEntityId).catch(showEntityError);
    });
  </script>
</body>
</html>`;
}

export async function servePublicSite(options: PublicSiteOptions = {}): Promise<http.Server> {
  const host = options.host ?? process.env.CENTINELA_PUBLIC_HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.CENTINELA_PUBLIC_PORT ?? 8788);

  const server = http.createServer((request, response) => {
    void (async () => {
      if (!request.url) {
        sendJson(response, 400, { error: "Missing request URL." });
        return;
      }

      if (!checkRateLimit(request)) {
        sendJson(response, 429, {
          error: "Too many requests. Please wait before retrying.",
          disclaimer: PUBLIC_DISCLAIMER,
        });
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`);

      if (request.method !== "GET" && request.method !== "HEAD") {
        sendJson(response, 405, { error: "The public web surface is read-only." });
        return;
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        sendHtml(response, 200, request.method === "HEAD" ? "" : publicHtml());
        return;
      }

      if (request.method === "GET" && url.pathname === "/robots.txt") {
        sendText(response, 200, "User-agent: *\nDisallow: /\n");
        return;
      }

      if (request.method === "GET" && url.pathname === "/healthz") {
        sendJson(response, 200, {
          ok: true,
          service: "centinela-public-web",
          disclaimer: PUBLIC_DISCLAIMER,
        });
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/public/")) {
        try {
          const data = await handlePublicApi(url);
          sendJson(response, 200, {
            data,
            meta: {
              generatedAt: new Date().toISOString(),
              disclaimer: PUBLIC_DISCLAIMER,
              publicSurface: true,
            },
          });
        } catch (error) {
          const statusCode =
            error instanceof Error && "statusCode" in error
              ? Number((error as Error & { statusCode?: number }).statusCode)
              : 500;
          sendJson(response, Number.isFinite(statusCode) ? statusCode : 500, {
            error: error instanceof Error ? error.message : String(error),
            statusCode: Number.isFinite(statusCode) ? statusCode : 500,
            disclaimer: PUBLIC_DISCLAIMER,
          });
        }
        return;
      }

      sendJson(response, 404, { error: `Unknown path: ${url.pathname}`, disclaimer: PUBLIC_DISCLAIMER });
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  console.log(`Centinela public web listening at http://${host}:${port}/`);
  console.log(PUBLIC_DISCLAIMER);
  return server;
}
