import { Link } from "wouter";
import { ArrowRight, Play, Users, Briefcase, Clapperboard } from "lucide-react";

export function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-36 md:pt-40 md:pb-52">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30" style={{ background: "radial-gradient(circle, hsl(0 80% 55% / 0.35) 0%, transparent 70%)" }} />
        <div className="absolute top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, hsl(0 80% 55% / 0.2) 0%, transparent 70%)" }} />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 text-white leading-[0.95]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, sans-serif', letterSpacing: "-0.03em" }}>
            Your{" "}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, hsl(0 80% 65%) 0%, hsl(20 90% 65%) 100%)" }}>
              Community
            </span>
            <br /> in Motion
          </h1>

          <p className="text-xl md:text-2xl text-white/50 max-w-3xl mx-auto mb-12 font-medium leading-relaxed">
            The online filmmaking platform with community at it's heart.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-base font-semibold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, hsl(0 80% 55%) 0%, hsl(0 80% 42%) 100%)",
                boxShadow: "0 4px 24px rgba(229,62,62,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
              data-testid="hero-join-btn"
            >
              Join Chroma <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-base font-semibold text-white/80 hover:text-white transition-all"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
              data-testid="hero-explore-btn"
            >
              Explore Chroma
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-5">
          {[
            { icon: <Play className="w-5 h-5" />, title: "Premium Hosting", desc: "Showcase your films in the highest quality without ads, algorithms, or distractions. Your work speaks for itself." },
            { icon: <Users className="w-5 h-5" />, title: "Elite Network", desc: "Connect with verified industry professionals. From DPs to colorists, find exactly who you need for your next shoot." },
            { icon: <Briefcase className="w-5 h-5" />, title: "Project Board", desc: "Discover unlisted opportunities or crew up your next production efficiently with targeted project boards." },
          ].map(f => (
            <div
              key={f.title}
              className="p-7 rounded-2xl transition-all duration-300 group"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.065)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(229,62,62,0.25)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-primary mb-5" style={{ background: "rgba(229,62,62,0.1)" }}>
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-white mb-2 tracking-tight">{f.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6">
          <div
            className="rounded-3xl p-12 text-center relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(229,62,62,0.12) 0%, rgba(14,14,14,0) 60%)",
              border: "1px solid rgba(229,62,62,0.2)",
            }}
          >
            <h2 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              Every Pixel Earned.
            </h2>
            <p className="text-lg text-white/45 mb-8 max-w-xl mx-auto leading-relaxed">
              Stop competing with cat videos and influencers. Put your portfolio where the industry actually looks.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-xl text-base font-semibold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, hsl(0 80% 55%) 0%, hsl(0 80% 42%) 100%)",
                boxShadow: "0 4px 24px rgba(229,62,62,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              Start Building Your Profile <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
