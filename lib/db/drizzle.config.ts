import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // user_sessions is created via raw SQL by connect-pg-simple — exclude it
  // so drizzle-kit doesn't try to drop it on push
  tablesFilter: ["!user_sessions"],
});
