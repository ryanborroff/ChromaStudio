import { Link } from "wouter";
import { ArrowLeft, type LucideIcon } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  features?: string[];
}

export function ComingSoon({ title, description, icon: Icon, features }: ComingSoonProps) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-xl w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
          <Icon className="h-8 w-8 text-primary" />
        </div>

        <span className="inline-block mb-4 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/50">
          Coming soon
        </span>

        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">{title}</h1>
        <p className="text-base text-muted-foreground leading-relaxed mb-8">{description}</p>

        {features && features.length > 0 && (
          <ul className="mx-auto max-w-sm text-left space-y-2 mb-10">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                {f}
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/explore"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-input px-4 py-2 text-sm font-medium text-white hover:border-primary/60 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to browsing
        </Link>
      </div>
    </div>
  );
}
