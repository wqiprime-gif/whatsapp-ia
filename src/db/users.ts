import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { isPlatformOwner } from "../lib/settings.js";
import { loadBots, botsFile } from "../bots.js";
import { getPool, useDatabase } from "./index.js";

export type PanelUser = {
  id: string;
  username: string;
  email: string;
  name: string;
  createdAt: string;
  avatarUrl?: string;
};

type UserRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
};

const usersFile = path.join(env.DATA_DIR, "users.json");

type FileUser = PanelUser & { passwordHash: string; avatarUrl?: string };

export function normalizeUsername(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 32);
}

function usernameFromEmail(email: string) {
  const base = normalizeUsername(email.split("@")[0] || "user");
  return base.length >= 3 ? base : "user";
}

async function loadFileUsers(): Promise<FileUser[]> {
  try {
    const raw = await fs.readFile(usersFile, "utf8");
    return JSON.parse(raw) as FileUser[];
  } catch {
    return [];
  }
}

async function saveFileUsers(users: FileUser[]) {
  await fs.mkdir(env.DATA_DIR, { recursive: true });
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
}

function rowToUser(row: UserRow & { avatar_url?: string }): PanelUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
    avatarUrl: row.avatar_url ?? ""
  };
}

async function backfillUsernames() {
  const adminUsername = normalizeUsername(env.ADMIN_USERNAME || "admin");

  if (useDatabase()) {
    const db = getPool();
    const { rows } = await db.query<{ id: string; email: string; username: string | null }>(
      `SELECT id, email, username FROM panel_users`
    );
    const used = new Set(
      rows.map((r) => (r.username ? normalizeUsername(r.username) : "")).filter(Boolean)
    );

    for (const row of rows) {
      if (row.username && normalizeUsername(row.username).length >= 3) continue;
      const isAdmin = row.email?.trim().toLowerCase() === (env.ADMIN_EMAIL || "").trim().toLowerCase();
      let candidate = isAdmin ? adminUsername : usernameFromEmail(row.email || "user");
      if (!candidate || candidate.length < 3) candidate = `user${row.id.slice(0, 6)}`;
      while (used.has(candidate)) {
        candidate = `${candidate.slice(0, 24)}_${row.id.slice(0, 4)}`;
      }
      used.add(candidate);
      await db.query(`UPDATE panel_users SET username = $1 WHERE id = $2`, [candidate, row.id]);
    }
    return;
  }

  const users = await loadFileUsers();
  const used = new Set(users.map((u) => normalizeUsername(u.username || "")).filter(Boolean));
  let changed = false;

  for (const user of users) {
    if (user.username && normalizeUsername(user.username).length >= 3) continue;
    const isAdmin = user.email?.trim().toLowerCase() === (env.ADMIN_EMAIL || "").trim().toLowerCase();
    let candidate = isAdmin ? adminUsername : usernameFromEmail(user.email || "user");
    if (!candidate || candidate.length < 3) candidate = `user${user.id.slice(0, 6)}`;
    while (used.has(candidate)) {
      candidate = `${candidate.slice(0, 24)}_${user.id.slice(0, 4)}`;
    }
    used.add(candidate);
    user.username = candidate;
    changed = true;
  }

  if (changed) await saveFileUsers(users);
}

async function syncPlatformOwnerAccount() {
  const adminUsername = normalizeUsername(env.ADMIN_USERNAME || "admin");
  const adminEmail = (env.ADMIN_EMAIL || "admin@botmanager.local").trim().toLowerCase();
  const passwordHash = hashPassword(env.PANEL_PASSWORD);
  const adminName = env.ADMIN_NAME || "Administrador";

  const resolveOwnerRow = async (): Promise<UserRow | null> => {
    let row = await findUserByUsername(adminUsername);
    if (row) return row;

    row = await findUserByEmail(adminEmail);
    if (row) return row;

    if (useDatabase()) {
      const { rows } = await getPool().query<UserRow>(
        `SELECT id, username, email, password_hash, name, created_at FROM panel_users ORDER BY created_at ASC`
      );
      const owner = rows.find((r) => isPlatformOwner({ username: r.username, email: r.email }));
      if (owner) return owner;
      if (rows.length === 1) return rows[0];
      return null;
    }

    const users = await loadFileUsers();
    const owner = users.find((u) => isPlatformOwner({ username: u.username, email: u.email }));
    if (owner) {
      return {
        id: owner.id,
        username: owner.username,
        email: owner.email,
        password_hash: owner.passwordHash,
        name: owner.name,
        created_at: owner.createdAt
      };
    }
    if (users.length === 1) {
      const only = users[0];
      return {
        id: only.id,
        username: only.username,
        email: only.email,
        password_hash: only.passwordHash,
        name: only.name,
        created_at: only.createdAt
      };
    }
    return null;
  };

  if (useDatabase()) {
    const db = getPool();
    const row = await resolveOwnerRow();
    if (!row) {
      await createUser({
        username: adminUsername,
        email: adminEmail,
        password: env.PANEL_PASSWORD,
        name: adminName
      });
      console.log(`[db] Conta admin criada: ${adminUsername}`);
      return;
    }

    await db.query(
      `UPDATE panel_users
       SET username = $1 || '_' || LEFT(REPLACE(id::text, '-', ''), 4)
       WHERE LOWER(username) = LOWER($2) AND id <> $3`,
      [adminUsername, adminUsername, row.id]
    );

    await db.query(`UPDATE panel_users SET username = $1, password_hash = $2, name = $3 WHERE id = $4`, [
      adminUsername,
      passwordHash,
      adminName,
      row.id
    ]);
    console.log(`[db] Admin sincronizado: usuario="${adminUsername}" (senha = PANEL_PASSWORD)`);
    return;
  }

  const users = await loadFileUsers();
  const row = await resolveOwnerRow();
  if (!row) {
    await createUser({
      username: adminUsername,
      email: adminEmail,
      password: env.PANEL_PASSWORD,
      name: adminName
    });
    console.log(`[db] Conta admin local criada: ${adminUsername}`);
    return;
  }

  for (const user of users) {
    if (user.id === row.id) {
      user.username = adminUsername;
      user.passwordHash = passwordHash;
      user.name = adminName;
    } else if (normalizeUsername(user.username) === adminUsername) {
      user.username = `${adminUsername}_${user.id.slice(0, 4)}`;
    }
  }
  await saveFileUsers(users);
  console.log(`[db] Admin local sincronizado: usuario="${adminUsername}" (senha = PANEL_PASSWORD)`);
}

export async function initUsersSchema() {
  if (useDatabase()) {
    const db = getPool();
    await db.query(`
      CREATE TABLE IF NOT EXISTS panel_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        user_id UUID PRIMARY KEY REFERENCES panel_users(id) ON DELETE CASCADE,
        openai_api_key_encrypted TEXT,
        openai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
        ai_provider TEXT NOT NULL DEFAULT 'openai',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_provider TEXT NOT NULL DEFAULT 'openai';

      ALTER TABLE bots ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES panel_users(id) ON DELETE CASCADE;
      ALTER TABLE bots ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
      ALTER TABLE bots ADD COLUMN IF NOT EXISTS pix_recipient_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE bots ADD COLUMN IF NOT EXISTS audio_library JSONB NOT NULL DEFAULT '[]';
      ALTER TABLE panel_users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
      ALTER TABLE panel_users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
    `);

    const { rows } = await db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM panel_users");
    if (Number(rows[0]?.count ?? 0) === 0) {
      const username = normalizeUsername(env.ADMIN_USERNAME || "admin");
      const email = env.ADMIN_EMAIL || "admin@botmanager.local";
      await createUser({
        username,
        email,
        password: env.PANEL_PASSWORD,
        name: env.ADMIN_NAME || "Administrador"
      });
      console.log(`[db] Usuario admin criado: ${username}`);
    }

    await backfillUsernames();
    await syncPlatformOwnerAccount();

    await db.query(`
      UPDATE bots SET user_id = (SELECT id FROM panel_users ORDER BY created_at ASC LIMIT 1)
      WHERE user_id IS NULL
    `);

    await migrateFileUsersToPostgres();
    const { initNotificationPrefsSchema } = await import("./notification-prefs.js");
    await initNotificationPrefsSchema();
    return;
  }

  const users = await loadFileUsers();
  if (users.length === 0) {
    const username = normalizeUsername(env.ADMIN_USERNAME || "admin");
    const email = env.ADMIN_EMAIL || "admin@botmanager.local";
    await createUser({
      username,
      email,
      password: env.PANEL_PASSWORD,
      name: env.ADMIN_NAME || "Administrador"
    });
    console.log(`[db] Usuario admin local criado: ${username}`);
  } else {
    await backfillUsernames();
  }
  await syncPlatformOwnerAccount();
}

/** Contas criadas em modo arquivo (users.json no volume) antes do Postgres. */
async function migrateFileUsersToPostgres() {
  const fileUsers = await loadFileUsers();
  if (fileUsers.length === 0) return;

  let migrated = 0;
  for (const u of fileUsers) {
    const existing = await findUserByEmail(u.email);
    if (existing) continue;
    try {
      const username = normalizeUsername(u.username || usernameFromEmail(u.email));
      await getPool().query(
        `INSERT INTO panel_users (id, username, email, password_hash, name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
         ON CONFLICT (email) DO NOTHING`,
        [u.id, username, u.email, u.passwordHash, u.name, u.createdAt]
      );
      await getPool().query(
        `INSERT INTO user_settings (user_id, openai_model) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
        [u.id, env.OPENAI_MODEL]
      );
      migrated++;
    } catch {
      // ignora usuario invalido
    }
  }
  if (migrated > 0) {
    console.log(`[db] Migrados ${migrated} usuario(s) de users.json para Postgres`);
  }
}

export async function createUser(input: {
  username: string;
  email: string;
  password: string;
  name: string;
}) {
  const email = input.email.trim().toLowerCase();
  const username = normalizeUsername(input.username);
  if (username.length < 3) {
    throw new Error("Usuário deve ter pelo menos 3 letras ou números.");
  }
  const passwordHash = hashPassword(input.password);

  if (useDatabase()) {
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      throw new Error("Este usuário já está em uso. Escolha outro.");
    }
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      throw new Error("Este e-mail já está cadastrado. Use Entrar para acessar sua conta.");
    }
    try {
      const { rows } = await getPool().query<UserRow>(
        `INSERT INTO panel_users (username, email, password_hash, name)
         VALUES ($1,$2,$3,$4)
         RETURNING id, username, email, password_hash, name, created_at`,
        [username, email, passwordHash, input.name.trim()]
      );
      const user = rowToUser(rows[0]);
      await getPool().query(
        `INSERT INTO user_settings (user_id, openai_model) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
        [user.id, env.OPENAI_MODEL]
      );
      return user;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/panel_users_email_key|duplicate key.*email/i.test(msg)) {
        throw new Error("Este e-mail já está cadastrado. Use Entrar para acessar sua conta.");
      }
      if (/panel_users_username_key|duplicate key.*username/i.test(msg)) {
        throw new Error("Este usuário já está em uso. Escolha outro.");
      }
      throw error;
    }
  }

  const users = await loadFileUsers();
  if (users.some((u) => normalizeUsername(u.username) === username)) {
    throw new Error("Este usuario ja esta em uso.");
  }
  if (users.some((u) => u.email === email)) {
    throw new Error("Este e-mail ja esta cadastrado.");
  }
  const user: FileUser = {
    id: randomUUID(),
    username,
    email,
    name: input.name.trim(),
    passwordHash,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  await saveFileUsers(users);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt
  };
}

export async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  if (useDatabase()) {
    const { rows } = await getPool().query<UserRow>(
      `SELECT id, username, email, password_hash, name, created_at FROM panel_users WHERE email = $1`,
      [normalized]
    );
    return rows[0] ?? null;
  }

  const users = await loadFileUsers();
  const hit = users.find((u) => u.email === normalized);
  if (!hit) return null;
  return {
    id: hit.id,
    username: hit.username,
    email: hit.email,
    password_hash: hit.passwordHash,
    name: hit.name,
    created_at: hit.createdAt
  };
}

export async function findUserByUsername(username: string) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;

  if (useDatabase()) {
    const { rows } = await getPool().query<UserRow>(
      `SELECT id, username, email, password_hash, name, created_at FROM panel_users WHERE LOWER(username) = $1`,
      [normalized]
    );
    return rows[0] ?? null;
  }

  const users = await loadFileUsers();
  const hit = users.find((u) => normalizeUsername(u.username) === normalized);
  if (!hit) return null;
  return {
    id: hit.id,
    username: hit.username,
    email: hit.email,
    password_hash: hit.passwordHash,
    name: hit.name,
    created_at: hit.createdAt
  };
}

export async function authenticateUser(username: string, password: string) {
  const row = await findUserByUsername(username);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return null;
  }
  return rowToUser(row);
}

export async function getUserById(id: string): Promise<PanelUser | null> {
  if (useDatabase()) {
    const { rows } = await getPool().query<UserRow & { avatar_url?: string }>(
      `SELECT id, username, email, password_hash, name, created_at, avatar_url FROM panel_users WHERE id = $1`,
      [id]
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  const users = await loadFileUsers();
  const hit = users.find((u) => u.id === id);
  return hit
    ? {
        id: hit.id,
        username: hit.username,
        email: hit.email,
        name: hit.name,
        createdAt: hit.createdAt,
        avatarUrl: hit.avatarUrl ?? ""
      }
    : null;
}

export type PlatformUserSummary = PanelUser & {
  botCount: number;
  warmingChipCount: number;
  isOwner: boolean;
};

export async function listPlatformUsers(): Promise<PlatformUserSummary[]> {
  if (useDatabase()) {
    const { rows } = await getPool().query<{
      id: string;
      username: string;
      email: string;
      name: string;
      created_at: string;
      avatar_url?: string;
      bot_count: string;
      warming_chip_count: string;
    }>(`
      SELECT u.id, u.username, u.email, u.name, u.created_at, u.avatar_url,
             COUNT(DISTINCT b.id)::text AS bot_count,
             COALESCE(SUM(
               CASE WHEN cs.status = 'active' THEN jsonb_array_length(cs.bot_ids) ELSE 0 END
             ), 0)::text AS warming_chip_count
      FROM panel_users u
      LEFT JOIN bots b ON b.user_id = u.id
      LEFT JOIN chip_warm_sessions cs ON cs.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      name: row.name,
      createdAt: new Date(row.created_at).toISOString(),
      avatarUrl: row.avatar_url ?? "",
      botCount: Number(row.bot_count || 0),
      warmingChipCount: Number(row.warming_chip_count || 0),
      isOwner: isPlatformOwner({ username: row.username, email: row.email })
    }));
  }

  const users = await loadFileUsers();
  const bots = await loadBots();
  let warmingByUser: Record<string, number> = {};
  try {
    const { countWarmingChipsByUser } = await import("../lib/chip-warmer.js");
    warmingByUser = await countWarmingChipsByUser();
  } catch {
    warmingByUser = {};
  }
  return users
    .map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt,
      avatarUrl: u.avatarUrl ?? "",
      botCount: bots.filter((b) => b.userId === u.id).length,
      warmingChipCount: warmingByUser[u.id] ?? 0,
      isOwner: isPlatformOwner({ username: u.username, email: u.email })
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Remove conta + instâncias. Retorna IDs dos bots removidos (para parar processos WA). */
export async function deletePlatformUser(targetUserId: string, actor: { id: string }): Promise<string[]> {
  if (targetUserId === actor.id) {
    throw new Error("Você não pode excluir sua própria conta por aqui.");
  }

  const target = await getUserById(targetUserId);
  if (!target) throw new Error("Usuário não encontrado.");
  if (isPlatformOwner({ username: target.username, email: target.email })) {
    throw new Error("Não é possível excluir a conta do administrador da plataforma.");
  }

  const bots = await loadBots(targetUserId);
  const botIds = bots.map((b) => b.id);

  const { purgeWarmDataForUser } = await import("../lib/chip-warmer.js");
  await purgeWarmDataForUser(targetUserId);

  if (useDatabase()) {
    await getPool().query(`DELETE FROM panel_users WHERE id = $1`, [targetUserId]);
    return botIds;
  }

  const users = await loadFileUsers();
  await saveFileUsers(users.filter((u) => u.id !== targetUserId));

  const allBots = await loadBots();
  await fs.writeFile(
    botsFile,
    JSON.stringify(
      allBots.filter((b) => b.userId !== targetUserId),
      null,
      2
    )
  );

  const settingsPath = path.join(env.DATA_DIR, `settings-${targetUserId}.json`);
  try {
    await fs.unlink(settingsPath);
  } catch {
    // ignora se não existir
  }

  return botIds;
}

export async function updateUserProfile(
  id: string,
  input: { name?: string; avatarUrl?: string; password?: string }
) {
  if (useDatabase()) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (input.name?.trim()) {
      sets.push(`name = $${i++}`);
      vals.push(input.name.trim());
    }
    if (input.avatarUrl !== undefined) {
      sets.push(`avatar_url = $${i++}`);
      vals.push(input.avatarUrl);
    }
    if (input.password) {
      sets.push(`password_hash = $${i++}`);
      vals.push(hashPassword(input.password));
    }
    if (sets.length === 0) return;
    vals.push(id);
    await getPool().query(`UPDATE panel_users SET ${sets.join(", ")} WHERE id = $${i}`, vals);
    return;
  }

  const users = await loadFileUsers();
  const hit = users.find((u) => u.id === id);
  if (!hit) return;
  if (input.name?.trim()) hit.name = input.name.trim();
  if (input.avatarUrl !== undefined) hit.avatarUrl = input.avatarUrl;
  if (input.password) hit.passwordHash = hashPassword(input.password);
  await saveFileUsers(users);
}
