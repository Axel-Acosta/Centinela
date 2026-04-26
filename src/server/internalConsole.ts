import http from "node:http";
import {
  type ExternalCandidateOptions,
  type ListOptions,
  type QueueOptions,
  type SearchEntitiesOptions,
  getAcceptedExternalMatches,
  getEntityNetwork,
  getEntityProfile,
  getEntityReviewQueue,
  getExternalCandidates,
  getInternalOverview,
  getProcessReviewQueue,
  searchEntities,
} from "../storage/internalApi";

export interface InternalConsoleOptions {
  host?: string;
  port?: number;
}

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
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response: http.ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(body);
}

function parseEntityRoute(pathname: string): { entityId: number; network: boolean } | undefined {
  const match = pathname.match(/^\/api\/entities\/(\d+)(\/network)?$/);
  if (!match) {
    return undefined;
  }

  const entityId = Number(match[1]);
  if (!Number.isInteger(entityId) || entityId <= 0) {
    return undefined;
  }

  return {
    entityId,
    network: Boolean(match[2]),
  };
}

function listOptions(url: URL): ListOptions {
  const limit = numberParam(url, "limit");
  return limit === undefined ? {} : { limit };
}

function searchOptions(url: URL): SearchEntitiesOptions {
  const options: SearchEntitiesOptions = {};
  const q = textParam(url, "q");
  const limit = numberParam(url, "limit");

  if (q !== undefined) {
    options.q = q;
  }

  if (limit !== undefined) {
    options.limit = limit;
  }

  return options;
}

function queueOptions(url: URL): QueueOptions {
  const options: QueueOptions = {};
  const lane = textParam(url, "lane");
  const priority = textParam(url, "priority");
  const limit = numberParam(url, "limit");

  if (lane !== undefined) {
    options.lane = lane;
  }

  if (priority !== undefined) {
    options.priority = priority;
  }

  if (limit !== undefined) {
    options.limit = limit;
  }

  return options;
}

function externalCandidateOptions(url: URL): ExternalCandidateOptions {
  const options: ExternalCandidateOptions = {};
  const reviewStatus = textParam(url, "review_status");
  const secondReviewDecision = textParam(url, "second_review_decision");
  const limit = numberParam(url, "limit");

  if (reviewStatus !== undefined) {
    options.reviewStatus = reviewStatus;
  }

  if (secondReviewDecision !== undefined) {
    options.secondReviewDecision = secondReviewDecision;
  }

  if (limit !== undefined) {
    options.limit = limit;
  }

  return options;
}

function consoleHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Centinela Internal Console</title>
  <style>
    :root {
      --ink: #17201b;
      --muted: #69756e;
      --paper: #f7f0df;
      --panel: rgba(255, 252, 241, 0.88);
      --line: #d6c7a4;
      --accent: #0f6848;
      --accent-2: #9b4f1b;
      --danger-soft: #f3ded2;
      --shadow: 0 18px 42px rgba(50, 40, 20, 0.14);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: var(--ink);
      font-family: Georgia, "Times New Roman", serif;
      background:
        radial-gradient(circle at 18% 12%, rgba(15, 104, 72, 0.16), transparent 28rem),
        radial-gradient(circle at 82% 0%, rgba(155, 79, 27, 0.13), transparent 22rem),
        linear-gradient(135deg, #fcf5e4 0%, #efe2c5 48%, #f8f1df 100%);
      min-height: 100vh;
    }

    main {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 32px 0 54px;
    }

    header {
      display: grid;
      gap: 16px;
      grid-template-columns: 1fr;
      margin-bottom: 24px;
    }

    h1 {
      margin: 0;
      font-size: clamp(2.4rem, 8vw, 5.7rem);
      line-height: 0.9;
      letter-spacing: -0.08em;
    }

    h2 {
      margin: 0 0 14px;
      font-size: 1.05rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--accent);
    }

    p {
      margin: 0;
    }

    .lede {
      max-width: 820px;
      font-size: 1.05rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .guardrail {
      border: 1px solid #c98059;
      background: var(--danger-soft);
      padding: 12px 14px;
      border-radius: 18px;
      color: #60321f;
      box-shadow: var(--shadow);
    }

    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(12, 1fr);
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 18px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .span-12 { grid-column: span 12; }
    .span-7 { grid-column: span 7; }
    .span-5 { grid-column: span 5; }
    .span-4 { grid-column: span 4; }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
    }

    .stat {
      border-left: 3px solid var(--accent);
      background: rgba(255, 255, 255, 0.45);
      padding: 10px 12px;
      border-radius: 14px;
    }

    .stat strong {
      display: block;
      font-size: 1.5rem;
      line-height: 1;
    }

    .stat span {
      color: var(--muted);
      font-size: 0.86rem;
    }

    form {
      display: flex;
      gap: 10px;
      margin-bottom: 14px;
    }

    input {
      flex: 1;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 11px 14px;
      background: #fffaf0;
      font: inherit;
      color: var(--ink);
    }

    button {
      border: 0;
      border-radius: 999px;
      background: var(--accent);
      color: white;
      padding: 11px 16px;
      font: inherit;
      cursor: pointer;
    }

    button.secondary {
      background: #2f4037;
    }

    .list {
      display: grid;
      gap: 10px;
    }

    .item {
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.48);
      border-radius: 18px;
      padding: 12px;
    }

    .item button {
      margin-top: 10px;
      padding: 7px 11px;
      font-size: 0.88rem;
    }

    .kicker {
      color: var(--accent-2);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 4px;
    }

    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      background: #1c241f;
      color: #f6eedc;
      padding: 14px;
      border-radius: 18px;
      max-height: 560px;
      overflow: auto;
    }

    a {
      color: var(--accent);
    }

    @media (max-width: 860px) {
      .span-7, .span-5, .span-4 {
        grid-column: span 12;
      }

      form {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Centinela<br />Internal Console</h1>
      <p class="lede">A local analyst surface for entity search, review queues, accepted enrichment matches, and graph-ready relationship pivots. This is an internal tool, not a public accusation engine.</p>
      <p class="guardrail">All outputs are risk signals, anomalies, identity context, or leads for review. They are not proof of wrongdoing.</p>
    </header>

    <section class="grid">
      <article class="panel span-12">
        <h2>Live Overview</h2>
        <div id="stats" class="stats"></div>
      </article>

      <article class="panel span-7">
        <h2>Entity Search</h2>
        <form id="search-form">
          <input id="search-input" value="CONSULTORA GUARANI" aria-label="Search entities" />
          <button type="submit">Search</button>
        </form>
        <div id="results" class="list"></div>
      </article>

      <article class="panel span-5">
        <h2>Entity / Network Detail</h2>
        <pre id="detail">Search and choose an entity to inspect.</pre>
      </article>

      <article class="panel span-4">
        <h2>Accepted Matches</h2>
        <div id="accepted" class="list"></div>
      </article>

      <article class="panel span-4">
        <h2>Entity Queue</h2>
        <div id="entity-queue" class="list"></div>
      </article>

      <article class="panel span-4">
        <h2>External Candidates</h2>
        <div id="candidates" class="list"></div>
      </article>
    </section>
  </main>

  <script>
    async function getJson(path) {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    }

    function text(value) {
      if (value === null || value === undefined || value === '') {
        return 'n/a';
      }
      return String(value);
    }

    function renderItem(container, title, lines, button) {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = '<div class="kicker">' + text(lines.shift()) + '</div><strong>' + text(title) + '</strong>' +
        lines.map((line) => '<p>' + text(line) + '</p>').join('');
      if (button) {
        item.appendChild(button);
      }
      container.appendChild(item);
    }

    async function loadOverview() {
      const overview = await getJson('/api/overview');
      const stats = document.getElementById('stats');
      const counts = overview.data.counts || {};
      stats.innerHTML = '';
      [
        ['Entities', counts.entities],
        ['Processes', counts.procurement_processes],
        ['Risk signals', counts.procurement_risk_signals],
        ['Relationships', counts.relationship_edges],
        ['Accepted matches', counts.accepted_second_reviews],
        ['External risk signals', counts.external_risk_signals]
      ].forEach(([label, value]) => {
        const stat = document.createElement('div');
        stat.className = 'stat';
        stat.innerHTML = '<strong>' + text(value) + '</strong><span>' + label + '</span>';
        stats.appendChild(stat);
      });
    }

    async function searchEntities(event) {
      if (event) {
        event.preventDefault();
      }
      const q = document.getElementById('search-input').value;
      const payload = await getJson('/api/entities?q=' + encodeURIComponent(q) + '&limit=8');
      const results = document.getElementById('results');
      results.innerHTML = '';
      payload.data.forEach((entity) => {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = 'Open dossier + network';
        button.onclick = () => loadEntity(entity.entity_id);
        renderItem(results, entity.entity_name, [
          entity.entity_type + ' #' + entity.entity_id,
          'lane: ' + text(entity.review_lane),
          'signals: ' + text(entity.total_risk_signals) + ', representatives: ' + text(entity.representative_count)
        ], button);
      });
    }

    async function loadEntity(entityId) {
      const [profile, network] = await Promise.all([
        getJson('/api/entities/' + entityId),
        getJson('/api/entities/' + entityId + '/network?limit=18')
      ]);
      document.getElementById('detail').textContent = JSON.stringify({
        profile: profile.data,
        network: network.data
      }, null, 2);
    }

    async function loadAccepted() {
      const payload = await getJson('/api/accepted-matches?limit=5');
      const container = document.getElementById('accepted');
      container.innerHTML = '';
      payload.data.forEach((match) => renderItem(container, match.entity_name + ' -> ' + match.external_name, [
        match.decision,
        'accepted match ID: ' + text(match.accepted_match_id),
        'limit: ' + text(match.limitations)
      ]));
    }

    async function loadQueues() {
      const [queue, candidates] = await Promise.all([
        getJson('/api/queue/entities?limit=5'),
        getJson('/api/external-candidates?limit=5')
      ]);
      const queueNode = document.getElementById('entity-queue');
      queueNode.innerHTML = '';
      queue.data.forEach((item) => renderItem(queueNode, item.entity_name, [
        item.review_priority + ' / ' + item.review_lane,
        item.lead_question
      ]));
      const candidateNode = document.getElementById('candidates');
      candidateNode.innerHTML = '';
      candidates.data.forEach((item) => renderItem(candidateNode, item.entity_name + ' -> ' + item.external_name, [
        item.suggested_review_status || item.review_status,
        'candidate #' + item.id,
        text(item.review_next_step)
      ]));
    }

    document.getElementById('search-form').addEventListener('submit', searchEntities);
    loadOverview().then(loadAccepted).then(loadQueues).then(() => searchEntities()).catch((error) => {
      document.getElementById('detail').textContent = error.message;
    });
  </script>
</body>
</html>`;
}

async function handleApiRequest(url: URL): Promise<unknown> {
  if (url.pathname === "/api/overview") {
    return getInternalOverview();
  }

  if (url.pathname === "/api/entities") {
    return searchEntities(searchOptions(url));
  }

  const entityRoute = parseEntityRoute(url.pathname);
  if (entityRoute) {
    if (entityRoute.network) {
      return getEntityNetwork(entityRoute.entityId, listOptions(url));
    }

    return getEntityProfile(entityRoute.entityId);
  }

  if (url.pathname === "/api/queue/entities") {
    return getEntityReviewQueue(queueOptions(url));
  }

  if (url.pathname === "/api/queue/processes") {
    return getProcessReviewQueue(queueOptions(url));
  }

  if (url.pathname === "/api/external-candidates") {
    return getExternalCandidates(externalCandidateOptions(url));
  }

  if (url.pathname === "/api/accepted-matches") {
    return getAcceptedExternalMatches(listOptions(url));
  }

  throw new Error(`Unknown API path: ${url.pathname}`);
}

export async function serveInternalConsole(options: InternalConsoleOptions = {}): Promise<void> {
  const host = options.host ?? process.env.CENTINELA_INTERNAL_HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.CENTINELA_INTERNAL_PORT ?? 8787);
  const allowRemote = process.env.CENTINELA_ALLOW_REMOTE_CONSOLE === "true";

  if (!allowRemote && host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      "The internal console is local-only by default. Use --host 127.0.0.1 or set CENTINELA_ALLOW_REMOTE_CONSOLE=true intentionally.",
    );
  }

  const server = http.createServer((request, response) => {
    void (async () => {
      if (!request.url) {
        sendJson(response, 400, { error: "Missing request URL." });
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host ?? `${host}:${port}`}`);

      if (request.method !== "GET") {
        sendJson(response, 405, { error: "Only GET requests are supported in the first internal console slice." });
        return;
      }

      if (url.pathname === "/" || url.pathname === "/console") {
        sendHtml(response, 200, consoleHtml());
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        try {
          const data = await handleApiRequest(url);
          sendJson(response, 200, {
            data,
            meta: {
              generatedAt: new Date().toISOString(),
              disclaimer:
                "Centinela outputs are risk signals, anomalies, identity context, or leads for review. They are not proof of wrongdoing.",
            },
          });
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }

      sendJson(response, 404, { error: `Unknown path: ${url.pathname}` });
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  console.log(`Centinela internal console listening at http://${host}:${port}/`);
  console.log("Local-only analyst surface. Outputs are leads and identity context, not proof of wrongdoing.");
}
