import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const endorsementsTable = pgTable(
  "endorsements",
  {
    id: serial("id").primaryKey(),
    fromUserId: integer("from_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    toUserId: integer("to_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("endorsements_from_to_unique").on(t.fromUserId, t.toUserId)],
);

export type Endorsement = typeof endorsementsTable.$inferSelect;
