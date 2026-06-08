import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import { pool } from "@workspace/db";
import passport, { configurePassport } from "./lib/passport";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Behind the Replit reverse proxy — required for secure cookies and for
// passport to resolve the OAuth callback URL from X-Forwarded-* headers.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// The SPA and API are same-origin behind the Replit proxy, so cross-origin
// credentialed requests are limited to our own domains rather than reflected
// back with `origin: true` (which is unsafe when combined with credentials).
const allowedOrigins = (process.env.REPLIT_DOMAINS?.split(",") ?? [])
  .map((d) => `https://${d.trim()}`)
  .filter(Boolean);
app.use(
  cors({ credentials: true, origin: allowedOrigins.length ? allowedOrigins : false }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      // The table is created via SQL migration. `createTableIfMissing` is not
      // used because connect-pg-simple reads its bundled `table.sql` from disk,
      // which is unavailable inside the esbuild output bundle.
      createTableIfMissing: false,
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      // `lax` keeps default CSRF protection for the app's own mutating routes.
      // OAuth still works: Google's callback is a top-level GET redirect (lax
      // cookies are sent), and Apple's cross-site form_post establishes the
      // session on the callback response, which is then sent on the same-site
      // redirect to /feed. Apple relies on signed id_token verification rather
      // than session-stored OAuth state (a lax cookie can't survive the POST).
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  }),
);

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

app.use("/api", router);

export default app;
