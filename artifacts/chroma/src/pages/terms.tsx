import { Link } from "wouter";
import { FileText } from "lucide-react";

const LAST_UPDATED = "14 July 2025";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="mb-10">
    <h2 className="text-lg font-bold text-white mb-3">{title}</h2>
    <div className="text-white/60 leading-relaxed space-y-3">{children}</div>
  </section>
);

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary uppercase tracking-widest">
              Terms of Service
            </span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-4">
            Straightforward terms for serious filmmakers.
          </h1>
          <p className="text-white/50 text-sm">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="1. Acceptance">
          <p>
            By creating a Chroma account or using any part of the
            platform, you agree to these Terms of Service. If you do not agree,
            please do not use Chroma.
          </p>
        </Section>

        <Section title="2. Your account">
          <p>
            You are responsible for keeping your login credentials secure. You
            must be at least 16 years old to create an account. One person may
            hold one account; shared or automated accounts are not permitted
            without prior written consent.
          </p>
        </Section>

        <Section title="3. Your content">
          <p>
            You retain full ownership of every video, image, and file you upload
            to Chroma. By uploading content you grant Chroma a
            limited, non-exclusive licence to host, store, and deliver that
            content solely for the purpose of providing the service to you and
            the recipients you designate.
          </p>
          <p>
            We do not claim any ownership rights in your work, and we never use
            your content to train AI or machine-learning models.
          </p>
        </Section>

        <Section title="4. Acceptable use">
          <p>You agree not to upload or share content that:</p>
          <ul className="list-disc list-inside space-y-1.5 ml-1">
            <li>Infringes the intellectual property rights of others</li>
            <li>Contains child sexual abuse material (CSAM)</li>
            <li>Constitutes illegal harassment, threats, or doxxing</li>
            <li>Contains malware, spyware, or harmful code</li>
          </ul>
          <p>
            Violations may result in immediate account suspension and content
            removal. We will cooperate with law enforcement where required.
          </p>
        </Section>

        <Section title="5. Plans and billing">
          <p>
            Chroma offers a free plan and paid Creator, Studio, and Team
            plans billed monthly or annually. Prices are shown on the{" "}
            <Link href="/pricing" className="text-primary hover:underline">
              Pricing page
            </Link>
            . You may cancel at any time; paid plans remain active until the end
            of the billing period.
          </p>
          <p>
            We reserve the right to change pricing with at least 30 days' notice
            to active subscribers.
          </p>
        </Section>

        <Section title="6. Availability">
          <p>
            We aim for high availability but do not guarantee uninterrupted
            service. Planned maintenance will be communicated in advance where
            possible. Chroma is provided "as is" and we disclaim all
            warranties to the extent permitted by law.
          </p>
        </Section>

        <Section title="7. Limitation of liability">
          <p>
            Chroma's total liability to you for any claim arising from
            these terms or your use of the platform is limited to the fees you
            paid in the 12 months before the claim arose. We are not liable for
            indirect, incidental, or consequential damages.
          </p>
        </Section>

        <Section title="8. Termination">
          <p>
            You may delete your account at any time from your account settings.
            We may suspend or terminate accounts that materially breach these
            terms. On termination, your content will be deleted within 30 days
            unless you export it first.
          </p>
        </Section>

        <Section title="9. Governing law">
          <p>
            These terms are governed by the laws of England and Wales. Disputes
            will be resolved in the courts of England and Wales, unless local
            mandatory consumer protection law requires otherwise.
          </p>
        </Section>

        <Section title="10. Changes to these terms">
          <p>
            We may update these terms from time to time. Material changes will
            be communicated via email or an in-app notice at least 14 days
            before taking effect. Continued use after that date constitutes
            acceptance of the revised terms.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Questions about these terms? Email{" "}
            <span className="text-white">legal@chromastudio.app</span>.
          </p>
        </Section>

        <div className="mt-12 pt-8 border-t border-white/08 flex flex-wrap gap-6 text-sm text-white/35">
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link href="/" className="hover:text-white transition-colors">
            Back to Chroma
          </Link>
        </div>
      </div>
    </div>
  );
}
