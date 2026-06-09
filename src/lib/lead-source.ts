export type LeadSourceId =
  | "tiktok"
  | "instagram"
  | "twitter"
  | "youtube"
  | "facebook"
  | "kwai"
  | "telegram"
  | "organic"
  | "unknown";

export const LEAD_SOURCES: LeadSourceId[] = [
  "tiktok",
  "instagram",
  "twitter",
  "youtube",
  "facebook",
  "kwai",
  "telegram",
  "organic",
  "unknown"
];

const LABELS: Record<LeadSourceId, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "Twitter / X",
  youtube: "YouTube",
  facebook: "Facebook",
  kwai: "Kwai",
  telegram: "Telegram",
  organic: "Direto",
  unknown: "Não informado"
};

const EMOJI: Record<LeadSourceId, string> = {
  tiktok: "🎵",
  instagram: "📸",
  twitter: "🐦",
  youtube: "▶️",
  facebook: "📘",
  kwai: "🎬",
  telegram: "✈️",
  organic: "🔗",
  unknown: "❓"
};

/** Payload do /start: tiktok, src_instagram, ig, tt, etc. */
export function parseStartPayload(payload?: string | null): LeadSourceId | null {
  if (!payload?.trim()) return null;
  return normalizeSource(payload.trim());
}

/** Detecta origem na primeira mensagem do lead. */
export function detectSourceFromText(text: string): LeadSourceId | null {
  const t = text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (/\b(tiktok|tik tok|tt)\b|#tiktok|vim do tiktok/.test(t)) return "tiktok";
  if (/\b(instagram|insta|ig)\b|#insta|vim do insta/.test(t)) return "instagram";
  if (/\b(twitter|x\.com)\b|#twitter|vim do twitter/.test(t)) return "twitter";
  if (/\b(youtube|yt)\b|#youtube|vim do youtube/.test(t)) return "youtube";
  if (/\b(facebook|face|fb)\b|#facebook/.test(t)) return "facebook";
  if (/\b(kwai)\b/.test(t)) return "kwai";
  if (/\b(telegram|vim do telegram)\b/.test(t)) return "telegram";
  if (/vim (do|pelo|da)|cheguei (do|pelo|da)|link (do|da)/.test(t)) {
    return normalizeSource(t);
  }
  return null;
}

export function normalizeSource(raw: string): LeadSourceId {
  const s = raw
    .toLowerCase()
    .replace(/^src[_-]?/, "")
    .replace(/^utm[_-]?/, "")
    .replace(/[^a-z0-9]+/g, "");

  if (["tiktok", "tt", "tiktokads"].includes(s)) return "tiktok";
  if (["instagram", "insta", "ig", "instgram"].includes(s)) return "instagram";
  if (["twitter", "x", "tw"].includes(s)) return "twitter";
  if (["youtube", "yt"].includes(s)) return "youtube";
  if (["facebook", "fb", "meta"].includes(s)) return "facebook";
  if (["kwai"].includes(s)) return "kwai";
  if (["telegram", "tg"].includes(s)) return "telegram";
  if (["organic", "direto", "link", "bio"].includes(s)) return "organic";
  if (s.length >= 2 && LEAD_SOURCES.includes(s as LeadSourceId)) return s as LeadSourceId;
  return "unknown";
}

export function sourceLabel(id: string) {
  const key = (LEAD_SOURCES.includes(id as LeadSourceId) ? id : "unknown") as LeadSourceId;
  return LABELS[key];
}

export function sourceEmoji(id: string) {
  const key = (LEAD_SOURCES.includes(id as LeadSourceId) ? id : "unknown") as LeadSourceId;
  return EMOJI[key];
}

export function trackingLink(botUsername: string, source: LeadSourceId) {
  const user = botUsername.replace(/^@/, "");
  const payload = source === "organic" ? "bio" : source;
  return `https://t.me/${user}?start=${payload}`;
}
