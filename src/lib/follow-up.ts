export type FollowUpStep = {
  message: string;
  afterMinutes: number;
};

export function parseFollowUpSteps(value: unknown): FollowUpStep[] {
  if (!value) return [];
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      message: String(item?.message ?? "").trim(),
      afterMinutes: Math.min(180, Math.max(1, Number(item?.afterMinutes) || 10))
    }))
    .filter((s) => s.message)
    .slice(0, 5);
}

export function followUpStepsFromForm(raw: Record<string, string | string[]>): FollowUpStep[] {
  const messages = raw.followUpMessage;
  const minutes = raw.followUpMinutes;
  const msgList = Array.isArray(messages) ? messages : messages ? [messages] : [];
  const minList = Array.isArray(minutes) ? minutes : minutes ? [minutes] : [];
  return msgList
    .map((msg, i) => ({
      message: String(msg || "").trim(),
      afterMinutes: Math.min(180, Math.max(1, Number(minList[i]) || 10))
    }))
    .filter((s) => s.message)
    .slice(0, 5);
}

export function followUpMaxSteps(config: {
  followUpSteps?: FollowUpStep[];
  followUpMaxPerLead?: number;
}): number {
  const steps = config.followUpSteps ?? [];
  if (steps.length > 0) return steps.length;
  return Math.min(5, Math.max(1, config.followUpMaxPerLead || 2));
}

/** Resolve delay and message for the Nth follow-up (0-based). message=null → gerar via IA. */
export function resolveFollowUpStep(
  config: {
    followUpSteps?: FollowUpStep[];
    followUpAfterMinutes?: number;
    followUpMaxPerLead?: number;
  },
  index: number
): { afterMs: number; message: string | null } | null {
  const steps = config.followUpSteps ?? [];
  if (steps.length > 0) {
    const step = steps[index];
    if (!step) return null;
    return {
      afterMs: Math.max(60_000, step.afterMinutes * 60_000),
      message: step.message
    };
  }
  const max = followUpMaxSteps(config);
  if (index >= max) return null;
  return {
    afterMs: Math.max(60_000, (config.followUpAfterMinutes || 10) * 60_000),
    message: null
  };
}
