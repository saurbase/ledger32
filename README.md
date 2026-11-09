# Ledger

A minimal **double-entry bookkeeping** app that runs in the browser or as a native desktop app (Windows & Linux).

Built with Next.js 16, React 19, Tailwind CSS, shadcn/ui and Electron.

![Dashboard](screenshots/dashboard.png)

## Features

- **Chart of Accounts**: assets, liabilities, equity, revenue and expenses
- **Journal Entries**: balanced debit/credit entries, plus one-click reversals
- **Reports**: Trial Balance, General Ledger, Income Statement and Balance Sheet, with PDF export
- **Dashboard**: a snapshot of your books at a glance
- **Keyboard-driven**: command palette (`Ctrl+K`) and shortcuts for everything
- **Light / dark theme**
- **Storage**: a local JSON file by default; you can optionally sync to Supabase

## Download

Prebuilt installers are published automatically on every push to `main`:

- **[Releases](../../releases)**: download `Ledger-Setup-<version>-x64.exe` (Windows) or `ledger_<version>_amd64.deb` (Linux)
- **[Packages](../../pkgs/container/ledger-desktop)**: the same installers as a container image on `ghcr.io` (see [CI/CD](#cicd))

**Windows:** run the `.exe` installer. It is not code-signed yet, so SmartScreen may warn you. Choose *More info → Run anyway*.

**Linux (Debian/Ubuntu):**

```bash
sudo dpkg -i ledger_<version>_amd64.deb
sudo apt-get install -f   # pulls in any missing system libraries
ledger
```

## Development

### Prerequisites

- [Bun](https://bun.sh) 1.3+ (the project's package manager and runtime)
- Node.js 22+ (used by Electron tooling)

### Install

```bash
bun install
```

`electron` is listed in `trustedDependencies`, so `bun install` also downloads the Electron binary (about 150 MB).

### Run the web app

```bash
bun run dev                 # http://localhost:3000
```

If port 3000 is already taken (for example by a WSL service), use another port:

```bash
bunx next dev -p 3010
```

### Run the desktop app

```bash
bun run electron
```

Electron reuses a dev server already running on `http://localhost:3000`. If none is running, it starts `bun run dev` itself. To point it at a server on another port:

```bash
# bash
LEDGER_URL=http://localhost:3010 bunx electron .
# PowerShell
$env:LEDGER_URL="http://localhost:3010"; bunx electron .
```

See [electron/README.md](electron/README.md) for keyboard shortcuts and other desktop details.

## Data storage

| Mode | Where data lives |
|---|---|
| Web / dev | `./data/ledger.json` |
| Installed desktop app | the OS user-data folder (e.g. `%APPDATA%\Ledger` on Windows, `~/.config/Ledger` on Linux) |
| Supabase (optional) | your Supabase project |

To use Supabase:

1. Run [`supabase/schema.sql`](supabase/schema.sql) in your project's SQL editor.
2. Create a `.env` file in the project root:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
   ```

3. Restart the app. The header badge changes from **Local store** to Supabase.

`.env` and `data/` are gitignored.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Next.js dev server on port 3000 |
| `bun run build` | Production build (standalone server in `.next/standalone`) |
| `bun run start` | Run the production build |
| `bun run lint` | ESLint |
| `bun run electron` | Launch the desktop app |
| `bun run electron:build` | Build Linux installers (AppImage + .deb) into `dist-electron/` |
| `bun run electron:build:win` | Build the Windows installer (.exe) into `dist-electron/` |

## API

The UI talks to a small REST API under `/api`:

| Route | Purpose |
|---|---|
| `GET/POST/DELETE /api/accounts`, `PUT/DELETE /api/accounts/:id` | Chart of accounts |
| `GET/POST /api/journal`, `DELETE /api/journal/:id` | Journal entries |
| `POST /api/journal/:id/reverse` | Reverse an entry |
| `GET /api/reports/:type` | `trial-balance`, `general-ledger`, `income-statement`, `balance-sheet`, `summary` |
| `POST /api/seed` | Load a sample chart of accounts |
| `POST /api/reset` | Clear all data |
| `GET /api/status` | Storage backend in use (local vs Supabase) |

## CI/CD

[`.github/workflows/desktop-build.yml`](.github/workflows/desktop-build.yml) runs on every push to `main`, on `v*` tags, or when started manually:

1. **Build**: two parallel jobs build the Next.js standalone server and package it with electron-builder:
   - `windows-latest` → `Ledger-Setup-<version>-x64.exe`
   - `ubuntu-latest` → `ledger_<version>_amd64.deb`
2. **Publish**:
   - **GitHub Release**: a push to `main` creates a pre-release `v<version>-build.<run>`; pushing a tag such as `v1.2.0` creates a full release.
   - **GitHub Packages**: pushes `ghcr.io/<owner>/ledger-desktop:<tag>` and `:latest`, an image containing only the installers under `/installers`.

To get the installers from the package:

```bash
docker create --name ledger ghcr.io/saurbase/ledger-desktop:latest x
docker cp ledger:/installers ./ledger-installers && docker rm ledger
```

New packages are **private** by default. To change that, open *Packages → ledger-desktop → Package settings*.

To cut a versioned release, bump `version` in `package.json`, then:

```bash
git tag v1.1.0
git push origin v1.1.0
```

## Project structure

```
src/
  app/                 Next.js app router (page + /api routes)
  components/ledger/   App shell and views (dashboard, accounts, journal, reports, settings)
  components/ui/       shadcn/ui components
  lib/                 Store (local JSON / Supabase), accounting logic, helpers
electron/              Electron main + preload process, app icon
supabase/schema.sql    Database schema for the optional Supabase backend
.github/workflows/     CI pipeline that builds and publishes the installers
```

## Known limitations

- The installed desktop app serves its UI on a fixed port (3000). If another service already answers on that port, the app connects to it instead of starting its own server.
- Installers are not code-signed.
