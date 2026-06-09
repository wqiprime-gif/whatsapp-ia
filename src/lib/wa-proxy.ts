export type ProxyType = "http" | "https" | "socks5" | "socks5h";

export const PROXY_TYPE_OPTIONS: { id: ProxyType; label: string }[] = [
  { id: "http", label: "HTTP" },
  { id: "https", label: "HTTPS" },
  { id: "socks5", label: "SOCKS5 (residencial)" },
  { id: "socks5h", label: "SOCKS5 — DNS pelo proxy (residencial)" }
];

export function parseProxyType(value: unknown): ProxyType {
  if (value === "https" || value === "socks5" || value === "socks5h") return value;
  return "http";
}

export function buildProxyUrl(input: {
  proxyType?: string;
  proxyHost?: string;
  proxyPort?: string | number;
  proxyUsername?: string;
  proxyPassword?: string;
  proxyUrl?: string;
}) {
  const pasted = input.proxyUrl?.trim();
  if (pasted) return pasted;

  const host = input.proxyHost?.trim();
  const port = String(input.proxyPort ?? "").trim();
  if (!host || !port) return "";

  const type = parseProxyType(input.proxyType);
  const scheme = type === "socks5h" ? "socks5h" : type === "socks5" ? "socks5" : type;
  const user = input.proxyUsername?.trim();
  const pass = input.proxyPassword ?? "";
  const auth =
    user ? `${encodeURIComponent(user)}${pass ? `:${encodeURIComponent(pass)}` : ""}@` : "";
  return `${scheme}://${auth}${host}:${port}`;
}

export function parseProxyUrl(proxyUrl: string) {
  try {
    const u = new URL(proxyUrl);
    let type: ProxyType = "http";
    if (u.protocol === "https:") type = "https";
    else if (u.protocol === "socks5:") type = "socks5";
    else if (u.protocol === "socks5h:") type = "socks5h";
    return {
      type,
      host: u.hostname,
      port: u.port || (type === "https" ? "443" : "1080"),
      username: u.username ? decodeURIComponent(u.username) : "",
      password: u.password ? decodeURIComponent(u.password) : ""
    };
  } catch {
    return null;
  }
}

/** Converte URL de proxy para argumentos Puppeteer (whatsapp-web.js). */
export function puppeteerProxyArgs(proxyUrl: string): string[] {
  const trimmed = proxyUrl.trim();
  if (!trimmed) return [];
  const parsed = parseProxyUrl(trimmed);
  if (!parsed) return [];

  const { type, host, port } = parsed;
  if (type === "socks5" || type === "socks5h") {
    const scheme = type === "socks5h" ? "socks5h" : "socks5";
    return [`--proxy-server=${scheme}://${host}:${port}`];
  }
  if (type === "https") {
    return [`--proxy-server=https://${host}:${port}`];
  }
  return [`--proxy-server=${host}:${port}`];
}

export function proxyAuthFromUrl(proxyUrl: string) {
  const parsed = parseProxyUrl(proxyUrl);
  if (!parsed?.username) return null;
  return { username: parsed.username, password: parsed.password };
}

export function maskProxyUrl(proxyUrl: string) {
  const parsed = parseProxyUrl(proxyUrl);
  if (!parsed) return "proxy-configurado";
  const auth = parsed.username ? "****:****@" : "";
  return `${parsed.type}://${auth}${parsed.host}:${parsed.port}`;
}
