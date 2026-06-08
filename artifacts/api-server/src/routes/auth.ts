import { Router, type IRouter } from "express";
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

router.post("/auth/register", async (req, res, next) => {
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
