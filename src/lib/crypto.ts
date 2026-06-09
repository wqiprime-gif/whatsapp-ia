import crypto from "node:crypto";
import { env } from "../config.js";

const algorithm = "aes-256-gcm";

function getKey() {
  return crypto.createHash("sha256").update(env.SESSION_SECRET).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) {
    throw new Error("Invalid encrypted payload.");
  }
  const decipher = crypto.createDecipheriv(algorithm, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final()
  ]).toString("utf8");
}

export function maskApiKey(key: string) {
  if (key.length <= 12) {
    return "••••••••";
  }
  return `${key.slice(0, 7)}••••••••${key.slice(-4)}`;
}
