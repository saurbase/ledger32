const { join } = require('path');
const { chmodSync, existsSync } = require('fs');

exports.default = async function(context) {
  if (context.electronPlatformName !== 'linux') return;
  const sandbox = join(context.appOutDir, 'chrome-sandbox');
  if (existsSync(sandbox)) {
    chmodSync(sandbox, 0o4755);
  }
};
