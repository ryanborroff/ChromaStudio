import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const deliveriesTable = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  title: text("title").notNull(),
  message: text("message"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deliveryFilesTable = pgTable("delivery_files", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").notNull().references(() => deliveriesTable.id, { onDelete: "cascade" }),
  // Internal storage path (e.g. /objects/uploads/<uuid>). Never exposed to clients.
  objectPath: text("object_path").notNull(),
  name: text("name").notNull(),
  contentType: text("content_type"),
  size: integer("size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeliverySchema = createInsertSchema(deliveriesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type Delivery = typeof deliveriesTable.$inferSelect;

export const insertDeliveryFileSchema = createInsertSchema(deliveryFilesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDeliveryFile = z.infer<typeof insertDeliveryFileSchema>;
export type DeliveryFile = typeof deliveryFilesTable.$inferSelect;
