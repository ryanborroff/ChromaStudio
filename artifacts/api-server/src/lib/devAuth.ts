import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "./logger";

// Development-only convenience: automatically sign every visitor in as a demo
// user so the full signed-in experience (feed, studio, media library) can be
// explored without an auth provider. This is wired up ONLY when
// NODE_ENV === "development" (see app.ts), so production still requires real auth.
const DEMO_USER_ID = 1;

export async function devAutoLogin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.isAuthenticated?.() && req.user) {
    next();
    return;
  }
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, DEMO_USER_ID))
      .limit(1);
    if (!user) {
      logger.warn({ demoUserId: DEMO_USER_ID }, "devAutoLogin: demo user not found");
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
  } catch (err) {
    next(err as Error);
  }
}
