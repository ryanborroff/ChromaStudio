import { pgTable, text, serial, integer, timestamp, boolean, unique, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { collectionsTable } from "./collections";
import { projectsTable } from "./projects";

export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  streamUid: text("stream_uid"),
  streamStatus: text("stream_status").notNull().default("pending"),
  streamProvider: text("stream_provider"),
  streamAssetId: text("stream_asset_id"),
  streamPlaybackId: text("stream_playback_id"),
  duration: real("duration"),
  reviewGroupId: text("review_group_id"),
  versionNumber: integer("version_number").notNull().default(1),
  approvalStatus: text("approval_status").notNull().default("pending"),
  approvalDecidedAt: timestamp("approval_decided_at"),
  approvalDecidedBy: text("approval_decided_by"),
  privacy: text("privacy").notNull().default("public"),
  category: text("category").notNull().default("other"),
  collectionId: integer("collection_id").references(() => collectionsTable.id, { onDelete: "set null" }),
  shareEnabled: boolean("share_enabled").notNull().default(false),
  shareToken: text("share_token").unique(),
  sharePasswordHash: text("share_password_hash"),
  tags: text("tags").array().notNull().default([]),
  credits: text("credits"),
  downloadFormats: text("download_formats").array().notNull().default([]),
  isFeatured: boolean("is_featured").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  likeCount: integer("like_count").notNull().default(0),
  ratingSum: integer("rating_sum").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const streamUploadTicketsTable = pgTable("stream_upload_tickets", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  consumed: boolean("consumed").notNull().default(false),
  provider: text("provider").notNull().default("object_storage"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const videoLikesTable = pgTable("video_likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  videoId: integer("video_id").notNull().references(() => videosTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const videoRatingsTable = pgTable(
  "video_ratings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    videoId: integer("video_id").notNull().references(() => videosTable.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("video_ratings_user_video_unique").on(t.userId, t.videoId)],
);

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull().references(() => videosTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviewLinksTable = pgTable("review_links", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  videoGroupId: text("video_group_id").notNull(),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  createdBy: integer("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  passwordHash: text("password_hash"),
  allowDownload: boolean("allow_download").notNull().default(false),
  allowComments: boolean("allow_comments").notNull().default(true),
  revoked: boolean("revoked").notNull().default(false),
});

export const reviewCommentsTable = pgTable("review_comments", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull().references(() => videosTable.id, { onDelete: "cascade" }),
  groupId: text("group_id").notNull(),
  timecodeSeconds: real("timecode_seconds").notNull().default(0),
  body: text("body").notNull(),
  authorType: text("author_type").notNull(),
  authorName: text("author_name").notNull(),
  authorUid: integer("author_uid").references(() => usersTable.id, { onDelete: "set null" }),
  parentCommentId: integer("parent_comment_id"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviewNotificationsTable = pgTable("review_notifications", {
  id: serial("id").primaryKey(),
  recipientUid: integer("recipient_uid").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  projectId: integer("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  videoId: integer("video_id").notNull().references(() => videosTable.id, { onDelete: "cascade" }),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true, createdAt: true, viewCount: true, likeCount: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;

export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;
