import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { pool } from "../db/index.js";
import { config, isProd } from "../config.js";
import {
  createSession,
  createUser,
  destroySession,
  findUserByEmail,
  hashPassword,
  userFromToken,
  verifyPassword,
  type PublicUser,
} from "../auth.js";

export const authRouter = Router();

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().max(80).optional(),
});

/** Bearer-token auth middleware. Sets req.user when valid. */
export function requireUser(req: any, res: any, next: () => void) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  userFromToken(token)
    .then((user) => {
      if (!user) return res.status(401).json({ error: "Not authenticated" });
      req.user = user;
      req.token = token;
      next();
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    });
}

authRouter.post("/signup", async (req, res) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  const { email, password, name } = parsed.data;
  const existing = await findUserByEmail(email);
  if (existing) return res.status(409).json({ error: "An account with that email already exists" });

  const passwordHash = await hashPassword(password);
  const user = await createUser({ email, name, provider: "local", passwordHash });
  const token = await createSession(user.id);
  res.json({ token, user });
});

authRouter.post("/login", async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const { email, password } = parsed.data;

  const { rows } = await pool.query<{ id: string; password_hash: string }>(
    `SELECT id, password_hash FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return res.status(401).json({ error: "Wrong email or password" });
  }
  const token = await createSession(row.id);
  const { rows: userRows } = await pool.query<PublicUser>(
    `SELECT id, email, name, avatar_url, provider, created_at FROM users WHERE id = $1`,
    [row.id],
  );
  res.json({ token, user: userRows[0] });
});

authRouter.post("/logout", requireUser, async (req: any, res) => {
  await destroySession(req.token);
  res.json({ ok: true });
});

authRouter.get("/me", requireUser, (req: any, res) => {
  res.json({ user: req.user });
});

// ---- Magic link -----------------------------------------------------------
// Without SMTP the code is logged to the server console (dev mode). With
// SMTP_URL set, an email would be sent via the SMTP service.
authRouter.post("/magic", async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email" });
  const email = parsed.data.email.toLowerCase();

  const code = randomBytes(3).toString("hex").toUpperCase(); // e.g. "A1B2C3"
  await pool.query(
    `INSERT INTO telegram_codes (code, user_id, expires_at)
     SELECT $1, id, now() + interval '10 minutes' FROM users WHERE email = $2`,
    [code, email],
  );

  if (isProd && config.smtpUrl) {
    // sendMail via SMTP service would go here
  } else {
    console.log(`[magic] code for ${email}: ${code}`);
  }
  res.json({ ok: true, devCode: isProd ? undefined : code });
});

authRouter.post("/magic/verify", async (req, res) => {
  const parsed = z.object({ email: z.string().email(), code: z.string().min(4).max(10) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const email = parsed.data.email.toLowerCase();
  const code = parsed.data.code.toUpperCase();

  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT tc.user_id
       FROM telegram_codes tc
       JOIN users u ON u.id = tc.user_id
      WHERE tc.code = $1 AND u.email = $2 AND tc.expires_at > now()
      LIMIT 1`,
    [code, email],
  );
  if (!rows[0]) return res.status(401).json({ error: "Invalid or expired code" });

  await pool.query(`DELETE FROM telegram_codes WHERE code = $1`, [code]);
  const token = await createSession(rows[0].user_id);
  const { rows: userRows } = await pool.query<PublicUser>(
    `SELECT id, email, name, avatar_url, provider, created_at FROM users WHERE id = $1`,
    [rows[0].user_id],
  );
  res.json({ token, user: userRows[0] });
});

// ---- OAuth ----------------------------------------------------------------
// The callback route lives on THIS server, so the redirect URI must point at
// the backend's public URL (apiUrl), while the post-auth redirect sends the
// browser back to the web app (appUrl).
const redirectUri = (provider: "github" | "google") =>
  `${config.apiUrl}/api/auth/${provider}/callback`;

authRouter.get("/github", (req, res) => {
  if (!config.githubClientId) return res.status(501).json({ error: "GitHub sign-in is not configured" });
  const state = randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, { httpOnly: true, sameSite: "lax" });
  const url =
    `https://github.com/login/oauth/authorize?client_id=${config.githubClientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri("github"))}` +
    `&scope=user:email&state=${state}`;
  res.redirect(url);
});

authRouter.get("/github/callback", async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  if (!code || !state || state !== req.cookies?.oauth_state) {
    return res.status(400).send("OAuth state mismatch");
  }
  if (!config.githubClientId || !config.githubClientSecret) {
    return res.status(501).send("GitHub sign-in is not configured");
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: redirectUri("github"),
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) return res.status(400).send("GitHub OAuth failed");

  const userRes = await fetch("https://api.github.com/user", {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });
  const gh = (await userRes.json()) as { email?: string; login?: string; avatar_url?: string; name?: string | null };
  const emailRes = await fetch("https://api.github.com/user/emails", {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });
  const emails = (await emailRes.json()) as { email: string; primary: boolean; verified: boolean }[];
  const email = gh.email ?? emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email;
  if (!email) return res.status(400).send("No email available from GitHub");

  const user = await createUser({
    email,
    name: gh.name ?? gh.login ?? "",
    provider: "github",
    avatarUrl: gh.avatar_url ?? "",
  });
  const token = await createSession(user.id);
  redirectWithToken(res, token);
});

authRouter.get("/google", (req, res) => {
  if (!config.googleClientId) return res.status(501).json({ error: "Google sign-in is not configured" });
  const state = randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, { httpOnly: true, sameSite: "lax" });
  const url =
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.googleClientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri("google"))}` +
    `&response_type=code&scope=openid%20email%20profile&state=${state}`;
  res.redirect(url);
});

authRouter.get("/google/callback", async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  if (!code || !state || state !== req.cookies?.oauth_state) {
    return res.status(400).send("OAuth state mismatch");
  }
  if (!config.googleClientId || !config.googleClientSecret) {
    return res.status(501).send("Google sign-in is not configured");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: redirectUri("google"),
      grant_type: "authorization_code",
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) return res.status(400).send("Google OAuth failed");

  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });
  const g = (await userRes.json()) as { email?: string; name?: string; picture?: string };
  if (!g.email) return res.status(400).send("No email available from Google");

  const user = await createUser({
    email: g.email,
    name: g.name ?? "",
    provider: "google",
    avatarUrl: g.picture ?? "",
  });
  const token = await createSession(user.id);
  redirectWithToken(res, token);
});

function redirectWithToken(res: any, token: string) {
  // Token rides in the fragment so it never hits server logs.
  res.redirect(`${config.appUrl}/#/auth?token=${encodeURIComponent(token)}`);
}

export function authStatus() {
  return {
    github: Boolean(config.githubClientId && config.githubClientSecret),
    google: Boolean(config.googleClientId && config.googleClientSecret),
    telegram: Boolean(config.telegramBotToken),
    slack: Boolean(config.slackBotToken),
    anthropic: Boolean(config.anthropicApiKey),
  };
}
