// =============================================================================
// Ledger — Electron main process
// -----------------------------------------------------------------------------
// Wraps the Next.js app in a native desktop window.
//
// Strategy:
//  - If a Next.js server is already reachable at http://127.0.0.1:11891, use it.
//  - Otherwise, spawn `bun run dev` (or `npx next dev`) and wait for it.
//  - Then open a BrowserWindow pointed at the app.
//
// This makes `bun run electron` a single command that brings up the whole
// desktop app on a fresh Linux machine.
// =============================================================================

const { app, BrowserWindow, Menu, shell } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = process.env.LEDGER_PORT || "11891";
const DEV_URL = process.env.LEDGER_URL || `http://127.0.0.1:${PORT}`;
const PROJECT_ROOT = path.join(__dirname, "..");

/** Child process for the Next.js dev server, if we started it ourselves. */
let spawnedServer = null;
/** Whether we're shutting down so we don't surface error dialogs. */
let shuttingDown = false;
let mainWindow = null;

// ---------------------------------------------------------------------------
// Dev server lifecycle
// ---------------------------------------------------------------------------

/** Resolve the command + args used to start the Next.js server.
 *  In a packaged app we run the standalone production server; in dev we run
 *  `bun run dev` (or `npx next dev`) for hot reload. */
function resolveServerCommand() {
  if (app.isPackaged) {
    // Standalone server lives under resourcesPath/app/.next/standalone
    const standaloneDir = path.join(
      process.resourcesPath,
      "app",
      ".next",
      "standalone"
    );
    return {
      cmd: process.execPath, // the bundled electron/node runtime
      args: [path.join(standaloneDir, "server.js")],
      cwd: standaloneDir,
    };
  }
  // Dev: prefer bun (the project's runtime), fall back to npx next.
  if (fs.existsSync(path.join(PROJECT_ROOT, "bun.lock"))) {
    return { cmd: "bun", args: ["run", "dev"], cwd: PROJECT_ROOT };
  }
  return { cmd: "npx", args: ["next", "dev", "-p", PORT], cwd: PROJECT_ROOT };
}

function isServerUp(url = DEV_URL) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function spawnDevServer() {
  const { cmd, args, cwd } = resolveServerCommand();
  console.log(`[electron] Starting Next.js server: ${cmd} ${args.join(" ")}`);
  const child = spawn(cmd, args, {
    cwd: cwd || PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT,
      // Bind to loopback only. Next.js standalone reads HOSTNAME, which on
      // Windows is often the machine name, making localhost unreachable.
      HOSTNAME: "127.0.0.1",
      // In a packaged app, persist the local JSON store in the OS user-data
      // folder (the app bundle is read-only).
      LEDGER_DATA_DIR: app.isPackaged ? app.getPath("userData") : undefined,
      // Electron's runtime satisfies Node for the standalone server.
      ELECTRON_RUN_AS_NODE: app.isPackaged ? "1" : undefined,
    },
    // A shell is only needed in dev on Windows to resolve `bun`/`npx` shims.
    // In the packaged app we spawn the Electron executable directly: going
    // through cmd.exe would split paths such as "C:\Program Files\Ledger".
    shell: !app.isPackaged && process.platform === "win32",
  });
  child.stdout.on("data", (d) =>
    process.stdout.write(`[next] ${d.toString().trimEnd()}\n`)
  );
  child.stderr.on("data", (d) =>
    process.stderr.write(`[next] ${d.toString().trimEnd()}\n`)
  );
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.log(`[electron] Next.js server exited (code ${code}).`);
    }
  });
  return child;
}

async function waitForServer(maxAttempts = 90, intervalMs = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isServerUp()) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function ensureServer() {
  if (await isServerUp()) {
    console.log("[electron] Detected running Next.js server — reusing it.");
    return true;
  }
  spawnedServer = spawnDevServer();
  const up = await waitForServer();
  if (!up) {
    console.error(
      `[electron] Could not reach Next.js at ${DEV_URL} after waiting.`
    );
  }
  return up;
}

// ---------------------------------------------------------------------------
// Window + menu
// ---------------------------------------------------------------------------

function createWindow() {
  const iconPath = path.join(__dirname, "icon.png");

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#ffffff",
    title: "Ledger — Double-Entry Bookkeeping",
    icon: iconPath,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Debug helper: LEDGER_SCREENSHOT=path.png captures the window after load.
  if (process.env.LEDGER_SCREENSHOT) {
    mainWindow.webContents.on("did-finish-load", () => {
      setTimeout(async () => {
        try {
          const image = await mainWindow.webContents.capturePage();
          fs.writeFileSync(process.env.LEDGER_SCREENSHOT, image.toPNG());
          console.log(
            `[electron] Screenshot saved → ${process.env.LEDGER_SCREENSHOT}`
          );
        } catch (e) {
          console.error("[electron] Screenshot failed:", e);
        }
        if (process.env.LEDGER_QUIT_AFTER_SCREENSHOT) app.quit();
      }, 4500);
    });
  }

  // Show an explanatory page instead of a blank window if the app can't load.
  mainWindow.webContents.on(
    "did-fail-load",
    (_e, code, desc, url, isMainFrame) => {
      if (!isMainFrame || code === -3 /* ERR_ABORTED */) return;
      const html = `<body style="font-family:system-ui;padding:40px;color:#222">
        <h2>Ledger could not start</h2>
        <p>The local server at <code>${DEV_URL}</code> did not respond
        (${desc}).</p>
        <p>Make sure no other program is using that port, then restart Ledger.</p>
        </body>`;
      mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
      if (!mainWindow.isVisible()) mainWindow.show();
    }
  );

  mainWindow.loadURL(DEV_URL).catch((err) => {
    console.error("[electron] Failed to load app:", err);
  });

  // Open external http(s) links in the user's browser, not a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/** Send a shortcut action to the renderer via IPC. */
function sendShortcut(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("shortcut", action);
  }
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Journal Entry…",
          accelerator: "CmdOrCtrl+N",
          click: () => sendShortcut({ type: "new-entry" }),
        },
        {
          label: "New Account…",
          accelerator: "CmdOrCtrl+B",
          click: () => sendShortcut({ type: "new-account" }),
        },
        { type: "separator" },
        {
          label: "Export Report to PDF…",
          accelerator: "CmdOrCtrl+E",
          click: () => sendShortcut({ type: "export-pdf" }),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Go",
      submenu: [
        {
          label: "Dashboard",
          accelerator: "CmdOrCtrl+1",
          click: () => sendShortcut({ type: "navigate", view: "dashboard" }),
        },
        {
          label: "Chart of Accounts",
          accelerator: "CmdOrCtrl+2",
          click: () => sendShortcut({ type: "navigate", view: "accounts" }),
        },
        {
          label: "Journal Entries",
          accelerator: "CmdOrCtrl+3",
          click: () => sendShortcut({ type: "navigate", view: "journal" }),
        },
        {
          label: "Reports",
          accelerator: "CmdOrCtrl+4",
          click: () => sendShortcut({ type: "navigate", view: "reports" }),
        },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+5",
          click: () => sendShortcut({ type: "navigate", view: "settings" }),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        {
          label: "Command Palette…",
          accelerator: "CmdOrCtrl+K",
          click: () => sendShortcut({ type: "palette" }),
        },
        {
          label: "Toggle Dark Mode",
          accelerator: "CmdOrCtrl+J",
          click: () => sendShortcut({ type: "theme" }),
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Keyboard Shortcuts",
          accelerator: "CmdOrCtrl+/",
          click: () => sendShortcut({ type: "help" }),
        },
        {
          label: "About Ledger",
          click: () => {
            const { dialog } = require("electron");
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Ledger",
              message: "Ledger — Double-Entry Bookkeeping",
              detail:
                "A minimal double-entry accounting app.\n\nBuilt with Next.js, Electron & shadcn/ui.",
              icon: path.join(__dirname, "icon.png"),
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

// Ensure only one instance of the desktop app runs.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();
    await ensureServer();
    createWindow();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      ensureServer().then(createWindow);
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    shuttingDown = true;
    if (spawnedServer && !spawnedServer.killed) {
      try {
        // SIGTERM lets Next clean up; escalate if needed.
        spawnedServer.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }
  });

  process.on("exit", () => {
    if (spawnedServer && !spawnedServer.killed) {
      spawnedServer.kill("SIGKILL");
    }
  });
}
