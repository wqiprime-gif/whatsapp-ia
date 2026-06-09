import type { NamedAudio } from "../bots.js";

const STOP_WORDS = new Set([
  "amor",
  "bb",
  "bebe",
  "oi",
  "oii",
  "oie",
  "ola",
  "eae",
  "bem",
  "tudo",
  "vc",
  "voce",
  "safada",
  "gata",
  "delicia",
  "linda",
  "gostosa",
  "quer",
  "saber",
  "tabela"
]);

const SLUG_ALIASES: Record<string, string[]> = {
  naosou_fake: ["nao_sou_fake", "naosoufake", "eu_nao_sou_fake"],
  nao_sou_fake: ["naosou_fake", "naosoufake", "eu_nao_sou_fake"]
};

export function normalizeAudioKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSlug(value: string) {
  return normalizeAudioKey(value).replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

export function deriveSlugFromLabel(label: string) {
  return normalizeSlug(label);
}

export function audioSlug(item: NamedAudio) {
  return normalizeSlug(item.slug || deriveSlugFromLabel(item.label));
}

/** Somente gatilhos explícitos — NÃO usa o texto do áudio */
export function audioTriggers(item: NamedAudio): string[] {
  const raw = item.triggers?.trim() || item.keywords?.trim() || "";
  return raw
    .split(",")
    .map((k) => normalizeAudioKey(k))
    .filter((k) => k.length >= 4 && !STOP_WORDS.has(k));
}

function scoreTriggerMatch(norm: string, trigger: string): number {
  if (trigger.length < 4 || STOP_WORDS.has(trigger)) return 0;

  const words = trigger.split(" ").filter(Boolean);
  if (words.length === 1 && trigger.length < 12) return 0;

  if (norm === trigger) return 100;
  if (norm.includes(trigger)) return 70 + Math.min(trigger.length, 25);

  const triggerWords = words.filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  if (triggerWords.length === 0) return 0;

  const userWords = norm.split(" ").filter(Boolean);
  let overlap = 0;
  for (const tw of triggerWords) {
    if (userWords.some((uw) => uw.includes(tw) || tw.includes(uw))) overlap++;
  }
  if (overlap >= 2) return 40 + overlap * 8;
  if (overlap === 1 && triggerWords.length >= 2) return 0;

  return 0;
}

export type AudioIntent = "location" | "distrust" | "general";

export function audioIntent(item: NamedAudio): AudioIntent {
  const slug = audioSlug(item);
  if (/nao.?sou.?fake|naosou_fake|desconfia|golpe|fake/.test(slug)) return "distrust";
  const tr = (item.triggers || item.keywords || "").toLowerCase();
  if (/fake|golpe|golp|bot|desconfi|fraude|scam/.test(tr)) return "distrust";
  if (/de onde|onde mora|onde voce|onde vc/.test(tr)) return "location";
  return "general";
}

export function isLocationQuestion(text: string) {
  return /de onde|onde voce|onde vc|voce fala de onde|nasceu|mora em|e de onde|fala de onde|qual cidade|de q cidade/i.test(
    text
  );
}

export function isDistrustMessage(text: string) {
  return /fake|golpe|golp|é bot|e bot|rob[oô]|inteligencia artificial|\bia\b|e real|é real|serio\?|desconfi|confio nao|fraude|scam|verdade mesmo|pessoa real|nao confio|golpista/i.test(
    text
  );
}

function matchesIntent(text: string, intent: AudioIntent) {
  if (intent === "location") return isLocationQuestion(text);
  if (intent === "distrust") return isDistrustMessage(text);
  return true;
}

export function findNamedAudioForLead(text: string, library: NamedAudio[]): NamedAudio | null {
  const norm = normalizeAudioKey(text);
  if (!norm || library.length === 0) return null;

  let best: { item: NamedAudio; score: number } | null = null;
  for (const item of library) {
    if (!matchesIntent(text, audioIntent(item))) continue;
    for (const trigger of audioTriggers(item)) {
      const score = scoreTriggerMatch(norm, trigger);
      if (score > (best?.score ?? 0)) best = { item, score };
    }
  }
  return best && best.score >= 40 ? best.item : null;
}

export function findContextualLeadAudio(text: string, library: NamedAudio[]): NamedAudio | null {
  if (!library.length) return null;

  const byTrigger = findNamedAudioForLead(text, library);
  if (byTrigger) return byTrigger;

  if (isDistrustMessage(text)) {
    const distrust = library.find((a) => audioIntent(a) === "distrust");
    if (distrust) return distrust;
  }

  return null;
}

export function resolveAudioBySlug(slug: string, library: NamedAudio[]): NamedAudio | null {
  const norm = normalizeSlug(slug);
  if (!norm) return null;

  for (const item of library) {
    if (audioSlug(item) === norm) return item;
  }

  const aliases = SLUG_ALIASES[norm] || [];
  for (const alias of aliases) {
    const found = library.find((item) => audioSlug(item) === alias);
    if (found) return found;
  }

  return null;
}

export function parseAudioTags(text: string): string[] {
  const slugs: string[] = [];
  const re = /\[\[audio:([a-z0-9_]+)\]\]|\[\[audio_([a-z0-9_]+)\]\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    slugs.push(normalizeSlug(m[1] || m[2] || ""));
  }
  return [...new Set(slugs.filter(Boolean))];
}

export function findNamedAudioInReply(
  reply: string,
  library: NamedAudio[],
  userText: string
): NamedAudio | null {
  if (library.length === 0) return null;

  for (const slug of parseAudioTags(reply)) {
    const item = resolveAudioBySlug(slug, library);
    if (item) return item;
  }

  if (!isLocationQuestion(userText)) return null;

  const norm = normalizeAudioKey(reply);
  if (!norm) return null;

  for (const item of library) {
    if (audioIntent(item) !== "location") continue;
    const label = normalizeAudioKey(item.label);
    if (label.length < 8) continue;
    if (norm.includes(label)) return item;
    const quoted = reply.match(/"([^"]{8,})"/);
    if (quoted && normalizeAudioKey(quoted[1]) === label) return item;
  }
  return null;
}

export function pickAudioFromAi(
  library: NamedAudio[],
  input: { audioSlugs: string[]; actions: string[]; reply: string; userText: string }
): NamedAudio | null {
  if (input.actions.includes("naosou_fake")) {
    const fromAction =
      resolveAudioBySlug("nao_sou_fake", library) ||
      resolveAudioBySlug("naosou_fake", library);
    if (fromAction) return fromAction;
  }

  for (const slug of input.audioSlugs) {
    const item = resolveAudioBySlug(slug, library);
    if (item) return item;
  }

  return findNamedAudioInReply(input.reply, library, input.userText);
}

export function findNamedAudio(text: string, library: NamedAudio[]): NamedAudio | null {
  return findContextualLeadAudio(text, library);
}

export function audioLibraryPrompt(library: NamedAudio[]): string {
  if (!library.length) return "Nenhum audio cadastrado.";
  return library
    .map((a) => {
      const slug = audioSlug(a);
      const triggers = (a.triggers || a.keywords || "").trim();
      const intent =
        audioIntent(a) === "distrust"
          ? "quando lead desconfiar (golpe/fake/bot)"
          : audioIntent(a) === "location"
            ? "quando lead perguntar de onde/mora"
            : "quando o caso do prompt pedir";
      return `[[audio:${slug}]] fala "${a.label}" — ${intent}${triggers ? `; gatilhos: ${triggers}` : ""}`;
    })
    .join("\n");
}
