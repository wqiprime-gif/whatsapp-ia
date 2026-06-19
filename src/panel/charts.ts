const WEEKDAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_FULL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export function chartDayLabel(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return WEEKDAY_PT[d.getDay()] ?? iso.slice(5);
}

export function chartDayLabelFull(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return WEEKDAY_FULL[d.getDay()] ?? iso;
}

export function buildChartDays(count = 7, endOffset = 0) {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i - endOffset);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function chartDayValues<T extends { day: string }>(
  points: T[],
  pick: (p: T) => number
): number[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days.map((day) => {
    const hit = points.find((p) => p.day === day);
    return hit ? pick(hit) : 0;
  });
}

export function kpiTrendLabel(values: number[]) {
  if (values.length < 2) return { text: "—", positive: true };
  const last = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? 0;
  if (prev === 0 && last === 0) return { text: "0%", positive: true };
  const pct = prev === 0 ? 100 : Math.round(((last - prev) / prev) * 100);
  return { text: `${pct >= 0 ? "+" : ""}${pct}%`, positive: pct >= 0 };
}

export function sparklineSvg(values: number[], color = "#25D366") {
  if (values.length === 0) values = [0, 0];
  const gid = `sp${Math.random().toString(36).slice(2, 9)}`;
  const w = 112;
  const h = 36;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const coords = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - 4 - ((v - min) / range) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = `M0,${h} L${coords.join(" L")} L${w},${h} Z`;
  return `<svg class="kpi-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#${gid})"/>
    <polyline points="${coords.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export function channelDonutSvg(stats: { label: string; value: number; color: string }[]) {
  const total = stats.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const slices = stats
    .map((s) => {
      const pct = s.value / total;
      const dash = pct * c;
      const el = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${s.color}" stroke-width="22"
        stroke-dasharray="${dash} ${c - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`;
      offset += dash;
      return el;
    })
    .join("");
  const legend = stats
    .map(
      (s) =>
        `<div class="donut-legend-row"><span class="donut-dot" style="background:${s.color}"></span>${s.label} <strong>${Math.round((s.value / total) * 100)}%</strong></div>`
    )
    .join("");
  return `<div class="donut-wrap"><svg viewBox="0 0 140 140" class="donut-svg">${slices}</svg><div class="donut-legend">${legend}</div></div>`;
}

export function salesFunnelHtml(input: { leads: number; sales: number; messages: number }) {
  const leadCount = Math.max(input.leads, 1);
  const stages = [
    { label: "Leads", value: input.leads, pct: 100, color: "#4ade80" },
    {
      label: "Conversas",
      value: input.messages,
      pct: input.leads ? Math.min(100, Math.round((input.messages / leadCount) * 100)) : 0,
      color: "#22c55e"
    },
    {
      label: "Vendas",
      value: input.sales,
      pct: input.leads ? Math.round((input.sales / leadCount) * 100) : 0,
      color: "#25D366"
    }
  ];
  return `<div class="funnel-pro">${stages
    .map(
      (s, i) =>
        `<div class="funnel-pro-stage" style="--funnel-w:${100 - i * 12}%;--funnel-color:${s.color}">
          <div class="funnel-pro-inner">
            <span class="funnel-pro-label">${s.label}</span>
            <div class="funnel-pro-stats"><strong>${s.value}</strong><em>${s.pct}%</em></div>
          </div>
        </div>`
    )
    .join("")}</div>`;
}

export function salesChartSvgFromData(points: { day: string; totalCents: number }[], opts?: { title?: string; tall?: boolean }) {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const values = days.map((day) => points.find((p) => p.day === day)?.totalCents ?? 0);
  const max = Math.max(...values, 1);
  const w = 520;
  const h = opts?.tall ? 200 : 160;
  const pad = 24;
  const coords = values.map((v, i) => {
    const x = pad + (i / 6) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return { x, y, v };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area = `M${coords[0].x},${h - pad} ${coords.map((c) => `L${c.x},${c.y}`).join(" ")} L${coords[6].x},${h - pad} Z`;
  const gradId = `sg${Math.random().toString(36).slice(2, 9)}`;
  const grid = [0.25, 0.5, 0.75, 1]
    .map((g) => {
      const y = h - pad - g * (h - pad * 2);
      return `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    })
    .join("");
  const bars = coords
    .map(
      (c, i) =>
        `<circle cx="${c.x}" cy="${c.y}" r="4" fill="#25D366" class="chart-dot" style="animation-delay:${i * 0.08}s">
      <title>R$ ${(c.v / 100).toFixed(2).replace(".", ",")}</title></circle>`
    )
    .join("");
  const labels = days
    .map((d, i) => {
      const x = pad + (i / 6) * (w - pad * 2);
      return `<text x="${x}" y="${h - 4}" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="10">${chartDayLabel(d)}</text>`;
    })
    .join("");

  return `<div class="chart-pro ${opts?.tall ? "chart-pro--tall" : ""}">
    ${opts?.title ? `<div class="chart-pro-title">${opts.title}</div>` : ""}
    <svg class="chart-svg chart-svg--pro" viewBox="0 0 ${w} ${h + 8}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(37,211,102,0.4)"/>
          <stop offset="100%" stop-color="rgba(37,211,102,0)"/>
        </linearGradient>
      </defs>
      ${grid}
      <path d="${area}" fill="url(#${gradId})"/>
      <polyline class="chart-line-anim" points="${line}" fill="none" stroke="#25D366" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${bars}
      ${labels}
    </svg>
  </div>`;
}

export function messagesChartSvgFromData(points: { day: string; count: number }[]) {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const values = days.map((day) => points.find((p) => p.day === day)?.count ?? 0);
  const max = Math.max(...values, 1);
  const w = 520;
  const h = 160;
  const pad = 24;
  const barW = (w - pad * 2) / 7 - 8;
  const bars = values
    .map((v, i) => {
      const bh = (v / max) * (h - pad * 2);
      const x = pad + i * ((w - pad * 2) / 7) + 4;
      const y = h - pad - bh;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="4" fill="rgba(37,211,102,0.75)" class="chart-bar-anim" style="animation-delay:${i * 0.06}s">
        <title>${v} msgs</title></rect>`;
    })
    .join("");
  const labels = days
    .map((d, i) => {
      const x = pad + i * ((w - pad * 2) / 7) + barW / 2 + 4;
      return `<text x="${x}" y="${h - 4}" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="10">${d.slice(5)}</text>`;
    })
    .join("");

  return `<div class="chart-pro">
    <svg class="chart-svg chart-svg--pro chart-svg--bars" viewBox="0 0 ${w} ${h + 8}" preserveAspectRatio="xMidYMid meet">
      ${bars}
      ${labels}
    </svg>
  </div>`;
}

export function leadSourcesBarSvg(stats: { source: string; count: number }[]) {
  if (stats.length === 0) {
    return `<p class="form-hint">Sem dados de origem ainda.</p>`;
  }
  const max = Math.max(...stats.map((s) => s.count), 1);
  const rows = stats
    .slice(0, 6)
    .map((s, i) => {
      const pct = Math.round((s.count / max) * 100);
      return `<div class="src-bar-row">
        <span class="src-bar-label">${s.source}</span>
        <div class="src-bar-track"><div class="src-bar-fill" style="width:${pct}%;animation-delay:${i * 0.07}s"></div></div>
        <span class="src-bar-val">${s.count}</span>
      </div>`;
    })
    .join("");
  return `<div class="src-bars">${rows}</div>`;
}

export function conversionGaugeSvg(pct: number, subtitle: string) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = 54;
  const half = Math.PI * r;
  const dash = (clamped / 100) * half;
  const gid = `cg${Math.random().toString(36).slice(2, 9)}`;
  return `<div class="conv-gauge">
    <svg class="conv-gauge-svg" viewBox="0 0 140 88" aria-hidden="true">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#25D366"/>
          <stop offset="100%" stop-color="#3de07a"/>
        </linearGradient>
      </defs>
      <path d="M 16 76 A ${r} ${r} 0 0 1 124 76" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10" stroke-linecap="round"/>
      <path d="M 16 76 A ${r} ${r} 0 0 1 124 76" fill="none" stroke="url(#${gid})" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(2)} ${half.toFixed(2)}" />
      <text x="70" y="62" text-anchor="middle" fill="#fff" font-size="22" font-weight="800">${clamped.toFixed(0)}%</text>
    </svg>
    <span class="conv-gauge-sub">${subtitle}</span>
  </div>`;
}

export function sharkPerformanceChartHtml(
  points: { day: string; totalCents: number }[],
  opts?: { dayCount?: number; endOffset?: number }
) {
  const dayCount = opts?.dayCount ?? 7;
  const endOffset = opts?.endOffset ?? 0;
  const days = buildChartDays(dayCount, endOffset);
  const values = days.map((day) => points.find((p) => p.day === day)?.totalCents ?? 0);
  const max = Math.max(...values, 1);
  const w = 560;
  const h = 220;
  const padL = 28;
  const padR = 20;
  const padT = 36;
  const padB = 32;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const coords = values.map((v, i) => {
    const x = padL + (i / Math.max(dayCount - 1, 1)) * chartW;
    const y = padT + chartH - (v / max) * chartH;
    return { x, y, v, day: days[i]! };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area = `M${coords[0].x},${padT + chartH} ${coords.map((c) => `L${c.x},${c.y}`).join(" ")} L${coords[coords.length - 1].x},${padT + chartH} Z`;
  const gid = `sg${Math.random().toString(36).slice(2, 9)}`;
  const grid = [0.25, 0.5, 0.75]
    .map((g) => {
      const y = padT + chartH - g * chartH;
      return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
    })
    .join("");
  const dots = coords
    .map(
      (c, i) =>
        `<circle class="shark-chart-dot" data-idx="${i}" cx="${c.x}" cy="${c.y}" r="5" fill="#25D366" stroke="#050505" stroke-width="2" pointer-events="none"/>`
    )
    .join("");
  const hitW = chartW / Math.max(dayCount - 1, 1) * 0.85;
  const hits = coords
    .map(
      (c, i) =>
        `<rect class="shark-chart-hit" data-idx="${i}" x="${(c.x - hitW / 2).toFixed(1)}" y="${padT}" width="${hitW.toFixed(1)}" height="${chartH}" fill="transparent" style="cursor:crosshair"/>`
    )
    .join("");
  const labels = coords
    .map(
      (c) =>
        `<text x="${c.x}" y="${h - 8}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="10" pointer-events="none">${chartDayLabel(c.day)}</text>`
    )
    .join("");
  const dataJson = JSON.stringify(
    coords.map((c) => ({
      day: c.day,
      label: chartDayLabelFull(c.day),
      short: chartDayLabel(c.day),
      cents: c.v
    }))
  ).replace(/'/g, "&#39;");

  return `<div class="shark-perf-chart" data-chart-points='${dataJson}' data-chart-w="${w}" data-chart-h="${h}" data-pad-t="${padT}" data-chart-h-inner="${chartH}">
    <div class="shark-chart-legend">
      <span class="shark-chart-legend-dot"></span>
      <span>Receita</span>
    </div>
    <div class="shark-chart-stage">
      <svg class="shark-chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(37,211,102,0.35)"/>
            <stop offset="100%" stop-color="rgba(37,211,102,0)"/>
          </linearGradient>
        </defs>
        ${grid}
        <line class="shark-chart-cursor" x1="${coords[0].x}" y1="${padT}" x2="${coords[0].x}" y2="${padT + chartH}" stroke="rgba(255,255,255,0.35)" stroke-width="1" opacity="0"/>
        <path d="${area}" fill="url(#${gid})" pointer-events="none"/>
        <polyline points="${line}" fill="none" stroke="#25D366" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>
        ${dots}
        ${labels}
        ${hits}
      </svg>
      <div class="shark-chart-tooltip" hidden>
        <span class="shark-chart-tooltip-day"></span>
        <div class="shark-chart-tooltip-row">
          <span class="shark-chart-legend-dot"></span>
          <span class="shark-chart-tooltip-label">Receita</span>
          <strong class="shark-chart-tooltip-val"></strong>
        </div>
      </div>
    </div>
  </div>`;
}
