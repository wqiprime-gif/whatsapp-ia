/** Cliente HTTP para criar chamadas CallHot a partir do ZapManager. */

export type CallHotCreateInput = {
  baseUrl: string;
  secret: string;
  videoUrl: string;
  callerName: string;
  callerAvatarUrl?: string;
  title?: string;
  expectedAmount?: number;
};

export type CallHotCreateResult = {
  callId: string;
  ringUrl: string;
  fullRingUrl: string;
};

export async function createCallHotRing(input: CallHotCreateInput): Promise<CallHotCreateResult> {
  const base = input.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/bot/create-call`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-callhot-secret": input.secret
    },
    body: JSON.stringify({
      videoUrl: input.videoUrl,
      callerName: input.callerName,
      callerAvatarUrl: input.callerAvatarUrl || undefined,
      title: input.title || undefined,
      expectedAmount: input.expectedAmount ?? undefined
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`CallHot: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as { callId: string; ringUrl: string; fullRingUrl?: string };
  const ringPath = data.ringUrl.startsWith("/") ? data.ringUrl : `/${data.ringUrl}`;
  return {
    callId: data.callId,
    ringUrl: ringPath,
    fullRingUrl: data.fullRingUrl || `${base}${ringPath}`
  };
}
