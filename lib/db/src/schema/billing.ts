import {
  boolean,
  bigint,
  integer,
  json,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const billingModelEnum = pgEnum("billing_model", [
  "flat_unlimited_seats",
  "per_seat",
  "usage_based",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
]);

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  planId: text("plan_id").notNull().unique(),
  name: text("name").notNull(),
  priceMonthlyCents: integer("price_monthly_cents").notNull(),
  billingModel: billingModelEnum("billing_model")
    .notNull()
    .default("flat_unlimited_seats"),
  storageLimitBytes: bigint("storage_limit_bytes", {
    mode: "number",
  }).notNull(),
  seatLimit: integer("seat_limit"),
  perSeatPriceCents: integer("per_seat_price_cents"),
  features: json("features").notNull(),
  stripePriceId: text("stripe_price_id"),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: text("plan_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  status: subscriptionStatusEnum("status").notNull().default("trialing"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
