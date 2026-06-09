/**
 * HotBot Admin Panel — Backend
 * Porta: 3001
 */

const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const { exec }   = require('child_process');
const multer     = require('multer');
const app        = express();

const PORT       = process.env.PORT || process.env.ADMIN_PORT || 3001;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'hotbot2025';
const ROOT_DIR   = process.env.BOT_ROOT_DIR || path.join(__dirname, '..');
const TEMPLATE_DIR = path.join(ROOT_DIR, 'hotbot');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Auth ────────────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token === ADMIN_PASS) return next();
  res.status(401).json({ error: 'Não autorizado' });
}

app.use(express.static(__dirname));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'whatsapp-ia-admin' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ─── Defaults do bot (usados quando não há pacotes.json) ─────────────────────
const DEFAULT_TEXTO = `💎 *MEUS PACOTES* 💎

1️⃣ *PACOTE BÁSICO* - R$ 9,90
   📦 50 fotos e vídeos exclusivos

2️⃣ *CHAMADA VÍDEO* - R$ 15,00
   📹 5 minutos de chamada privada

3️⃣ *PACOTE COMPLETO* - R$ 20,00
   🎁 5 minutos de chamada + 50 fotos e vídeos

Qual pacote te interessa, amor? 💕`;

const DEFAULT_DESC_SISTEMA = 'Tabela enviada com 3 pacotes: (1) 50 fotos/vídeos R$9,90 (2) Chamada vídeo 5min R$15,00 (3) Chamada 5min + 50 fotos/vídeos R$20,00';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  return new Promise(resolve => {
    exec(cmd, { timeout: 60000, ...opts }, (err, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', code: err ? (err.code || 1) : 0 });
    });
  });
}

async function getPm2List() {
  const r = await run('pm2 jlist');
  try { return JSON.parse(r.stdout); } catch (_) { return []; }
}

/** Extrai argumento pelo nome dos args PM2 */
function getArg(args, name) {
  if (!Array.isArray(args)) return null;
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}

/** Lê texto de um arquivo ou retorna '' */
function readFile(filePath) {
  try {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
  } catch (_) {}
  return '';
}

/** Extrai chave PIX do system prompt */
function extractPix(prompt) {
  const m = prompt.match(/Chave PIX:\s*([^\s\n]+)/i);
  return m ? m[1].trim() : '';
}

/** Extrai nome do destinatário do system prompt */
function extractNomeDestinatario(prompt) {
  // Tenta padrão "Nome da chave: XYZ"
  const m = prompt.match(/Nome da chave:\s*([^\n(]+)/i);
  return m ? m[1].trim() : '';
}

/** Lê qr.json de uma instância */
function readQr(dir) {
  const p = path.join(dir, 'qr.json');
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (Date.now() - data.ts > 5 * 60 * 1000) { fs.unlinkSync(p); return null; }
    return data;
  } catch (_) { return null; }
}

/** Verifica se diretório tem bot-instance.js */
function isInstanceDir(dir) {
  return fs.existsSync(dir) && fs.existsSync(path.join(dir, 'bot-instance.js'));
}

/** Próxima porta disponível */
async function getNextPort() {
  const list = await getPm2List();
  const used = list.map(p => {
    const port = parseInt(getArg(p.pm2_env?.args, '--port') || '0');
    return port;
  }).filter(p => p > 0);
  let port = 9090;
  while (used.includes(port)) port++;
  return port;
}

// ─── Rotas ───────────────────────────────────────────────────────────────────

/** GET /api/instances */
app.get('/api/instances', auth, async (req, res) => {
  try {
    const pm2List = await getPm2List();

    const instances = pm2List
      .filter(proc => {
        const script = proc.pm2_env?.pm_exec_path || '';
        return script.includes('bot-instance.js');
      })
      .map(proc => {
        const args      = proc.pm2_env?.args || [];
        const name      = proc.name;
        const cwd       = proc.pm2_env?.pm_cwd || path.join(ROOT_DIR, name);
        const modelName = getArg(args, '--modelName') || name;
        const port      = parseInt(getArg(args, '--port') || '0') || null;
        const clientId  = getArg(args, '--clientId') || '';
        const sessionId = getArg(args, '--sessionId') || '';

        const prompt     = readFile(path.join(cwd, 'SYSTEM_PROMPT.md'));
        const pacotesRaw = readFile(path.join(cwd, 'pacotes.json'));
        const pacotes    = pacotesRaw ? (() => { try { return JSON.parse(pacotesRaw); } catch (_) { return {}; } })() : {};

        const pixKey           = pacotes.pixKey || extractPix(prompt);
        const nomeDestinatario = pacotes.nome_destinatario || extractNomeDestinatario(prompt);
        const qrData           = readQr(cwd);

        return {
          id:              proc.pm_id,
          name,
          modelName,
          clientId,
          sessionId,
          port,
          cwd,
          status:          proc.pm2_env?.status || 'stopped',
          pid:             proc.pid || null,
          pixKey,
          nomeDestinatario,
          texto:           pacotes.texto || DEFAULT_TEXTO,
          descricaoSistema: pacotes.descricao_sistema || DEFAULT_DESC_SISTEMA,
          hasQr:           !!qrData,
          qr:              qrData?.qr || null,
          memory:          proc.monit?.memory ? Math.round(proc.monit.memory / 1024 / 1024) : 0,
          cpu:             proc.monit?.cpu || 0,
          restarts:        proc.pm2_env?.restart_time || 0,
          uptime:          proc.pm2_env?.pm_uptime || null,
        };
      });

    res.json({ instances });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/instance/:name/config — retorna config completa preenchida */
app.get('/api/instance/:name/config', auth, async (req, res) => {
  const name    = decodeURIComponent(req.params.name);
  const pm2List = await getPm2List();
  const proc    = pm2List.find(p => p.name === name);
  if (!proc) return res.status(404).json({ error: 'Instância não encontrada' });

  const args      = proc.pm2_env?.args || [];
  const cwd       = proc.pm2_env?.pm_cwd || path.join(ROOT_DIR, name);
  const modelName = getArg(args, '--modelName') || name;
  const clientId  = getArg(args, '--clientId') || '';
  const sessionId = getArg(args, '--sessionId') || '';
  const port      = parseInt(getArg(args, '--port') || '0') || null;

  const prompt    = readFile(path.join(cwd, 'SYSTEM_PROMPT.md'));
  const pacotesRaw = readFile(path.join(cwd, 'pacotes.json'));
  const pacotes   = pacotesRaw ? (() => { try { return JSON.parse(pacotesRaw); } catch (_) { return {}; } })() : {};

  const pixKey           = pacotes.pixKey || extractPix(prompt);
  const nomeDestinatario = pacotes.nome_destinatario || extractNomeDestinatario(prompt);
  const texto            = pacotes.texto || DEFAULT_TEXTO;
  const descricaoSistema = pacotes.descricao_sistema || DEFAULT_DESC_SISTEMA;

  res.json({
    // Info PM2 (read-only)
    name,
    modelName,
    clientId,
    sessionId,
    port,
    cwd,
    // Config editável (sempre preenchida)
    pixKey,
    nomeDestinatario,
    texto,
    descricaoSistema,
    completo_single:    pacotes.completo_single,
    completo_descricao: pacotes.completo_descricao || '',
    packages:           pacotes.packages || [],
    // Arquivo completo
    pacotesRaw: pacotesRaw || '{}',
    prompt,
  });
});

/** PUT /api/instance/:name/config */
app.put('/api/instance/:name/config', auth, async (req, res) => {
  const name    = decodeURIComponent(req.params.name);
  const pm2List = await getPm2List();
  const proc    = pm2List.find(p => p.name === name);
  if (!proc) return res.status(404).json({ error: 'Instância não encontrada' });

  const cwd    = proc.pm2_env?.pm_cwd || path.join(ROOT_DIR, name);
  const body   = req.body;

  // ── Atualiza pacotes.json (merge com existente) ──
  const pacotesPath = path.join(cwd, 'pacotes.json');
  let existing = {};
  try {
    if (fs.existsSync(pacotesPath)) existing = JSON.parse(fs.readFileSync(pacotesPath, 'utf8'));
  } catch (_) {}

  const newPacotes = {
    ...existing,
    ...(body.pixKey           !== undefined ? { pixKey: body.pixKey }                         : {}),
    ...(body.nomeDestinatario !== undefined ? { nome_destinatario: body.nomeDestinatario }     : {}),
    ...(body.texto            !== undefined ? { texto: body.texto }                            : {}),
    ...(body.descricaoSistema !== undefined ? { descricao_sistema: body.descricaoSistema }     : {}),
    ...(body.packages         !== undefined ? { packages: body.packages }                      : {}),
  };
  fs.writeFileSync(pacotesPath, JSON.stringify(newPacotes, null, 2));

  // ── Atualiza SYSTEM_PROMPT.md ──
  if (body.prompt !== undefined) {
    let newPrompt = body.prompt;
    // Atualiza a chave PIX no prompt se mudou
    if (body.pixKey !== undefined) {
      newPrompt = newPrompt.replace(
        /Chave PIX:\s*[^\n]+/gi,
        'Chave PIX: ' + body.pixKey
      );
    }
    // Atualiza nome do destinatário no prompt se mudou
    if (body.nomeDestinatario !== undefined) {
      newPrompt = newPrompt.replace(
        /Nome da chave:\s*[^\n(]+/gi,
        'Nome da chave: ' + body.nomeDestinatario + ' (só se ele perguntar)'
      );
    }
    fs.writeFileSync(path.join(cwd, 'SYSTEM_PROMPT.md'), newPrompt);
  } else if (body.pixKey !== undefined || body.nomeDestinatario !== undefined) {
    // Atualiza só o PIX/nome no prompt sem reescrever tudo
    let prompt = readFile(path.join(cwd, 'SYSTEM_PROMPT.md'));
    if (body.pixKey !== undefined) {
      prompt = prompt.replace(/Chave PIX:\s*[^\n]+/gi, 'Chave PIX: ' + body.pixKey);
    }
    if (body.nomeDestinatario !== undefined) {
      prompt = prompt.replace(
        /Nome da chave:\s*[^\n(]+/gi,
        'Nome da chave: ' + body.nomeDestinatario + ' (só se ele perguntar)'
      );
    }
    if (prompt) fs.writeFileSync(path.join(cwd, 'SYSTEM_PROMPT.md'), prompt);
  }

  res.json({ ok: true });
});

/** GET /api/instance/:name/qr */
app.get('/api/instance/:name/qr', auth, async (req, res) => {
  const name    = decodeURIComponent(req.params.name);
  const pm2List = await getPm2List();
  const proc    = pm2List.find(p => p.name === name);
  const cwd     = proc?.pm2_env?.pm_cwd || path.join(ROOT_DIR, name);
  const data    = readQr(cwd);
  if (!data) return res.status(404).json({ error: 'QR não disponível' });
  res.json(data);
});

/** POST /api/instance/:name/restart */
app.post('/api/instance/:name/restart', auth, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const r    = await run(`pm2 restart "${name}"`);
  res.json({ ok: r.code === 0, stdout: r.stdout, stderr: r.stderr });
});

/** POST /api/instance/:name/stop */
app.post('/api/instance/:name/stop', auth, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const r    = await run(`pm2 stop "${name}"`);
  res.json({ ok: r.code === 0 });
});

/** POST /api/instance/:name/start */
app.post('/api/instance/:name/start', auth, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const r    = await run(`pm2 start "${name}"`);
  res.json({ ok: r.code === 0 });
});

/** GET /api/instance/:name/logs */
app.get('/api/instance/:name/logs', auth, async (req, res) => {
  const name  = decodeURIComponent(req.params.name);
  const lines = parseInt(req.query.lines) || 150;
  const r     = await run(`pm2 logs "${name}" --lines ${lines} --nostream --raw`);
  res.json({ logs: r.stdout + r.stderr });
});

/** DELETE /api/instance/:name */
app.delete('/api/instance/:name', auth, async (req, res) => {
  const name  = decodeURIComponent(req.params.name);
  const force = req.query.force === '1';
  const pm2List = await getPm2List();
  const proc  = pm2List.find(p => p.name === name);
  const cwd   = proc?.pm2_env?.pm_cwd || path.join(ROOT_DIR, name);
  await run(`pm2 delete "${name}"`);
  if (force && isInstanceDir(cwd)) await run(`rm -rf "${cwd}"`);
  await run('pm2 save');
  res.json({ ok: true });
});

/** POST /api/instances — cria nova instância */
app.post('/api/instances', auth, async (req, res) => {
  const { name, modelName, pixKey, nomeDestinatario, port, prompt } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });

  const dir = path.join(ROOT_DIR, name);
  if (fs.existsSync(dir)) return res.status(409).json({ error: 'Instância já existe' });

  const r = await run(`cp -r "${TEMPLATE_DIR}" "${dir}"`);
  if (r.code !== 0) return res.status(500).json({ error: 'Erro ao copiar template', detail: r.stderr });

  await run(`rm -rf "${path.join(dir, '.wwebjs_auth')}"`);
  await run(`rm -f "${path.join(dir, 'qr.json')}"`);

  const usedPort  = port || await getNextPort();
  const clientId  = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const sessionId = clientId;

  // pacotes.json
  const pacotes = { pixKey: pixKey || '', nome_destinatario: nomeDestinatario || '', modelName };
  fs.writeFileSync(path.join(dir, 'pacotes.json'), JSON.stringify(pacotes, null, 2));

  // prompt
  if (prompt) {
    fs.writeFileSync(path.join(dir, 'SYSTEM_PROMPT.md'), prompt);
  }

  const startCmd = `cd "${dir}" && pm2 start bot-instance.js --name "${name}" -- --port ${usedPort} --clientId "${clientId}" --modelName "${modelName || name}" --sessionId "${sessionId}" --pmName "${name}"`;
  const rs = await run(startCmd);
  await run('pm2 save');

  res.json({ ok: rs.code === 0, port: usedPort, detail: rs.stderr });
});

/** POST /api/instance/:name/duplicate */
app.post('/api/instance/:name/duplicate', auth, async (req, res) => {
  const srcName  = decodeURIComponent(req.params.name);
  const { newName, newPort } = req.body;
  if (!newName) return res.status(400).json({ error: 'newName obrigatório' });

  const pm2List = await getPm2List();
  const srcProc = pm2List.find(p => p.name === srcName);
  if (!srcProc) return res.status(404).json({ error: 'Instância origem não encontrada' });

  const srcDir  = srcProc.pm2_env?.pm_cwd || path.join(ROOT_DIR, srcName);
  const destDir = path.join(ROOT_DIR, newName);
  if (!isInstanceDir(srcDir))  return res.status(404).json({ error: 'Diretório origem inválido' });
  if (fs.existsSync(destDir))  return res.status(409).json({ error: 'Nova instância já existe' });

  const r = await run(`rsync -av --exclude='.wwebjs_auth' --exclude='qr.json' --exclude='*.log' "${srcDir}/" "${destDir}/"`);
  if (r.code !== 0) return res.status(500).json({ error: 'Erro ao copiar', detail: r.stderr });

  // Mantém pacotes.json mas atualiza nome
  let pacotes = {};
  try { pacotes = JSON.parse(readFile(path.join(destDir, 'pacotes.json'))); } catch (_) {}
  fs.writeFileSync(path.join(destDir, 'pacotes.json'), JSON.stringify(pacotes, null, 2));

  const usedPort  = newPort || await getNextPort();
  const clientId  = newName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const sessionId = clientId;
  const modelName = getArg(srcProc.pm2_env?.args, '--modelName') || newName;

  const startCmd = `cd "${destDir}" && pm2 start bot-instance.js --name "${newName}" -- --port ${usedPort} --clientId "${clientId}" --modelName "${modelName}" --sessionId "${sessionId}" --pmName "${newName}"`;
  const rs = await run(startCmd);
  await run('pm2 save');

  res.json({ ok: rs.code === 0, port: usedPort, detail: rs.stderr });
});

/** POST /api/instance/:name/media */
app.post('/api/instance/:name/media', auth, upload.single('file'), async (req, res) => {
  const name    = decodeURIComponent(req.params.name);
  const pm2List = await getPm2List();
  const proc    = pm2List.find(p => p.name === name);
  const cwd     = proc?.pm2_env?.pm_cwd || path.join(ROOT_DIR, name);
  if (!isInstanceDir(cwd)) return res.status(404).json({ error: 'Instância não encontrada' });
  if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });

  const filename = req.body.filename || req.file.originalname;
  fs.writeFileSync(path.join(cwd, filename), req.file.buffer);
  res.json({ ok: true, filename, size: req.file.size });
});

/** GET /api/instance/:name/media */
app.get('/api/instance/:name/media', auth, async (req, res) => {
  const name    = decodeURIComponent(req.params.name);
  const pm2List = await getPm2List();
  const proc    = pm2List.find(p => p.name === name);
  const cwd     = proc?.pm2_env?.pm_cwd || path.join(ROOT_DIR, name);
  if (!isInstanceDir(cwd)) return res.status(404).json({ error: 'Instância não encontrada' });

  const exts  = ['.jpg', '.jpeg', '.png', '.mp3', '.mp4', '.ogg', '.webp'];
  const files = fs.readdirSync(cwd)
    .filter(f => exts.some(e => f.toLowerCase().endsWith(e)))
    .map(f => { const s = fs.statSync(path.join(cwd, f)); return { name: f, size: s.size, mtime: s.mtime }; });
  res.json({ files });
});

/** GET /api/instance/:name/media/:filename */
app.get('/api/instance/:name/media/:filename', auth, async (req, res) => {
  const name     = decodeURIComponent(req.params.name);
  const filename = decodeURIComponent(req.params.filename);
  const pm2List  = await getPm2List();
  const proc     = pm2List.find(p => p.name === name);
  const cwd      = proc?.pm2_env?.pm_cwd || path.join(ROOT_DIR, name);
  const file     = path.join(cwd, filename);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Arquivo não encontrado' });
  res.sendFile(file);
});

/** GET /api/ports/next */
app.get('/api/ports/next', auth, async (req, res) => {
  res.json({ port: await getNextPort() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 HotBot Admin Panel rodando em http://localhost:${PORT}`);
  console.log(`🔑 Senha: ${ADMIN_PASS}`);
});
