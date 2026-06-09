import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { getPool, useDatabase } from "./index.js";

export type PanelUser = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
};

const usersFile = path.join(env.DATA_DIR, "users.json");

type FileUser = PanelUser & { passwordHash: string };

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

function rowToUser(row: UserRow): PanelUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString()
  };
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
    `);

    const { rows } = await db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM panel_users");
    if (Number(rows[0]?.count ?? 0) === 0) {
      const email = env.ADMIN_EMAIL || "admin@botmanager.local";
      await createUser({
        email,
        password: env.PANEL_PASSWORD,
        name: env.ADMIN_NAME || "Administrador"
      });
      console.log(`[db] Usuario admin criado: ${email}`);
    }

    await db.query(`
      UPDATE bots SET user_id = (SELECT id FROM panel_users ORDER BY created_at ASC LIMIT 1)
      WHERE user_id IS NULL
    `);
    return;
  }

  const users = await loadFileUsers();
  if (users.length === 0) {
    const email = env.ADMIN_EMAIL || "admin@botmanager.local";
    await createUser({
      email,
      password: env.PANEL_PASSWORD,
      name: env.ADMIN_NAME || "Administrador"
    });
    console.log(`[db] Usuario admin local criado: ${email}`);
  }
}

export async function createUser(input: { email: string; password: string; name: string }) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = hashPassword(input.password);

  if (useDatabase()) {
    const existing = await findUserByEmail(email);
    if (existing) {
      throw new Error("Este e-mail já está cadastrado. Use Entrar para acessar sua conta.");
    }
    try {
      const { rows } = await getPool().query<UserRow>(
        `INSERT INTO panel_users (email, password_hash, name)
         VALUES ($1,$2,$3)
         RETURNING id, email, password_hash, name, created_at`,
        [email, passwordHash, input.name.trim()]
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
      throw error;
    }
  }

  const users = await loadFileUsers();
  if (users.some((u) => u.email === email)) {
    throw new Error("Este e-mail ja esta cadastrado.");
  }
  const user: FileUser = {
    id: randomUUID(),
    email,
    name: input.name.trim(),
    passwordHash,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  await saveFileUsers(users);
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  if (useDatabase()) {
    const { rows } = await getPool().query<UserRow>(
      `SELECT id, email, password_hash, name, created_at FROM panel_users WHERE email = $1`,
      [normalized]
    );
    return rows[0] ?? null;
  }

  const users = await loadFileUsers();
  const hit = users.find((u) => u.email === normalized);
  if (!hit) return null;
  return {
    id: hit.id,
    email: hit.email,
    password_hash: hit.passwordHash,
    name: hit.name,
    created_at: hit.createdAt
  };
}

export async function authenticateUser(email: string, password: string) {
  const row = await findUserByEmail(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return null;
  }
  return rowToUser(row);
}

export async function getUserById(id: string) {
  if (useDatabase()) {
    const { rows } = await getPool().query<UserRow>(
      `SELECT id, email, password_hash, name, created_at FROM panel_users WHERE id = $1`,
      [id]
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  const users = await loadFileUsers();
  const hit = users.find((u) => u.id === id);
  return hit ? { id: hit.id, email: hit.email, name: hit.name, createdAt: hit.createdAt } : null;
}
