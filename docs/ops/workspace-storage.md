# Workspace storage policy

Centinela separates source code from generated investigation artifacts.

## Rule

- Source code, SQL, methodology docs, memory docs, and lightweight configuration live in the project workspace and can be tracked with Git/GitHub.
- Generated raw data, normalized bundles, reports, downloaded ZIP files, and temporary connector outputs live outside the workspace by default.
- Case evidence export artifacts are generated reports, so they also live outside the workspace by default.
- PostgreSQL on the VPS remains the canonical query store for operational data.

## Default local runtime location

When `CENTINELA_OUTPUT_DIR` is blank or unset, Centinela writes generated files to:

```text
C:\Users\<user>\AppData\Local\Centinela\data
```

On non-Windows systems, the fallback is:

```text
~/.centinela/data
```

This keeps large generated files out of OneDrive-style sync folders and out of Git.

## Current local layout

- Workspace source root: `C:\Users\Axeld\Dev\Centinela`
- Runtime data root: `C:\Users\Axeld\AppData\Local\Centinela\data`
- Archived root temporary files: `C:\Users\Axeld\AppData\Local\Centinela\archive`

## GitHub strategy

GitHub should track:

- `src/`
- `sql/`
- `docs/`
- `memory/`
- `research/`
- `scripts/`
- `skills/`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `.env.example`
- `.gitignore`

GitHub should not track:

- `.env`
- secrets
- `node_modules/`
- `dist/`
- `data/` generated outputs
- root `tmp*` files
- downloaded ZIPs

## Why not commit generated data

- DNCP annual raw/normalized outputs can be hundreds of MB.
- These files churn during connector runs and overload file sync tools.
- The VPS database and source URLs preserve operational evidence better than syncing large local JSON/ZIP artifacts through OneDrive.
- If durable public datasets are needed later, use explicit releases, object storage, or a dedicated data registry rather than normal Git history.

## Command compatibility

Commands that write reports or raw/normalized artifacts now write to the runtime data root unless `CENTINELA_OUTPUT_DIR` is explicitly set.

Case evidence exports are written under:

```text
<CENTINELA_OUTPUT_DIR>\reports\cases\<case-key>\
```

Use:

```bash
npm run database:case-evidence-export -- --case-id <id> --public-only false
```

`database:load-bundle` still accepts old-style paths like:

```bash
npm run database:load-bundle -- --file data/normalized/paraguay/dncp-2026-bulk-processes.json
```

If the file is no longer in the workspace `data/` folder, Centinela also looks under the configured runtime data root.

## When to override

Set `CENTINELA_OUTPUT_DIR` only when you intentionally want a different artifact location, for example an external drive or a dedicated non-sync research folder.

Do not point it at OneDrive unless the run is small and you intentionally want sync.

## Publication helper

Use `scripts/publish-github.ps1` to create or connect the public GitHub repository and push the clean source workspace. See `docs/ops/github-publication.md`.
