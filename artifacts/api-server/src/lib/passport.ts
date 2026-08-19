import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { Strategy as AppleStrategy } from "passport-apple";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type DbUser = typeof usersTable.$inferSelect;

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isAppleConfigured(): boolean {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY,
  );
}

function baseUrl(): string {
  return process.env.PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
}

/**
 * Generate a unique username from a seed (email/name), retrying with a random
 * suffix on collisions.
 */
export async function generateUsername(seed: string | null): Promise<string> {
  const base =
    (seed || "user")
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
  return username;
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
  const username = await generateUsername(email?.split("@")[0] || name);

  const [user] = await db
    .insert(usersTable)
    .values({ googleId, email, username, name, profession: "Other", avatarUrl })
    .returning();
  return user;
}

async function findOrCreateAppleUser(
  appleId: string,
  email: string | null,
  name: string | null,
): Promise<DbUser> {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.appleId, appleId))
    .limit(1);
  if (existing[0]) return existing[0];

  // Link to an existing email-based account if one exists.
  if (email) {
    const byEmail = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (byEmail[0]) {
      const [linked] = await db
        .update(usersTable)
        .set({ appleId })
        .where(eq(usersTable.id, byEmail[0].id))
        .returning();
      return linked;
    }
  }

  const displayName = name?.trim() || "Filmmaker";
  const username = await generateUsername(email?.split("@")[0] || displayName);
  const [user] = await db
    .insert(usersTable)
    .values({ appleId, email, username, name: displayName, profession: "Other" })
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

  if (isGoogleConfigured()) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          // Relative callback resolved against the forwarded host (works for
          // both dev and published domains) thanks to `proxy: true` + Express
          // `trust proxy`. `state: true` binds the callback to a per-login
          // nonce stored in the session to prevent OAuth login CSRF.
          callbackURL: "/api/auth/google/callback",
          proxy: true,
          scope: ["profile", "email"],
          state: true,
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

  if (isAppleConfigured()) {
    passport.use(
      new AppleStrategy(
        {
          clientID: process.env.APPLE_CLIENT_ID!,
          teamID: process.env.APPLE_TEAM_ID!,
          keyID: process.env.APPLE_KEY_ID!,
          privateKeyString: process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
          callbackURL: `${baseUrl()}/api/auth/apple/callback`,
          scope: ["name", "email"],
          passReqToCallback: true,
        },
        async (req, _accessToken, _refreshToken, idToken, _profile, done) => {
          try {
            const appleId = idToken.sub;
            const email = idToken.email ?? null;
            // Apple only sends the user's name on the very first authorization,
            // as a JSON string in the form-posted `user` field.
            let name: string | null = null;
            const rawUser = (req.body as { user?: string } | undefined)?.user;
            if (rawUser) {
              try {
                const parsed = JSON.parse(rawUser) as {
                  name?: { firstName?: string; lastName?: string };
                };
                name = [parsed.name?.firstName, parsed.name?.lastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || null;
              } catch {
                name = null;
              }
            }
            const user = await findOrCreateAppleUser(appleId, email, name);
            done(null, user);
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }
}

export default passport;
