import { Router, type IRouter } from "express";
import passport, { isGoogleConfigured } from "../lib/passport";

const router: IRouter = Router();

// Kick off the Google OAuth flow.
router.get("/auth/google", (req, res, next) => {
  if (!isGoogleConfigured()) {
    res.status(503).json({ error: "Google sign-in is not configured yet" });
    return;
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

// Google redirects back here after the user consents.
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

// End the current session.
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
