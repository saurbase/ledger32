# Ledger — Electron desktop app

Run the Ledger double-entry bookkeeping app as a native desktop window on
Linux (also works on macOS / Windows with minor path differences).

## Quick start (development)

From the project root:

```bash
bun install          # installs Next.js + Electron + electron-builder
bun run electron     # opens the desktop window
```

`bun run electron` does the right thing automatically:

1. It checks whether the Next.js dev server is already running on
   `http://127.0.0.1:11891`.
2. If not, it spawns `bun run dev` for you and waits for it to be ready.
3. It then opens a native `BrowserWindow` showing the app.

So a single command brings up the whole desktop app. While it runs you get
full hot-reload of the Next.js code, just like in the browser.

> Tip: you can also keep `bun run dev` running in one terminal and
> `bun run electron` in another — Electron will detect and reuse the
> existing server.

## Keyboard shortcuts

The app is fully keyboard-driven. All shortcuts are wired into the native menu
bar (with accelerator hints) and also work in the web preview.

| Shortcut | Action |
| --- | --- |
| `Ctrl+1`–`Ctrl+5` | Jump to Dashboard / Accounts / Journal / Reports / Settings |
| `Ctrl+K` | Open the **command palette** (search & run any command) |
| `Ctrl+N` | New journal entry (navigates + opens the form) |
| `Ctrl+B` | New account (navigates + opens the form) |
| `Ctrl+E` | Export the current report to PDF |
| `Ctrl+J` | Toggle light / dark theme |
| `Ctrl+/` | Show all keyboard shortcuts |

> On macOS use `⌘` instead of `Ctrl`. The command palette (`Ctrl+K`) works
> even while typing in a field; all other shortcuts are ignored inside inputs
> so they don't hijack data entry.

The same shortcuts appear in the menu bar: **File** (New / Export), **Go**
(navigation), **View** (palette / theme), **Help** (shortcuts).

## Other menu items

- **View → Reload / Force Reload** — refresh the app
- **View → Toggle DevTools** — open Chromium dev tools
- **View → Zoom** — adjust text size
- **File → Quit** — close the app (also stops the dev server if Electron
  started it)

## Building a distributable for Linux

The app is preconfigured with `electron-builder` to produce a portable
**AppImage** and a **.deb** installer.

```bash
bun run electron:build
```

This runs the Next.js production build, bundles the standalone server into
the Electron app, and outputs installers to `dist-electron/`:

```
dist-electron/
├─ Ledger-1.0.0-x86_64.AppImage     ← portable, just chmod +x and run
└─ ledger_1.0.0_amd64.deb           ← install with `sudo dpkg -i`
```

### Running the AppImage

```bash
chmod +x Ledger-1.0.0-x86_64.AppImage
./Ledger-1.0.0-x86_64.AppImage
```

### Installing the .deb

```bash
sudo dpkg -i ledger_1.0.0_amd64.deb
# fix any missing system libs:
sudo apt-get install -f
# then launch from your app menu, or:
ledger
```

## Where data is stored

| Mode        | Local JSON store location                            |
| ----------- | --------------------------------------------------- |
| Development | `<project>/data/ledger.json`                        |
| Packaged    | `%APPDATA%\Ledger\ledger.json` (Windows), `~/.config/Ledger/ledger.json` (Linux) |

To store data in **Supabase** or a **PostgreSQL** database instead, use
**Settings → Data source** in the app. The connection settings are saved as
`config.json` in the same folder as `ledger.json`.

## Files

```
electron/
├─ main.cjs       # main process: spawns Next server, creates window, menu
├─ preload.cjs    # secure context bridge (contextIsolation on)
└─ icon.png       # window / taskbar icon (black / white / orange brand)
build/
└─ icon.png       # 512×512 icon used by electron-builder for the AppImage
```

## Troubleshooting

- **Blank window / "Could not reach Next.js"** — make sure nothing else is
  using port 11891, then relaunch. Electron logs the Next.js server output
  inline, prefixed with `[next]`.
- **AppImage won't run** — on some distros you need FUSE:
  `sudo apt install libfuse2`.
- **Dark dbus errors in the terminal** — harmless; they come from the
  sandbox trying to talk to the system bus.
