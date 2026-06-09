import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, pool } from "@workspace/db";
import { logger } from "./logger";

// Development-only auth helpers. In development the app starts signed OUT so the
// public, pre-login experience (landing page, sign-up flow, public Explore) is
// what loads by default. Visit /api/dev/login to jump into a demo account and
// explore the full signed-in experience, and /api/dev/logout to leave it again.
// This is wired up ONLY when NODE_ENV === "development" (see app.ts); production
// always requires real auth.
const DEMO_USER_ID = 1;

// Clear all dev sessions on boot so every restart begins signed out, regardless
// of any session cookie left in the browser from a previous run.
export async function clearDevSessions(): Promise<void> {
  try {
    await pool.query("DELETE FROM user_sessions");
    logger.warn("dev: cleared all sessions — app starts signed out");
  } catch (err) {
    logger.error({ err }, "dev: failed to clear sessions on boot");
  }
}

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
