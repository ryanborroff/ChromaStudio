import { Link } from "wouter";
import { Check, Film, Clock } from "lucide-react";

type Tier = {
  name: string;
  price: string;
  cadence?: string;
  hosting: string;
  streaming: string;
  tagline: string;
  features: string[];
  cta: string;
  ctaHref: string;
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Reel",
    price: "Free",
    hosting: "2 hours",
    streaming: "10 hrs / mo",
    tagline: "For emerging filmmakers building their first reel.",
    features: [
      "1080p video hosting",
      "Up to 3 active share links",
      "Public profile & portfolio",
      "Community access",
    ],
    cta: "Choose Free Plan",
    ctaHref: "/sign-up",
  },
  {
    name: "Creator",
    price: "$19",
    cadence: "/month",
    hosting: "10 hours",
    streaming: "25 hrs / mo",
    tagline: "For working creators sharing with clients & fans.",
    features: [
      "4K video hosting",
      "Unlimited share links",
      "Password-protected sharing",
      "Embeddable players",
      "Basic analytics",
    ],
    cta: "Choose Creator Plan",
    ctaHref: "/sign-up",
    featured: true,
  },
  {
    name: "Studio",
    price: "$49",
    cadence: "/month",
    hosting: "25 hours",
    streaming: "75 hrs / mo",
    tagline: "For studios delivering work at scale.",
    features: [
      "4K HDR hosting",
      "Client delivery portal",
      "Custom branding",
      "Advanced analytics",
      "Priority support",
    ],
    cta: "Choose Studio Plan",
    ctaHref: "/sign-up",
  },
  {
    name: "Enterprise",
    price: "Custom",
    hosting: "Volume",
    streaming: "Volume",
    tagline: "For teams with bespoke security & scale needs.",
    features: [
      "Volume hosting & streaming",
      "SSO / SAML",
      "Dedicated account manager",
      "Custom SLA & onboarding",
      "Team seats & roles",
    ],
    cta: "Contact Sales",
    ctaHref: "/sign-up",
  },
];

export function Pricing() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-20">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, hsl(0 80% 55% / 0.35) 0%, transparent 70%)" }}
        />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-5 text-white leading-tight whitespace-nowrap"
            style={{ letterSpacing: "-0.03em" }}
          >
            Pricing that scales with your{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(135deg, hsl(0 80% 65%) 0%, hsl(20 90% 65%) 100%)" }}
            >
              footage
            </span>
          </h1>
          <p className="text-lg text-white/50 font-medium leading-relaxed">
            Every plan is metered in video-hours. Host your footage and stream it to
            clients and film fans. Pick the plan that fits how much you shoot and share.
          </p>
        </div>
      </section>

      {/* Tiers */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4 items-stretch">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className="relative flex flex-col p-7 rounded-2xl transition-all duration-300"
              style={{
                background: tier.featured ? "rgba(229,62,62,0.07)" : "rgba(255,255,255,0.04)",
                border: tier.featured
                  ? "1px solid rgba(229,62,62,0.45)"
                  : "1px solid rgba(255,255,255,0.07)",
                boxShadow: tier.featured ? "0 8px 40px rgba(229,62,62,0.18)" : "none",
              }}
              data-testid={`tier-${tier.name.toLowerCase()}`}
            >
              {tier.featured && (
                <span
                  className="absolute -top-3 left-7 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider text-white"
                  style={{ background: "linear-gradient(135deg, hsl(0 80% 55%) 0%, hsl(0 80% 42%) 100%)" }}
                >
                  Most popular
                </span>
              )}

              <h3 className="text-lg font-semibold text-white tracking-tight">{tier.name}</h3>
              <p className="mt-1 text-sm text-white/45 leading-relaxed min-h-[40px]">{tier.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-black text-white tracking-tight">{tier.price}</span>
                {tier.cadence && <span className="text-sm text-white/45 font-medium">{tier.cadence}</span>}
              </div>

              <div className="mt-4 space-y-2">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <Film className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-white">{tier.hosting}</span>
                  <span className="text-sm text-white/45">hosted</span>
                </div>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <Clock className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-white whitespace-nowrap">{tier.streaming}</span>
                  <span className="text-sm text-white/45">streaming</span>
                </div>
              </div>

              <ul className="mt-6 space-y-3 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                    <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={tier.ctaHref}
                className="mt-7 inline-flex items-center justify-center h-11 px-5 rounded-xl text-sm font-semibold transition-all"
                style={
                  tier.featured
                    ? {
                        background: "linear-gradient(135deg, hsl(0 80% 55%) 0%, hsl(0 80% 42%) 100%)",
                        color: "white",
                        boxShadow: "0 4px 24px rgba(229,62,62,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                      }
                    : {
                        background: "rgba(255,255,255,0.07)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.9)",
                      }
                }
                data-testid={`cta-${tier.name.toLowerCase()}`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-white/40 max-w-2xl mx-auto px-6">
          Need more room? Extra hosting is{" "}
          <span className="text-white/60 font-medium">$1.50 / video-hour</span> and streaming is{" "}
          <span className="text-white/60 font-medium">$0.30 / hour</span>, billed only as you use it.
        </p>
        <p className="mt-2 text-center text-sm text-white/40">
          All plans are billed in USD. Upgrade, downgrade or cancel anytime.
        </p>
      </section>
    </div>
  );
}
