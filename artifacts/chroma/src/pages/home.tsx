import { Link } from "wouter";
import { Play, Users, Briefcase, Clapperboard } from "lucide-react";

export function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-36 md:pt-40 md:pb-52">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30" style={{ background: "radial-gradient(circle, hsl(0 80% 55% / 0.35) 0%, transparent 70%)" }} />
        <div className="absolute top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, hsl(0 80% 55% / 0.2) 0%, transparent 70%)" }} />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-8 text-white leading-tight sm:whitespace-nowrap" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, sans-serif', letterSpacing: "-0.03em" }}>
            Your{" "}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, hsl(0 80% 65%) 0%, hsl(20 90% 65%) 100%)" }}>
              Community
            </span>
            {" "}in Motion
          </h1>

          <p className="text-lg md:text-xl lg:text-2xl text-white/50 max-w-2xl lg:max-w-none mx-auto mb-12 font-medium leading-relaxed lg:whitespace-nowrap">
            A filmmaker-focused hosting platform with community at its heart
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
              Join Chroma
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

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs md:text-sm font-medium uppercase tracking-[0.2em] text-white/45">
            {["Discover", "Create", "Host", "Manage", "Stream"].map((step, i) => (
              <span key={step} className="flex items-center gap-x-3">
                {i > 0 && <span className="w-1 h-1 rounded-full bg-primary/60" />}
                {step}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-5">
          {[
            { icon: <Play className="w-5 h-5" />, title: "Premium Hosting", desc: "Showcase your films in the highest quality without ads, algorithms, or distractions. Let your work speak for itself." },
            { icon: <Users className="w-5 h-5" />, title: "Professional Community", desc: "Connect with verified industry professionals. From DPs to colorists, find exactly who you need for your next shoot." },
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
    </div>
  );
}
