import { pgTable, text, serial, integer, timestamp, json } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
