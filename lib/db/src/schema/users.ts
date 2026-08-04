import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  json,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  googleId: text("google_id").unique(),
  appleId: text("apple_id").unique(),
  email: text("email"),
  passwordHash: text("password_hash"),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  profession: text("profession").notNull().default("Other"),
  location: text("location"),
  bio: text("bio"),
  website: text("website"),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  skills: text("skills").array().notNull().default([]),
  socialLinks: json("social_links"),
  credits: json("credits"),
  isAdmin: boolean("is_admin").notNull().default(false),
  // Subscription tier. "free" = no paid features; anything else (e.g. "creator",
  // "studio") unlocks paid-only features like video sharing & external embedding.
  plan: text("plan").notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const portfoliosTable = pgTable(
  "portfolios",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    bannerUrl: text("banner_url"),
    isPublished: boolean("is_published").notNull().default(false),
    accentColor: text("accent_color").notNull().default("#e8b4a0"),
    layout: text("layout").notNull().default("grid"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("portfolios_owner_id_unique").on(table.ownerId),
    unique("portfolios_handle_unique").on(table.handle),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
