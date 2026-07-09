/** Mensagens casuais para maturação em grupos — tom humano brasileiro. */
export const MATURATION_MESSAGES = [
  "bom dia galera",
  "e aí pessoal tudo bem?",
  "alguém online?",
  "kkk verdade demais",
  "concordo contigo",
  "show de bola",
  "beleza então",
  "valeu!",
  "tô por aqui",
  "depois a gente conversa melhor",
  "massa isso",
  "top demais",
  "entendi agora",
  "pode crer",
  "tranquilo",
  "blz",
  "tava pensando nisso tb",
  "nossa faz sentido",
  "hoje tá corrido",
  "alguém viu isso?",
  "que loucura kkk",
  "tô de boa",
  "falta pouco",
  "bora que bora",
  "tá certo",
  "sim sim",
  "ah tá",
  "nossa nem vi",
  "verdade",
  "exato",
  "isso mesmo",
  "complicado né",
  "difícil isso",
  "vai dar certo",
  "tomara",
  "cruzes",
  "eita",
  "puts",
  "aff",
  "mds kkk",
  "perfeito",
  "fechou",
  "combinado",
  "até mais tarde",
  "flw",
  "tmj",
  "sucesso aí",
  "boa sorte",
  "tamo junto"
];

const TYPO_MAP: Record<string, string> = {
  a: "á",
  voce: "vc",
  você: "vc",
  também: "tbm",
  porque: "pq",
  está: "ta",
  estou: "to",
  não: "nao",
  demais: "dms",
  galera: "galer",
  verdade: "vdd",
  beleza: "blz",
  obrigado: "vlw",
  valeu: "vlw",
  hoje: "hj",
  amanhã: "amanha"
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function applyTypo(word: string): string {
  const lower = word.toLowerCase();
  if (TYPO_MAP[lower]) return Math.random() < 0.6 ? TYPO_MAP[lower]! : word;
  if (word.length < 4 || Math.random() > 0.22) return word;
  const i = Math.floor(Math.random() * (word.length - 1)) + 1;
  const chars = word.split("");
  [chars[i - 1], chars[i]] = [chars[i]!, chars[i - 1]!];
  return chars.join("");
}

/** Humaniza texto com caixa, typos, hesitações e pontuação irregular. */
export function humanizeText(text: string): string {
  let out = text.trim();
  if (Math.random() < 0.75) out = out.toLowerCase();
  if (Math.random() < 0.35) out = out.replace(/[.!?]+$/, "");
  if (Math.random() < 0.18) out = out + pick(["...", "..", " kkk", " rs", " né", " viu"]);

  out = out
    .split(/\s+/)
    .map((w) => applyTypo(w))
    .join(" ");

  if (Math.random() < 0.12) out = out.replace(/\s+/g, "  ");
  if (Math.random() < 0.08 && out.length > 8) {
    const cut = Math.floor(out.length * (0.55 + Math.random() * 0.25));
    out = out.slice(0, cut).trim();
  }
  return out;
}

export function pickHumanMessage(): string {
  return humanizeText(pick(MATURATION_MESSAGES));
}

/** Delay aleatório entre ações (ms) — simula pausas humanas. */
export function randomMaturationDelayMs(): number {
  const roll = Math.random();
  if (roll < 0.12) return 18 * 60 * 1000 + Math.random() * 12 * 60 * 1000;
  if (roll < 0.28) return 12 * 60 * 1000 + Math.random() * 8 * 60 * 1000;
  return 5 * 60 * 1000 + Math.random() * 10 * 60 * 1000;
}

/** Chance de pular uma rodada (pausa longa). */
export function shouldSkipMaturationRound(): boolean {
  return Math.random() < 0.14;
}
