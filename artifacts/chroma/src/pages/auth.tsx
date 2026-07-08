import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Clapperboard, Loader2 } from "lucide-react";
import {
  loginWithGoogle,
  loginWithApple,
  loginWithEmail,
  loginWithDevPassword,
  registerWithEmail,
} from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.36 12.78c.02 2.5 2.19 3.33 2.21 3.34-.02.06-.35 1.2-1.15 2.38-.69 1.02-1.41 2.03-2.54 2.05-1.11.02-1.47-.66-2.74-.66-1.27 0-1.66.64-2.71.68-1.09.04-1.92-1.1-2.62-2.12-1.42-2.07-2.51-5.85-1.05-8.41.72-1.27 2.02-2.07 3.43-2.09 1.07-.02 2.09.72 2.74.72.66 0 1.89-.89 3.19-.76.54.02 2.07.22 3.05 1.65-.08.05-1.82 1.06-1.8 3.16M14.28 4.92c.58-.7.97-1.68.86-2.65-.83.03-1.84.55-2.44 1.25-.54.62-1.01 1.61-.88 2.56.93.07 1.87-.47 2.46-1.16" />
    </svg>
  );
}

function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [, setLocation] = useLocation();
  const isSignUp = mode === "sign-up";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showDev, setShowDev] = useState(false);
  const [devPassword, setDevPassword] = useState("");
  const [devError, setDevError] = useState<string | null>(null);
  const [devSubmitting, setDevSubmitting] = useState(false);

  async function handleDevLogin(e: FormEvent) {
    e.preventDefault();
    setDevError(null);
    setDevSubmitting(true);
    try {
      await loginWithDevPassword(devPassword);
      setLocation("/feed");
    } catch (err) {
      setDevError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDevSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isSignUp) {
        await registerWithEmail({ email, password, name: name.trim() || undefined });
        setLocation("/onboarding");
      } else {
        await loginWithEmail({ email, password });
        setLocation("/feed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center py-12 px-4 bg-background">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-[#181818] rounded-2xl w-full overflow-hidden p-8 flex flex-col items-center text-center">
          <Clapperboard className="h-10 w-10 text-primary mb-6" strokeWidth={2.5} />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isSignUp ? "Join ChromaStudio" : "Sign in to ChromaStudio"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isSignUp ? "The platform for serious filmmakers" : "Enter the professional ecosystem"}
          </p>

          <div className="mt-8 w-full flex flex-col gap-3">
            <button
              onClick={loginWithGoogle}
              data-testid="btn-google"
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-white text-[#1f1f1f] font-medium h-11 rounded-md transition-opacity hover:opacity-90"
            >
              <GoogleIcon />
              {isSignUp ? "Sign up with Google" : "Continue with Google"}
            </button>
            <button
              onClick={loginWithApple}
              data-testid="btn-apple"
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-black text-white border border-white/15 font-medium h-11 rounded-md transition-opacity hover:opacity-90"
            >
              <AppleIcon />
              {isSignUp ? "Sign up with Apple" : "Continue with Apple"}
            </button>
          </div>

          <div className="flex items-center gap-3 w-full my-6">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3 text-left">
            {isSignUp && (
              <Input
                type="text"
                placeholder="Name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-name"
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-email"
            />
            <Input
              type="password"
              placeholder={isSignUp ? "Password (min 8 characters)" : "Password"}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              minLength={isSignUp ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-password"
            />

            {error && (
              <p className="text-sm text-red-400" data-testid="text-auth-error">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting} className="h-11" data-testid="btn-submit">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground mt-6">
            {isSignUp ? "Already have an account? " : "New to ChromaStudio? "}
            <a
              href={isSignUp ? "/sign-in" : "/sign-up"}
              className="text-primary hover:underline"
              data-testid="link-toggle-mode"
            >
              {isSignUp ? "Sign in" : "Create one"}
            </a>
          </p>

          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            By continuing you agree to ChromaStudio&apos;s Terms and Privacy Policy.
          </p>

          <div className="mt-6 w-full border-t border-white/10 pt-4">
            {!showDev ? (
              <button
                type="button"
                onClick={() => setShowDev(true)}
                className="text-xs text-muted-foreground hover:text-white transition-colors"
                data-testid="btn-dev-login-toggle"
              >
                Dev login
              </button>
            ) : (
              <form onSubmit={handleDevLogin} className="flex flex-col gap-2 text-left">
                <Input
                  type="password"
                  placeholder="Dev password"
                  autoComplete="off"
                  autoFocus
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  data-testid="input-dev-password"
                />
                {devError && (
                  <p className="text-sm text-red-400" data-testid="text-dev-error">
                    {devError}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={devSubmitting}
                  className="h-10"
                  data-testid="btn-dev-login"
                >
                  {devSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enter
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SignInPage() {
  return <AuthForm mode="sign-in" />;
}

export function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
