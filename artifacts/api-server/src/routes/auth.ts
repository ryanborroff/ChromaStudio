import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import passport, {
  isGoogleConfigured,
  isAppleConfigured,
  generateUsername,
} from "../lib/passport";

const router: IRouter = Router();

function publicUser(user: typeof usersTable.$inferSelect) {
  const { googleId, appleId, email, passwordHash, ...safe } = user;
  void googleId;
  void appleId;
  void email;
  void passwordHash;
  return safe;
}

/* ---------------------------------- Google --------------------------------- */

router.get("/auth/google", (req, res, next) => {
  if (!isGoogleConfigured()) {
    res.status(503).json({ error: "Google sign-in is not configured yet" });
    return;
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

router.get(
  "/auth/google/callback",
  (req, res, next) => {
    if (!isGoogleConfigured()) {
      res.redirect("/");
      return;
    }
    passport.authenticate("google", { failureRedirect: "/sign-in" })(req, res, next);
  },
  (_req, res) => {
    res.redirect("/feed");
  },
);

/* ---------------------------------- Apple ---------------------------------- */

router.get("/auth/apple", (req, res, next) => {
  if (!isAppleConfigured()) {
    res.status(503).json({ error: "Apple sign-in is not configured yet" });
    return;
  }
  passport.authenticate("apple")(req, res, next);
});

// Apple uses response_mode=form_post, so the callback is a POST.
router.post(
  "/auth/apple/callback",
  (req, res, next) => {
    if (!isAppleConfigured()) {
      res.redirect("/");
      return;
    }
    passport.authenticate("apple", { failureRedirect: "/sign-in" })(req, res, next);
  },
  (_req, res) => {
    res.redirect("/feed");
  },
);

/* ----------------------------- Email + password ---------------------------- */

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

// Temporary per-process abuse protection. A shared Redis/DB limiter is required
// before running multiple API instances; see docs/stage-a-security.md.
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 10;
const authAttempts = new Map<string, { count: number; resetAt: number }>();

function allowAuthAttempt(req: import("express").Request, res: import("express").Response): boolean {
  const now = Date.now();
  if (authAttempts.size > 10000) {
    for (const [key, value] of authAttempts) {
      if (value.resetAt <= now) authAttempts.delete(key);
    }
  }
  const email = typeof req.body?.email === "string"
    ? req.body.email.trim().toLowerCase().slice(0, 255)
    : "unknown";
  const key = `${req.ip ?? "unknown"}:${email}`;
  const current = authAttempts.get(key);
  if (!current || current.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return true;
  }
  if (current.count >= AUTH_MAX_ATTEMPTS) {
    res.setHeader("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
    res.status(429).json({ error: "Too many attempts. Please try again later." });
    return false;
  }
  current.count += 1;
  return true;
}

router.post("/auth/register", async (req, res, next) => {
  if (!allowAuthAttempt(req, res)) return;
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password (min 8 characters)" });
    return;
  }
  const email = parsed.data.email.toLowerCase();

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const name = parsed.data.name?.trim() || email.split("@")[0];
  const username = await generateUsername(email.split("@")[0]);

  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash, username, name, profession: "Other" })
    .returning();

  req.login(user, (err) => {
    if (err) return next(err);
    res.status(201).json(publicUser(user));
  });
});

router.post("/auth/login", async (req, res, next) => {
  if (!allowAuthAttempt(req, res)) return;
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const email = parsed.data.email.toLowerCase();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  req.login(user, (err) => {
    if (err) return next(err);
    res.json(publicUser(user));
  });
});

/* ------------------------------- Dev login --------------------------------- */

// A password-gated shortcut that signs into a shared demo account. Unlike the
// NODE_ENV-gated /api/dev/* helpers, this works in production too, so it is
// protected by the DEV_LOGIN_PASSWORD secret, rate-limited per IP, and compared
// in constant time. Lets the owner skip OAuth setup and walk the signed-in app.
const DEMO_EMAIL = "demo@chroma.app";

async function ensureDemoUser() {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, DEMO_EMAIL))
    .limit(1);
  if (existing) return existing;

  const username = await generateUsername("demo");
  const [user] = await db
    .insert(usersTable)
    .values({
      email: DEMO_EMAIL,
      username,
      name: "Demo Filmmaker",
      profession: "Other",
    })
    .returning();
  return user;
}

const DEV_LOGIN_MAX_ATTEMPTS = 5;
const DEV_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const devLoginAttempts = new Map<string, { count: number; resetAt: number }>();

function devLoginAllowed(ip: string): boolean {
  const now = Date.now();
  const entry = devLoginAttempts.get(ip);
  if (!entry || now > entry.resetAt) return true;
  return entry.count < DEV_LOGIN_MAX_ATTEMPTS;
}

function recordDevLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = devLoginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    devLoginAttempts.set(ip, { count: 1, resetAt: now + DEV_LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

// Hash both inputs to a fixed length first so the comparison is constant-time
// regardless of input length (a raw length check would short-circuit and leak
// the secret length as a timing side-channel).
function timingSafeEqual(a: string, b: string): boolean {
  const ab = crypto.createHash("sha256").update(a).digest();
  const bb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ab, bb);
}

const devLoginSchema = z.object({ password: z.string().min(1).max(200) });

router.post("/auth/dev-login", async (req, res, next) => {
  const expected = process.env.DEV_LOGIN_PASSWORD;
  if (!expected || process.env.NODE_ENV === "production") {
    res.status(503).json({ error: "Dev login is not available" });
    return;
  }

  const ip = req.ip ?? "unknown";
  if (!devLoginAllowed(ip)) {
    res.status(429).json({ error: "Too many attempts. Please try again later." });
    return;
  }

  const parsed = devLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    recordDevLoginFailure(ip);
    res.status(400).json({ error: "Password is required" });
    return;
  }

  if (!timingSafeEqual(parsed.data.password.trim(), expected.trim())) {
    recordDevLoginFailure(ip);
    req.log.warn({ ip }, "dev-login: incorrect password");
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  devLoginAttempts.delete(ip);

  try {
    const user = await ensureDemoUser();
    req.login(user, (err) => {
      if (err) return next(err);
      res.json(publicUser(user));
    });
  } catch (err) {
    next(err as Error);
  }
});

/* ---------------------------------- Logout --------------------------------- */

router.post("/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.status(204).end();
    });
  });
});

export default router;
