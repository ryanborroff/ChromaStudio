import { Link } from "wouter";
import {
  Play,
  Users,
  Share2,
  ChevronDown,
  ChevronUp,
  Quote,
} from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const TESTIMONIALS = [
  {
    quote:
      "ChromaStudio replaced my Vimeo Pro account and my LinkedIn profile in one shot. My reel has never looked better, and I've already landed two jobs through direct introductions on the platform.",
    name: "Maya Osei",
    role: "Cinematographer",
    location: "London, UK",
  },
  {
    quote:
      "As a director, finding the right editor used to take weeks of cold emails. ChromaStudio profiles give me everything I need to evaluate someone's work before I even reach out. It's a proper industry tool.",
    name: "Andrés Fuentes",
    role: "Director",
    location: "Madrid, Spain",
  },
  {
    quote:
      "The portfolio presentation is just clean. No ads, no algorithm garbage pushing cat videos after my reel. It feels like it was built for professionals — because it was.",
    name: "Saoirse Brennan",
    role: "Editor",
    location: "Dublin, Ireland",
  },
];

const FAQS = [
  {
    q: "Is ChromaStudio free to use?",
    a: "Yes. The Reel plan is completely free and lets you upload videos, build your profile, and access the community. Creator and Studio plans unlock advanced features like embed links, client delivery, and higher storage limits.",
  },
  {
    q: "What video formats does ChromaStudio support?",
    a: "ChromaStudio supports MP4, MOV, and MKV uploads. Videos are stored and streamed in high quality with no re-encoding artefacts.",
  },
  {
    q: "Can I keep videos private?",
    a: "Absolutely. Every video can be set to public, private, or password-protected. You're always in control of who sees your work.",
  },
  {
    q: "Is my work protected from being copied?",
    a: "Videos are served directly from ChromaStudio's infrastructure and are never publicly downloadable. Password protection and private links give you an extra layer of control.",
  },
  {
    q: "Who is ChromaStudio for?",
    a: "ChromaStudio is built for working film professionals — directors, cinematographers, editors, producers, composers, sound designers, colourists, and students. If you make films, ChromaStudio is your home.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border-b border-white/[0.07] py-5 cursor-pointer"
      onClick={() => setOpen((v) => !v)}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-white font-medium text-sm md:text-base">{q}</p>
        {open ? (
          <ChevronUp className="w-4 h-4 text-white/40 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
        )}
      </div>
      {open && (
        <p className="mt-3 text-sm text-white/50 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-36 md:pt-40 md:pb-52">
        <motion.div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(245,158,11,0.35) 0%, transparent 70%)",
          }}
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
            scale: [1, 1.08, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)",
          }}
          animate={{
            x: [0, -20, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />

        <motion.div
          className="relative z-10 max-w-5xl mx-auto px-6 text-center"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-8 text-white leading-tight sm:whitespace-nowrap"
            style={{ letterSpacing: "-0.03em" }}
          >
            Your{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #fbbf24 0%, #fb923c 100%)",
              }}
            >
              Community
            </span>{" "}
            in Motion
          </motion.h1>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-lg md:text-xl lg:text-2xl text-white/50 max-w-2xl lg:max-w-none mx-auto mb-12 font-medium leading-relaxed lg:whitespace-nowrap"
          >
            The filmmaker-first hosting platform with community at its heart
          </motion.p>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
              style={{
                background:
                  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                boxShadow:
                  "0 4px 24px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
              data-testid="hero-join-btn"
            >
              Join ChromaStudio
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-base font-semibold text-white/80 hover:text-white transition-all hover:-translate-y-0.5"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              data-testid="hero-explore-btn"
            >
              Explore filmmakers
            </Link>
          </motion.div>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs md:text-sm font-medium uppercase tracking-[0.2em] text-white/45"
          >
            {["Discover", "Create", "Host", "Manage", "Stream"].map(
              (step, i) => (
                <span key={step} className="flex items-center gap-x-3">
                  {i > 0 && (
                    <span className="w-1 h-1 rounded-full bg-primary/60" />
                  )}
                  {step}
                </span>
              ),
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section
        className="py-20"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.015)",
        }}
      >
        <motion.div
          className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-5"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger}
        >
          {[
            {
              icon: <Play className="w-5 h-5" />,
              title: "Premium Hosting",
              desc: "Showcase your films in the highest quality without ads, algorithms, or distractions. Let your work speak for itself.",
            },
            {
              icon: <Users className="w-5 h-5" />,
              title: "Professional Community",
              desc: "Connect with verified industry professionals. From DPs to colorists, find exactly who you need for your next shoot.",
            },
            {
              icon: <Share2 className="w-5 h-5" />,
              title: "Client Delivery",
              desc: "Send clients a private download link for cuts, stills, and deliverables — no shared drives, no email attachments.",
            },
          ].map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              transition={{ duration: 0.6, ease: "easeOut" }}
              whileHover={{ y: -4 }}
              className="p-7 rounded-2xl transition-all duration-300 group"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.065)";
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(245,158,11,0.25)";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 8px 32px rgba(0,0,0,0.4)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-primary mb-5"
                style={{ background: "rgba(245,158,11,0.1)" }}
              >
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-white mb-2 tracking-tight">
                {f.title}
              </h3>
              <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
            variants={fadeUp}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30 mb-3">
              From the community
            </p>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              What filmmakers are saying
            </h2>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            {TESTIMONIALS.map((t) => (
              <motion.div
                key={t.name}
                variants={fadeUp}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="p-7 rounded-2xl flex flex-col gap-5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <Quote className="w-6 h-6 text-primary/60 shrink-0" />
                <p className="text-sm text-white/70 leading-relaxed flex-1">
                  "{t.quote}"
                </p>
                <div>
                  <p className="text-white font-semibold text-sm">{t.name}</p>
                  <p className="text-white/35 text-xs mt-0.5">
                    {t.role} · {t.location}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing CTA */}
      <section
        className="py-16 px-6"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.015)",
        }}
      >
        <motion.div
          className="max-w-2xl mx-auto text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.6 }}
          variants={fadeUp}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30 mb-3">
            Plans
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4">
            Start free. Scale as you grow.
          </h2>
          <p className="text-white/45 mb-8 leading-relaxed">
            The Free plan is free forever. Upgrade when you're ready for
            advanced hosting, client delivery, and embed links.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              boxShadow: "0 4px 24px rgba(245,158,11,0.25)",
            }}
          >
            View pricing
          </Link>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
            variants={fadeUp}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30 mb-3">
              Questions
            </p>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Frequently asked
            </h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            {FAQS.map((item) => (
              <motion.div
                key={item.q}
                variants={fadeUp}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <FAQItem q={item.q} a={item.a} />
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-10 text-center">
            <p className="text-white/35 text-sm">
              Still have questions?{" "}
              <Link href="/sign-up" className="text-primary hover:underline">
                Join ChromaStudio
              </Link>{" "}
              and get in touch with the team.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="py-24 px-6 text-center"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <motion.div
          className="max-w-2xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={stagger}
        >
          <motion.h2
            variants={fadeUp}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-4xl md:text-5xl font-black text-white tracking-tight mb-5 leading-tight"
          >
            Your work deserves
            <br />a professional home.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-white/45 mb-8 text-lg"
          >
            Join thousands of filmmakers already on ChromaStudio.
          </motion.p>
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-xl text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                boxShadow:
                  "0 4px 24px rgba(245,158,11,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              Join ChromaStudio — it's free
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-base font-semibold text-white/80 hover:text-white transition-all hover:-translate-y-0.5"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              Explore films
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
