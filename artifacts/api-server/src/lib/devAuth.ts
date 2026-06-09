import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "./logger";

// Development-only convenience: automatically sign every visitor in as a demo
// user so the full signed-in experience (feed, studio, media library) can be
// explored without an auth provider. This is wired up ONLY when
// NODE_ENV === "development" (see app.ts), so production still requires real auth.
const DEMO_USER_ID = 1;

// When this cookie is present, auto-login is skipped so the signed-out
// experience (landing page, sign-up flow) can be tested in development. Toggled
// via the /api/dev/logout and /api/dev/login endpoints below.
const LOGOUT_COOKIE = "dev_logout";

function hasLogoutCookie(req: Request): boolean {
  const cookie = req.headers.cookie ?? "";
  return cookie.split(";").some((c) => c.trim() === `${LOGOUT_COOKIE}=1`);
}

export async function devAutoLogin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // Honor the dev logout toggle: browse as a signed-out visitor.
  if (hasLogoutCookie(req)) {
    next();
    return;
  }
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

// Development-only endpoints to toggle the signed-out experience in the browser.
// Visit /api/dev/logout to browse as a logged-out visitor; /api/dev/login to
// restore the auto-login. Mounted only when NODE_ENV === "development".
export const devAuthToggleRouter: Router = Router();

devAuthToggleRouter.get("/logout", (req, res, next) => {
  const finish = () => {
    res.cookie(LOGOUT_COOKIE, "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    });
    res.redirect("/");
  };
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

devAuthToggleRouter.get("/login", (_req, res) => {
  res.clearCookie(LOGOUT_COOKIE);
  res.redirect("/");
});
