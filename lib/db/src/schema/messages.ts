import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  recipientId: integer("recipient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull().default(""),
  // Optional file attachment (any file type). attachmentUrl is the API serving URL.
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  attachmentType: text("attachment_type"),
  attachmentSize: integer("attachment_size"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true, read: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
