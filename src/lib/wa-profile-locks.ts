import fs from "node:fs";
import path from "node:path";

const LOCK_NAMES = new Set([
  "SingletonLock",
  "SingletonCookie",
  "SingletonSocket",
  "lockfile",
  "DevToolsActivePort",
  "chrome_shutdown_ms.txt"
]);

export function cleanChromiumProfileLocks(sessionDir: string): number {
  if (!sessionDir || !fs.existsSync(sessionDir)) return 0;
  let removed = 0;

  function walk(dir: string, depth: number) {
    if (depth > 5) return;
    let entries: fs.Dirent[];
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
      if (LOCK_NAMES.has(ent.name) || ent.name.endsWith(".lock")) {
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
    console.log(`[wa-web] Locks Chromium removidos (${removed}) em ${sessionDir}`);
  }
  return removed;
}
