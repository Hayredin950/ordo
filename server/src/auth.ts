import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { pool } from "./db/index.js";
import { config } from "./config.js";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  provider: string;
  created_at: string;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("scrypt$")) return false;
  const [, salt, hashHex] = stored.split("$");
  if (!salt || !hashHex) return false;
  const candidate = await scrypt(password, salt, KEYLEN);
  const expected = Buffer.from(hashHex, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = newSessionToken();
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), userId, config.sessionDays],
  );
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
}

export async function userFromToken(token: string): Promise<PublicUser | null> {
  if (!token) return null;
  const { rows } = await pool.query<PublicUser>(
    `SELECT u.id, u.email, u.name, u.avatar_url, u.provider, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

export async function findUserByEmail(email: string): Promise<PublicUser | null> {
  const { rows } = await pool.query<PublicUser>(
    `SELECT id, email, name, avatar_url, provider, created_at FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  name?: string;
  provider?: string;
  avatarUrl?: string;
  passwordHash?: string;
}): Promise<PublicUser> {
  const { rows } = await pool.query<PublicUser>(
    `INSERT INTO users (email, name, provider, avatar_url, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, email, name, avatar_url, provider, created_at`,
    [
      input.email.toLowerCase(),
      input.name ?? input.email.split("@")[0] ?? "User",
      input.provider ?? "local",
      input.avatarUrl ?? "",
      input.passwordHash ?? "",
    ],
  );
  return rows[0]!;
}
