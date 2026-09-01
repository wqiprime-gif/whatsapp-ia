/**
 * Cliente IA compartilhado (OpenAI / OpenRouter / etc.) — lê ai-runtime.json da instância.
 */
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const https = require("https");

function createAiRuntime(instancesDataDir) {
  const aiRuntimePath = path.join(instancesDataDir, "ai-runtime.json");
  let apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  let model = process.env.AI_MODEL || "gpt-4o-mini";
  let provider = process.env.AI_PROVIDER || "openai";
  let baseURL = process.env.AI_BASE_URL || "";
  let client = null;
  let sig = "";

  const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30_000,
    maxSockets: 16,
    family: 4,
    timeout: 60_000
  });

  function reload() {
    const envKey = String(process.env.OPENAI_API_KEY || "").trim();
    try {
      if (fs.existsSync(aiRuntimePath)) {
        const data = JSON.parse(fs.readFileSync(aiRuntimePath, "utf8"));
        const fileKey = String(data.apiKey || "").trim();
        if (fileKey) apiKey = fileKey;
        else if (envKey) apiKey = envKey;
        if (data.model) model = data.model;
        if (data.provider) provider = data.provider;
        if (data.baseURL !== undefined) baseURL = data.baseURL || "";
      } else if (envKey) {
        apiKey = envKey;
      }
    } catch (err) {
      if (envKey) apiKey = envKey;
    }
  }

  function resolveBaseURL() {
    return (baseURL || "https://api.openai.com/v1").replace(/\/+$/, "");
  }

  function authHeaders() {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER || "https://zapmanager.app";
      headers["X-Title"] = "X1 BLACK";
    }
    return headers;
  }

  async function chatCompletion(payload) {
    const url = `${resolveBaseURL()}/chat/completions`;
    const res = await axios.post(url, payload, {
      headers: authHeaders(),
      httpsAgent,
      timeout: 60_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true
    });
    if (res.status >= 400) {
      const detail = res.data?.error?.message || res.statusText || `HTTP ${res.status}`;
      const err = new Error(detail);
      err.status = res.status;
      err.response = res;
      throw err;
    }
    return res.data;
  }

  function getOpenAI() {
    reload();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY ausente — configure a API Key no painel da instância");
    }
    const nextSig = `${apiKey}|${model}|${provider}|${baseURL}`;
    if (!client || nextSig !== sig) {
      sig = nextSig;
      client = {
        chat: {
          completions: {
            create: async (payload) => {
              const body = { ...payload };
              if (!body.model) body.model = model;
              return chatCompletion(body);
            }
          }
        }
      };
    }
    return client;
  }

  function getModel() {
    reload();
    return model || "gpt-4o-mini";
  }

  function hasKey() {
    reload();
    return Boolean(apiKey);
  }

  return { getOpenAI, getModel, hasKey, reload };
}

module.exports = { createAiRuntime };
