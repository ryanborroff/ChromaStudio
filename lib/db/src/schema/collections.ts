import { pgTable, text, serial, integer, timestamp, index, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const collectionsTable = pgTable(
  "collections",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"),
    name: text("name").notNull(),
    description: text("description"),
    path: text("path").notNull().default("/"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("collections_user_path_idx").on(t.userId, t.path),
    index("collections_parent_id_idx").on(t.parentId),
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "collections_parent_id_fk",
    }).onDelete("cascade"),
  ],
);

export const insertCollectionSchema = createInsertSchema(collectionsTable).omit({ id: true, createdAt: true });
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Collection = typeof collectionsTable.$inferSelect;
