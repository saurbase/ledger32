const { join } = require('path');
const { chmodSync, existsSync, cpSync } = require('fs');

exports.default = async function(context) {
  // electron-builder never copies `node_modules` folders via extraResources,
  // but the Next.js standalone server needs its traced node_modules to run.
  // Copy them into the packaged app ourselves.
  const src = join(context.packager.projectDir, '.next', 'standalone', 'node_modules');
  const resourcesDir =
    context.electronPlatformName === 'darwin'
      ? join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : join(context.appOutDir, 'resources');
  const dest = join(resourcesDir, 'app', '.next', 'standalone', 'node_modules');
  if (!existsSync(src)) {
    throw new Error(`afterPack: ${src} not found — run "next build" first`);
  }
  cpSync(src, dest, { recursive: true, dereference: true });
  console.log(`  • afterPack: copied standalone node_modules → ${dest}`);

  if (context.electronPlatformName !== 'linux') return;
  const sandbox = join(context.appOutDir, 'chrome-sandbox');
  if (existsSync(sandbox)) {
    chmodSync(sandbox, 0o4755);
  }
};
