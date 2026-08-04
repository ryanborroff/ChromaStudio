import Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { db, subscriptionsTable, usersTable, videosTable } from "@workspace/db";

export type Entitlements = {
  planId: string;
  storageLimitBytes: number;
  storageUsedBytes: number;
  seatLimit: number | null;
  whiteLabelEmbed: boolean;
  watermarkingEnabled: boolean;
  portfolioQualityEncoding: boolean;
  analyticsHistoryDays: number;
};

type PlanConfig = Omit<Entitlements, "planId" | "storageUsedBytes"> & {
  name: string;
  priceMonthlyCents: number;
  stripePriceId: string | null;
};

export const PLAN_CONFIG: Record<string, PlanConfig> = {
  free: {
    name: "Free",
    priceMonthlyCents: 0,
    stripePriceId: null,
    storageLimitBytes: 100 * 1024 * 1024 * 1024,
    seatLimit: null,
    whiteLabelEmbed: false,
    watermarkingEnabled: false,
    portfolioQualityEncoding: false,
    analyticsHistoryDays: 30,
  },
  creator: {
    name: "Creator",
    priceMonthlyCents: 1900,
    stripePriceId: process.env.STRIPE_CREATOR_PRICE_ID ?? null,
    storageLimitBytes: 1 * 1024 * 1024 * 1024 * 1024,
    seatLimit: null,
    whiteLabelEmbed: false,
    watermarkingEnabled: false,
    portfolioQualityEncoding: false,
    analyticsHistoryDays: 90,
  },
  studio: {
    name: "Studio",
    priceMonthlyCents: 4900,
    stripePriceId: process.env.STRIPE_STUDIO_PRICE_ID ?? null,
    storageLimitBytes: 5 * 1024 * 1024 * 1024 * 1024,
    seatLimit: null,
    whiteLabelEmbed: true,
    watermarkingEnabled: true,
    portfolioQualityEncoding: true,
    analyticsHistoryDays: 365,
  },
};

export function getStripeClient(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  return secret ? new Stripe(secret) : null;
}

export async function getEntitlementsForUser(
  userId: number,
): Promise<Entitlements> {
  const [user] = await db
    .select({ plan: usersTable.plan })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .limit(1);
  const subscriptionInGrace =
    subscription?.status === "canceled" &&
    !!subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd > new Date();
  const activeSubscription =
    subscription &&
    (subscription.status === "active" ||
      subscription.status === "trialing" ||
      subscription.status === "past_due" ||
      subscriptionInGrace);
  const planId = activeSubscription
    ? subscription.planId
    : subscription
      ? "free"
      : (user?.plan ?? "free");
  const plan = PLAN_CONFIG[planId] ?? PLAN_CONFIG.free;
  const [usage] = await db
    .select({
      storageUsedBytes: sql<number>`coalesce(sum(${videosTable.fileSizeBytes}), 0)::bigint`,
    })
    .from(videosTable)
    .where(
      and(
        eq(videosTable.userId, userId),
        eq(videosTable.streamStatus, "ready"),
      ),
    );
  return {
    planId,
    storageUsedBytes: Number(usage?.storageUsedBytes ?? 0),
    ...plan,
  };
}

export function getAppUrl(): string {
  return (
    process.env.APP_URL ??
    (process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : "http://localhost:3000")
  );
}
