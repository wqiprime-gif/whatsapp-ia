/**
 * Resolve URLs de mídia (/seed-audios, /uploads, http) para caminho local.
 * Faz cache via painel (PANEL_URL) quando o arquivo não está no disco do motor.
 */
const fs = require("fs");
const path = require("path");
const axios = require("axios");

function resolveMediaLocalPathSync(url, options = {}) {
  const clean = String(url || "").trim();
  if (!clean) return null;
  if (fs.existsSync(clean)) return clean;

  if (clean.startsWith("data:")) {
    const match = clean.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const cacheDir = path.join(options.instancesDataDir || path.join(__dirname, ".cache"), "media-cache");
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      const ext = match[1].includes("png") ? ".png" : match[1].includes("webp") ? ".webp" : ".jpg";
      const out = path.join(cacheDir, `data-sync${ext}`);
      if (!fs.existsSync(out)) fs.writeFileSync(out, Buffer.from(match[2], "base64"));
      return out;
    }
  }

  const instancesDataDir = options.instancesDataDir || "";
  const telegramDir = options.telegramDir || path.join(__dirname, "..", "telegram");
  const rootDir = options.rootDir || path.join(__dirname, "..");

  if (clean.includes("/seed-audios/")) {
    const seedName = path.basename(clean.split("?")[0]);
    const candidates = [
      path.join(rootDir, "assets", "seed-audios", seedName),
      path.join(rootDir, "hotbot", seedName),
      path.join(telegramDir, "..", "hotbot", seedName),
      path.join(process.cwd(), "assets", "seed-audios", seedName),
      path.join(process.cwd(), "hotbot", seedName)
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
  }

  const baseName = path.basename(clean.split("?")[0]);
  const uploadsDir = process.env.UPLOADS_DIR;
  const candidates = [];
  if (uploadsDir) {
    candidates.push(path.join(uploadsDir, baseName));
    if (clean.includes("/uploads/")) {
      candidates.push(path.join(uploadsDir, clean.split("/uploads/")[1].split("?")[0]));
    }
  }
  if (instancesDataDir) {
    candidates.push(path.join(instancesDataDir, "uploads", baseName));
  }
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

async function resolveMediaLocalPath(url, options = {}) {
  const clean = String(url || "").trim();
  if (!clean) return null;

  if (clean.startsWith("data:")) {
    const match = clean.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const cacheDir = path.join(options.instancesDataDir || path.join(__dirname, ".cache"), "media-cache");
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      const ext = match[1].includes("png") ? ".png" : match[1].includes("webp") ? ".webp" : ".jpg";
      const out = path.join(cacheDir, `data-${Date.now()}${ext}`);
      fs.writeFileSync(out, Buffer.from(match[2], "base64"));
      return out;
    }
  }

  const local = resolveMediaLocalPathSync(url, options);
  if (local) return local;

  const panelUrl = String(process.env.PANEL_URL || "").replace(/\/$/, "");
  if (!panelUrl) return null;

  const fetchUrl = clean.startsWith("http://") || clean.startsWith("https://")
    ? clean
    : `${panelUrl}${clean.startsWith("/") ? clean : `/${clean}`}`;

  const cacheDir = path.join(options.instancesDataDir || path.join(__dirname, ".cache"), "media-cache");
  const name = path.basename(clean.split("?")[0]).replace(/[^a-zA-Z0-9._-]/g, "-");
  const cached = path.join(cacheDir, name);

  try {
    if (fs.existsSync(cached) && fs.statSync(cached).size > 0) return cached;
    const res = await axios.get(fetchUrl, {
      responseType: "arraybuffer",
      timeout: 45000,
      validateStatus: () => true
    });
    if (res.status >= 400 || !res.data || !res.data.byteLength) {
      console.warn(`[media-resolve] HTTP ${res.status} ao buscar ${fetchUrl}`);
      return null;
    }
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cached, Buffer.from(res.data));
    return cached;
  } catch (e) {
    console.warn(`[media-resolve] falha ${fetchUrl}:`, e?.message || e);
    return null;
  }
}

module.exports = { resolveMediaLocalPath, resolveMediaLocalPathSync };
