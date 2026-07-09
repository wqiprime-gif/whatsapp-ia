import fsSync from "node:fs";
import path from "node:path";
import { rootDir } from "../config.js";
import { type NamedAudio } from "../bots.js";

/**
 * Áudios padrão (notas de voz) entregues junto com a instância nova, para o
 * cliente testar o funil mesmo sem ter gravado os próprios. Ele pode remover,
 * trocar ou adicionar quantos quiser depois no formulário da instância.
 */
type SeedAudio = {
  file: string;
  label: string;
  slug: string;
  triggers?: string;
};

const SEED_AUDIOS: SeedAudio[] = [
  { file: "saudacao.mp3", label: "Saudação (oi, tudo bem?)", slug: "saudacao" },
  { file: "informacoes.mp3", label: "Explicando os pacotes", slug: "informacoes" },
  { file: "qualpack.mp3", label: "Qual pacote você quer?", slug: "qual_pack" },
  { file: "chavepix.mp3", label: "Chave Pix / pagamento", slug: "chave_pix" },
  {
    file: "chamadavideo.mp3",
    label: "Chamada de vídeo",
    slug: "chamada_video",
    triggers: "chamada, videochamada, liga, faz chamada, vende chamada"
  },
  {
    file: "naosoufake.mp3",
    label: "Não sou fake",
    slug: "nao_sou_fake",
    triggers: "fake, golpe, voce e real, e bot"
  }
];

/** Catálogo dos áudios padrão — usado no formulário da instância (com player). */
export const SEED_AUDIO_CATALOG = SEED_AUDIOS.map(({ file, label, slug, triggers }) => ({
  file,
  label,
  slug,
  triggers: triggers ?? "",
  previewUrl: `/seed-audios/${file}`
}));

const seedDir = path.join(rootDir, "assets", "seed-audios");

/** Caminho absoluto de um áudio padrão pelo nome do arquivo (para servir no painel). */
export function seedAudioPath(file: string): string | null {
  const safe = path.basename(file);
  const allowed = SEED_AUDIOS.some((s) => s.file === safe);
  if (!allowed) return null;
  const full = path.join(seedDir, safe);
  return fsSync.existsSync(full) ? full : null;
}

/**
 * Devolve a biblioteca de áudios padrão usando URLs estáveis `/seed-audios/...`.
 * Esses arquivos ficam versionados no repositório (assets/seed-audios) e são
 * servidos pelo painel, então NÃO somem em redeploys (a pasta data/uploads do
 * Railway é efêmera). Áudios faltando no pacote são apenas ignorados.
 */
export async function buildDefaultAudioLibrary(): Promise<NamedAudio[]> {
  const library: NamedAudio[] = [];

  for (const seed of SEED_AUDIOS) {
    const source = path.join(seedDir, seed.file);
    if (!fsSync.existsSync(source)) {
      console.warn(`[seed-audios] arquivo ausente, pulando: ${source}`);
      continue;
    }
    library.push({
      label: seed.label,
      url: `/seed-audios/${seed.file}`,
      slug: seed.slug,
      triggers: seed.triggers ?? ""
    });
  }

  return library;
}
