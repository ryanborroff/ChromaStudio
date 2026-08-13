import Stripe from "stripe";

export type BillablePlan = "creator" | "studio" | "team";

export const BILLABLE_PLANS: BillablePlan[] = ["creator", "studio", "team"];

const PLAN_PRICE_ENV_VARS: Record<BillablePlan, string> = {
  creator: "STRIPE_PRICE_CREATOR",
  studio: "STRIPE_PRICE_STUDIO",
  team: "STRIPE_PRICE_TEAM",
};

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// Lazily constructed so importing this module doesn't throw when Stripe isn't
// configured yet (e.g. local dev without keys) — only routes that actually
// need Stripe pay the cost of this check.
export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

// Price IDs live in env vars (created manually in the Stripe dashboard) rather
// than being provisioned by this codebase — see chroma-devin-prompts.md for
// the one-time setup steps.
export function getPriceIdForPlan(plan: BillablePlan): string | null {
  return process.env[PLAN_PRICE_ENV_VARS[plan]] || null;
}

// Reverse lookup used by the webhook handler to map a Stripe subscription's
// price back to our internal plan name.
export function getPlanForPriceId(priceId: string): BillablePlan | null {
  return BILLABLE_PLANS.find((plan) => getPriceIdForPlan(plan) === priceId) ?? null;
}
