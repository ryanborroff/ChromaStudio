import {
  useCreateBillingCheckout,
  useCreateBillingPortal,
  useGetBillingEntitlements,
  useListBillingPlans,
} from "@workspace/api-client-react";
import { CreditCard, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function formatStorage(bytes: number) {
  const units = ["GB", "TB"];
  let value = bytes / 1024 ** 3;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function Billing() {
  const { toast } = useToast();
  const plans = useListBillingPlans();
  const entitlements = useGetBillingEntitlements();
  const checkout = useCreateBillingCheckout({
    mutation: {
      onSuccess: ({ url }) => {
        if (url) window.location.assign(url);
      },
      onError: () =>
        toast({
          title: "Checkout unavailable",
          description: "Billing may not be configured yet.",
          variant: "destructive",
        }),
    },
  });
  const portal = useCreateBillingPortal({
    mutation: {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: () =>
        toast({
          title: "Billing portal unavailable",
          description: "Start a subscription before opening the portal.",
          variant: "destructive",
        }),
    },
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <CreditCard className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-black text-white">Billing &amp; plan</h1>
          <p className="text-sm text-muted-foreground">
            Upgrade without risking access to your existing media.
          </p>
        </div>
      </div>

      {entitlements.data && (
        <section className="mb-6 rounded-xl border border-border/50 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-primary">
                Current plan
              </p>
              <h2 className="mt-1 text-2xl font-black capitalize text-white">
                {entitlements.data.planId}
              </h2>
            </div>
            <div className="text-right text-sm text-white/60">
              {formatStorage(entitlements.data.storageUsedBytes)} of{" "}
              {formatStorage(entitlements.data.storageLimitBytes)} used
              <br />
              {entitlements.data.analyticsHistoryDays} days of analytics history
            </div>
          </div>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => portal.mutate()}
            disabled={portal.isPending}
          >
            {portal.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Manage billing
          </Button>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {(plans.data ?? []).map((plan) => {
          const current = entitlements.data?.planId === plan.planId;
          return (
            <section
              key={plan.planId}
              className={`rounded-xl border p-5 ${
                current
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/50 bg-card"
              }`}
            >
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-xl font-bold capitalize text-white">
                {plan.name}
              </h2>
              <p className="mt-1 text-2xl font-black text-white">
                {plan.priceMonthlyCents === 0
                  ? "Free"
                  : `$${(plan.priceMonthlyCents / 100).toFixed(0)}/mo`}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/60">
                <li>{formatStorage(plan.storageLimitBytes)} storage</li>
                <li>{plan.analyticsHistoryDays} days analytics history</li>
                <li>
                  {plan.whiteLabelEmbed
                    ? "White-label embeds"
                    : "Chroma-branded embeds"}
                </li>
              </ul>
              <Button
                className="mt-6 w-full"
                variant={current ? "secondary" : "default"}
                disabled={
                  current || plan.planId === "free" || checkout.isPending
                }
                onClick={() =>
                  checkout.mutate({ data: { planId: plan.planId } })
                }
              >
                {checkout.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {current ? "Current plan" : "Choose plan"}
              </Button>
            </section>
          );
        })}
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-white/45">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        Failed payments keep your media and existing access during the billing
        grace period. Chroma never deletes your videos automatically.
      </p>
    </div>
  );
}
