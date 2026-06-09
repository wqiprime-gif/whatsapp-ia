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
  const grid = [0.25, 0.5, 0.75, 1]
    .map((g) => {
      const y = h - pad - g * (h - pad * 2);
      return `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    })
    .join("");
  const bars = coords
    .map(
      (c, i) =>
        `<circle cx="${c.x}" cy="${c.y}" r="4" fill="#3de07a" class="chart-dot" style="animation-delay:${i * 0.08}s">
      <title>R$ ${(c.v / 100).toFixed(2).replace(".", ",")}</title></circle>`
    )
    .join("");
  const labels = days
    .map((d, i) => {
      const x = pad + (i / 6) * (w - pad * 2);
      return `<text x="${x}" y="${h - 4}" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="10">${d.slice(5)}</text>`;
    })
    .join("");

  return `<div class="chart-pro ${opts?.tall ? "chart-pro--tall" : ""}">
    ${opts?.title ? `<div class="chart-pro-title">${opts.title}</div>` : ""}
    <svg class="chart-svg chart-svg--pro" viewBox="0 0 ${w} ${h + 8}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(10,92,255,0.45)"/>
          <stop offset="100%" stop-color="rgba(10,92,255,0)"/>
        </linearGradient>
      </defs>
      ${grid}
      <path d="${area}" fill="url(#salesGrad)"/>
      <polyline class="chart-line-anim" points="${line}" fill="none" stroke="#3de07a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
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
      return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="4" fill="rgba(10,92,255,0.85)" class="chart-bar-anim" style="animation-delay:${i * 0.06}s">
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
    <svg class="chart-svg chart-svg--pro" viewBox="0 0 ${w} ${h + 8}" preserveAspectRatio="none">
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
