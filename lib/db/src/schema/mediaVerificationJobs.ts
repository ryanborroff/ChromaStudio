import { bigint, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { mediaAssetsTable } from "./mediaAssets";
import { usersTable } from "./users";

/**
 * Durable, owner-scoped verification work for large originals.
 * This schema is not a worker: jobs remain queued until a separate worker
 * is implemented, deployed and validated.
 */
export const mediaVerificationJobsTable = pgTable(
  "media_verification_jobs",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id").notNull().references(() => mediaAssetsTable.id, { onDelete: "cascade" }),
    ownerId: integer("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    expectedSha256: text("expected_sha256").notNull(),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    bytesProcessed: bigint("bytes_processed", { mode: "number" }).notNull().default(0),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at"),
    lastErrorCode: text("last_error_code"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("media_verification_jobs_asset_unique").on(table.assetId),
    index("media_verification_jobs_owner_status_idx").on(table.ownerId, table.status),
    index("media_verification_jobs_status_lease_idx").on(table.status, table.leaseExpiresAt),
  ],
);

export type MediaVerificationJob = typeof mediaVerificationJobsTable.$inferSelect;
