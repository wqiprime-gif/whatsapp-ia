const fs = require('fs');
const path = require('path');

const LOCK_NAMES = new Set([
  'SingletonLock',
  'SingletonCookie',
  'SingletonSocket',
  'lockfile',
  'DevToolsActivePort',
  'chrome_shutdown_ms.txt'
]);

/** Remove locks do Chromium que impedem relançamento após restore de backup. */
function cleanChromiumProfileLocks(sessionDir) {
  if (!sessionDir || !fs.existsSync(sessionDir)) return 0;
  let removed = 0;

  function walk(dir, depth) {
    if (depth > 5) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (LOCK_NAMES.has(ent.name) || ent.name.endsWith('.lock')) {
        try {
          fs.rmSync(full, { force: true });
          removed++;
        } catch {
          // ignore
        }
      }
    }
  }

  walk(sessionDir, 0);
  if (removed > 0) {
    console.log(`🧹 Locks Chromium removidos (${removed}) em ${sessionDir}`);
  }
  return removed;
}

module.exports = { cleanChromiumProfileLocks, LOCK_NAMES };
