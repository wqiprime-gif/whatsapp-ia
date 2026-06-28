import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { rootDir } from "../config.js";
import { uploadsDir, type NamedAudio } from "../bots.js";

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
    file: "naosoufake.mp3",
    label: "Não sou fake",
    slug: "nao_sou_fake",
    triggers: "fake, golpe, voce e real, e bot"
  }
];

/** Catálogo dos áudios padrão (sem arquivo) — usado no formulário da instância. */
export const SEED_AUDIO_CATALOG = SEED_AUDIOS.map(({ label, slug, triggers }) => ({
  label,
  slug,
  triggers: triggers ?? ""
}));

const seedDir = path.join(rootDir, "assets", "seed-audios");

/**
 * Copia os áudios padrão para a pasta de uploads e devolve a biblioteca pronta
 * (com URLs /uploads/...). Áudios faltando no pacote são apenas ignorados.
 */
export async function buildDefaultAudioLibrary(): Promise<NamedAudio[]> {
  const library: NamedAudio[] = [];
  await fs.mkdir(uploadsDir, { recursive: true });

  for (const seed of SEED_AUDIOS) {
    const source = path.join(seedDir, seed.file);
    if (!fsSync.existsSync(source)) {
      console.warn(`[seed-audios] arquivo ausente, pulando: ${source}`);
      continue;
    }
    const fileName = `seed-${seed.slug}-${randomUUID()}.mp3`;
    const dest = path.join(uploadsDir, fileName);
    try {
      await fs.copyFile(source, dest);
      library.push({
        label: seed.label,
        url: `/uploads/${fileName}`,
        slug: seed.slug,
        triggers: seed.triggers ?? ""
      });
    } catch (error) {
      console.error(`[seed-audios] falha ao copiar ${seed.file}:`, error);
    }
  }

  return library;
}
