import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_ARCHIVE_BYTES = 80 * 1024 * 1024;

export async function tarDirectoryToBuffer(dir: string): Promise<Buffer> {
  const { stdout } = await execFileAsync("tar", ["-czf", "-", "-C", dir, "."], {
    maxBuffer: MAX_ARCHIVE_BYTES,
    encoding: "buffer"
  });
  const buf = stdout as Buffer;
  if (buf.length > MAX_ARCHIVE_BYTES) {
    throw new Error(`Backup da sessão excede ${MAX_ARCHIVE_BYTES} bytes`);
  }
  return buf;
}

export async function extractTarBufferToDir(archive: Buffer, destDir: string): Promise<void> {
  if (archive.length > MAX_ARCHIVE_BYTES) {
    throw new Error(`Arquivo de backup excede limite de ${MAX_ARCHIVE_BYTES} bytes`);
  }
  const tmp = path.join(os.tmpdir(), `wa-session-${Date.now()}-${Math.random().toString(36).slice(2)}.tar.gz`);
  await fs.writeFile(tmp, archive);
  try {
    await fs.mkdir(destDir, { recursive: true });
    await execFileAsync("tar", ["-xzf", tmp, "-C", destDir], { maxBuffer: MAX_ARCHIVE_BYTES });
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
}
