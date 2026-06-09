import { Router, type RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, pool } from "@workspace/db";
import { logger } from "./logger";

// Development-only auth helpers. In development the app auto-signs-in as a demo
// user so the full signed-in experience loads by default in the preview, letting
// you walk the whole app flow without real OAuth. Visit /api/dev/logout to drop
// to the signed-out, pre-login experience (landing/sign-up), and /api/dev/login
// to jump back in. Wired up ONLY when NODE_ENV === "development" (see app.ts);
// production always requires real auth.
const DEMO_USER_ID = 1;

// Clear all dev sessions on boot so every restart begins from a clean slate
// (auto-login re-establishes the demo session on the first request).
export async function clearDevSessions(): Promise<void> {
  try {
    await pool.query("DELETE FROM user_sessions");
    logger.warn("dev: cleared all sessions on boot");
  } catch (err) {
    logger.error({ err }, "dev: failed to clear sessions on boot");
  }
}

// Auto-login middleware: if the request has no authenticated user, sign in the
// demo user so the signed-in app is what loads by default. Skips /api/dev/* so
// the explicit logout/login toggle routes still work as expected.
export const devAutoLogin: RequestHandler = (req, res, next) => {
  if (req.path.startsWith("/api/dev")) {
    next();
    return;
  }
  if (req.isAuthenticated?.()) {
    next();
    return;
  }
  db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, DEMO_USER_ID))
    .limit(1)
    .then(([user]) => {
      if (!user) {
        next();
        return;
      }
      req.login(user, (err) => {
        if (err) {
          next(err);
          return;
        }
        next();
      });
    })
    .catch((err) => next(err as Error));
};

export const devAuthToggleRouter: Router = Router();

devAuthToggleRouter.get("/login", async (req, res, next) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, DEMO_USER_ID))
      .limit(1);
    if (!user) {
      logger.warn({ demoUserId: DEMO_USER_ID }, "dev login: demo user not found");
      res.redirect("/");
      return;
    }
    req.login(user, (err) => {
      if (err) {
        next(err);
        return;
      }
      res.redirect("/");
    });
  } catch (err) {
    next(err as Error);
  }
});

devAuthToggleRouter.get("/logout", (req, res, next) => {
  const finish = () => res.redirect("/");
  req.logout((err) => {
    if (err) {
      next(err);
      return;
    }
    if (req.session) {
      req.session.destroy(() => finish());
    } else {
      finish();
    }
  });
});
