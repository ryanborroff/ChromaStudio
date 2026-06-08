import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type DbUser = typeof usersTable.$inferSelect;

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

async function findOrCreateGoogleUser(profile: Profile): Promise<DbUser> {
  const googleId = profile.id;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.googleId, googleId))
    .limit(1);
  if (existing[0]) return existing[0];

  const email = profile.emails?.[0]?.value ?? null;
  const name = profile.displayName?.trim() || "Filmmaker";
  const avatarUrl = profile.photos?.[0]?.value ?? null;

  const base =
    (email?.split("@")[0] || name)
      .replace(/[^a-zA-Z0-9_]/g, "")
      .toLowerCase()
      .slice(0, 20) || "user";

  let username = base;
  for (let attempt = 0; attempt < 100; attempt++) {
    const taken = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    if (!taken[0]) break;
    username = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const [user] = await db
    .insert(usersTable)
    .values({ googleId, email, username, name, profession: "Other", avatarUrl })
    .returning();
  return user;
}

export function configurePassport(): void {
  passport.serializeUser((user, done) => {
    done(null, (user as DbUser).id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .limit(1);
      done(null, user ?? false);
    } catch (err) {
      done(err as Error);
    }
  });

  if (!isGoogleConfigured()) return;

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        // Relative callback is resolved against the incoming request host
        // (works for both the dev domain and the published domain) because
        // `proxy: true` + Express `trust proxy` make passport honor the
        // X-Forwarded-* headers set by the Replit proxy.
        callbackURL: "/api/auth/google/callback",
        proxy: true,
        scope: ["profile", "email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateGoogleUser(profile);
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );
}

export default passport;
