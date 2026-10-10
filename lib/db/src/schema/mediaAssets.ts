import { bigint, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Private source media, independent of its use in review or distribution.
 *
 * No cascade from videos: deleting a presentation must never delete its source.
 * Storage objects are not deleted when a database row is removed.
 */
export const mediaAssetsTable = pgTable(
  "media_assets",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    checksumSha256: text("checksum_sha256"),
    // pending -> uploaded -> verified; failed is terminal until retried.
    status: text("status").notNull().default("pending"),
    verifiedAt: timestamp("verified_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // One catalogue record per owner/object, including on upload retries.
    uniqueIndex("media_assets_owner_storage_key_unique").on(table.ownerId, table.storageKey),
    index("media_assets_owner_created_idx").on(table.ownerId, table.createdAt),
    index("media_assets_owner_status_idx").on(table.ownerId, table.status),
  ],
);

export type MediaAsset = typeof mediaAssetsTable.$inferSelect;
export type InsertMediaAsset = typeof mediaAssetsTable.$inferInsert;
