# GitHub publication

Centinela's source workspace is designed to be published to GitHub while keeping generated investigation artifacts out of both Git and OneDrive-style sync.

## Current target

- Repository name: `Centinela`
- Visibility: public
- Intended content: source code, SQL, methodology docs, memory docs, research notes, skills, and lightweight configuration
- Excluded content: secrets, `.env`, `node_modules/`, `dist/`, generated `data/` outputs, temporary connector files, downloaded bulk ZIP/JSON artifacts

## One-command publication

Run from the repo root:

```powershell
.\scripts\publish-github.ps1
```

The script will:

- require a clean Git working tree
- start `gh auth login` if GitHub CLI is not authenticated
- create public `Centinela` under the authenticated GitHub user unless `-Owner` is supplied
- add `origin` if it is missing
- push the current branch
- add basic civic-tech/procurement topics

To force a specific owner:

```powershell
.\scripts\publish-github.ps1 -Owner Axel-Acosta
```

## Why this path

GitHub should be the durable home for the Centinela source workspace. Runtime data should stay local or in the VPS/Postgres stack so repository history remains fast, clean, and safe to share publicly.

Do not commit credentials, raw data dumps, local database exports, or generated screening artifacts. If Centinela later needs public data releases, use explicit GitHub Releases, object storage, or a documented data registry rather than normal Git commits.
