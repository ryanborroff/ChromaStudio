import { Link } from "wouter";
import { ShieldCheck, Lock, EyeOff, Server } from "lucide-react";

const LAST_UPDATED = "14 July 2025";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
    <div className="text-white/60 leading-relaxed space-y-3">{children}</div>
  </section>
);

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary uppercase tracking-widest">Privacy Policy</span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-4">Your work. Your data. Your control.</h1>
          <p className="text-white/50 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>

        {/* AI Training callout */}
        <div
          className="rounded-2xl p-6 mb-10 flex gap-4"
          style={{ background: "rgba(107,91,255,0.08)", border: "1px solid rgba(107,91,255,0.25)" }}
        >
          <EyeOff className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-semibold mb-1">We never train AI on your content.</p>
            <p className="text-white/55 text-sm leading-relaxed">
              Your videos, images, and files are never used to train any AI or machine-learning model — by ChromaStudio or any third party. Your creative work belongs entirely to you.
            </p>
          </div>
        </div>

        {/* Cards row */}
        <div className="grid grid-cols-3 gap-3 mb-12">
          {[
            { icon: Lock, label: "Encrypted in transit and at rest" },
            { icon: Server, label: "Hosted on EU/US infrastructure" },
            { icon: EyeOff, label: "Never sold to advertisers" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="rounded-xl p-4 text-center"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <Icon className="w-4 h-4 text-primary mx-auto mb-2" />
              <p className="text-white/55 text-xs leading-snug">{label}</p>
            </div>
          ))}
        </div>

        <Section title="1. Who we are">
          <p>ChromaStudio ("we", "us") operates the ChromaStudio platform, accessible at chromastudio.app. Questions about this policy can be directed to <span className="text-white">privacy@chromastudio.app</span>.</p>
        </Section>

        <Section title="2. What we collect">
          <p><span className="text-white font-medium">Account information</span> — your name, email address, and profile details you provide when signing up or editing your profile.</p>
          <p><span className="text-white font-medium">Content you upload</span> — videos, images, and files you store on ChromaStudio. This content is yours. We store it to provide the service and for no other purpose.</p>
          <p><span className="text-white font-medium">Usage data</span> — pages visited, features used, and device/browser information collected automatically. This helps us understand how the platform is used and fix problems.</p>
          <p><span className="text-white font-medium">Payment data</span> — if you subscribe to a paid plan, payment is processed by our payment provider. We do not store full card numbers.</p>
        </Section>

        <Section title="3. How we use your data">
          <p>We use your information solely to operate and improve ChromaStudio:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-1">
            <li>Providing video hosting, delivery, and messaging features</li>
            <li>Authenticating your account and keeping it secure</li>
            <li>Sending transactional emails (account verification, delivery notifications)</li>
            <li>Diagnosing bugs and improving performance</li>
          </ul>
          <p>We do <span className="text-white font-medium">not</span> use your data for advertising, profiling, or any form of AI or machine-learning training.</p>
        </Section>

        <Section title="4. Who we share data with">
          <p>We do not sell your data. We share data only with:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-1">
            <li><span className="text-white font-medium">Infrastructure providers</span> — cloud storage and compute needed to run the platform (e.g. Replit, object storage providers)</li>
            <li><span className="text-white font-medium">Payment processors</span> — when you subscribe to a paid plan</li>
            <li><span className="text-white font-medium">Law enforcement</span> — only when required by a valid legal order</li>
          </ul>
        </Section>

        <Section title="5. Your rights (GDPR & beyond)">
          <p>Regardless of where you are, you have the right to:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-1">
            <li><span className="text-white font-medium">Access</span> — request a copy of all personal data we hold about you</li>
            <li><span className="text-white font-medium">Rectification</span> — correct inaccurate data</li>
            <li><span className="text-white font-medium">Erasure</span> — request deletion of your account and all associated data</li>
            <li><span className="text-white font-medium">Portability</span> — export your videos and profile data at any time</li>
            <li><span className="text-white font-medium">Objection</span> — opt out of any processing you did not explicitly consent to</li>
          </ul>
          <p>To exercise any of these rights, email <span className="text-white">privacy@chromastudio.app</span>. We will respond within 30 days.</p>
        </Section>

        <Section title="6. Data retention">
          <p>We keep your data for as long as your account is active. If you delete your account, we remove your personal data and content within 30 days, except where we are required by law to retain it longer.</p>
        </Section>

        <Section title="7. Cookies">
          <p>We use a single session cookie to keep you signed in. We do not use advertising cookies, tracking pixels, or third-party analytics cookies.</p>
        </Section>

        <Section title="8. Security">
          <p>All data is encrypted in transit (TLS) and at rest. Access to production systems is restricted to authorised personnel only. We follow responsible disclosure principles — if you discover a security issue, please contact <span className="text-white">security@chromastudio.app</span>.</p>
        </Section>

        <Section title="9. Children">
          <p>ChromaStudio is intended for users aged 16 and over. We do not knowingly collect data from children under 16. If you believe a child has created an account, please contact us and we will delete it promptly.</p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>We may update this policy from time to time. Material changes will be communicated via email or an in-app notice at least 14 days before taking effect. The date at the top of this page always reflects the most recent revision.</p>
        </Section>

        <div className="mt-12 pt-8 border-t border-white/08 flex flex-wrap gap-6 text-sm text-white/35">
          <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-white transition-colors">Back to ChromaStudio</Link>
        </div>
      </div>
    </div>
  );
}
