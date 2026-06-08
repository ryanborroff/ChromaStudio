import { Clapperboard } from "lucide-react";
import { loginWithGoogle } from "@/lib/useAuth";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function AuthCard({ title, subtitle, cta }: { title: string; subtitle: string; cta: string }) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center py-12 px-4 bg-background">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-[#181818] rounded-2xl w-full overflow-hidden p-8 flex flex-col items-center text-center">
          <div className="flex items-center justify-center mb-6">
            <Clapperboard className="h-10 w-10 text-primary" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="text-muted-foreground mt-2">{subtitle}</p>

          <button
            onClick={loginWithGoogle}
            data-testid="btn-google"
            className="mt-8 w-full flex items-center justify-center gap-3 bg-white text-[#1f1f1f] font-medium h-11 rounded-md transition-opacity hover:opacity-90"
          >
            <GoogleIcon />
            {cta}
          </button>

          <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
            By continuing you agree to Chroma&apos;s Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

export function SignInPage() {
  return (
    <AuthCard
      title="Sign in to Chroma"
      subtitle="Enter the professional ecosystem"
      cta="Continue with Google"
    />
  );
}

export function SignUpPage() {
  return (
    <AuthCard
      title="Join Chroma"
      subtitle="The platform for serious filmmakers"
      cta="Sign up with Google"
    />
  );
}
