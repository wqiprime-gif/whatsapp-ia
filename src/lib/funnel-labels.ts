export type FunnelStageId =
  | "new"
  | "curious"
  | "negotiating"
  | "paying"
  | "paid"
  | "upsell"
  | "post_sale";

export type LeadObjectionId =
  | "caro"
  | "sem_dinheiro"
  | "fake"
  | "indeciso"
  | "desconfiado";

export const FUNNEL_STAGE_META: Record<
  FunnelStageId,
  { label: string; short: string; css: string }
> = {
  new: { label: "Novo", short: "Novo", css: "funnel-stage--new" },
  curious: { label: "Curioso", short: "Curioso", css: "funnel-stage--curious" },
  negotiating: { label: "Negociando", short: "Negoc.", css: "funnel-stage--negotiating" },
  paying: { label: "Pagando", short: "Pagando", css: "funnel-stage--paying" },
  paid: { label: "Comprou", short: "Pago", css: "funnel-stage--paid" },
  upsell: { label: "Upsell", short: "Upsell", css: "funnel-stage--upsell" },
  post_sale: { label: "Pós-venda", short: "Pós-venda", css: "funnel-stage--post_sale" }
};

export const OBJECTION_META: Record<LeadObjectionId, { label: string; css: string }> = {
  caro: { label: "Achou caro", css: "funnel-objection--caro" },
  sem_dinheiro: { label: "Sem dinheiro", css: "funnel-objection--money" },
  fake: { label: "Desconfia (fake)", css: "funnel-objection--fake" },
  indeciso: { label: "Indeciso", css: "funnel-objection--indeciso" },
  desconfiado: { label: "Desconfiado", css: "funnel-objection--fake" }
};

export function funnelStageBadge(stage: string | null | undefined) {
  const key = (stage || "new") as FunnelStageId;
  const meta = FUNNEL_STAGE_META[key] ?? FUNNEL_STAGE_META.new;
  return { ...meta, id: key };
}

export function objectionBadge(objection: string | null | undefined) {
  if (!objection) return null;
  const key = objection as LeadObjectionId;
  return OBJECTION_META[key] ?? { label: objection, css: "funnel-objection--generic" };
}
