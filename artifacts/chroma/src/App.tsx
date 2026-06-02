import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from 'wouter';
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";

// Pages
import { Home } from "@/pages/home";
import { Feed } from "@/pages/feed";
import { Explore } from "@/pages/explore";
import { Crew } from "@/pages/crew";
import { Projects } from "@/pages/projects";
import { ProjectDetail } from "@/pages/project-detail";
import { ProjectNew } from "@/pages/project-new";
import { Messages } from "@/pages/messages";
import { MessageThread } from "@/pages/message-thread";
import { Profile } from "@/pages/profile";
import { ProfileEdit } from "@/pages/profile-edit";
import { VideoUpload } from "@/pages/video-upload";
import { VideoDetail } from "@/pages/video-detail";
import { SignInPage, SignUpPage } from "@/pages/auth";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  layout: {
    socialButtonsPlacement: "bottom" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(246 100% 68%)",
    colorForeground: "hsl(0 0% 100%)",
    colorMutedForeground: "hsl(0 0% 69%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 9%)",
    colorInput: "hsl(0 0% 20%)",
    colorInputForeground: "hsl(0 0% 100%)",
    colorNeutral: "hsl(0 0% 15%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.25rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#181818] rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold tracking-tight text-white",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-white font-medium",
    formFieldLabel: "text-sm font-medium text-white",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground bg-[#181818]",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-[#3EB489]",
    alertText: "text-destructive font-medium",
    logoBox: "flex items-center justify-center mb-6",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "bg-input hover:bg-input/80 border-0 text-white transition-colors",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10",
    formFieldInput: "bg-input border-border text-white h-10 placeholder:text-muted-foreground",
    footerAction: "flex items-center justify-center gap-2 mt-6",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border-destructive/20 rounded-md",
    otpCodeFieldInput: "bg-input border-border text-white text-lg",
    formFieldRow: "space-y-4",
    main: "flex flex-col gap-6",
  },
};

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/feed" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ProtectedRoute({ component: Component, ...rest }: any) {
  return (
    <Route {...rest}>
      {(params) => (
        <>
          <Show when="signed-in">
            <Component params={params} />
          </Show>
          <Show when="signed-out">
            <Redirect to="/sign-in" />
          </Show>
        </>
      )}
    </Route>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Sign in to Chroma",
            subtitle: "Enter the professional ecosystem",
          },
        },
        signUp: {
          start: {
            title: "Join Chroma",
            subtitle: "The platform for serious filmmakers",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Layout>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <ProtectedRoute path="/feed" component={Feed} />
            <Route path="/explore" component={Explore} />
            <Route path="/crew" component={Crew} />
            <Route path="/projects" component={Projects} />
            <ProtectedRoute path="/projects/:id" component={ProjectDetail} />
            <ProtectedRoute path="/messages" component={Messages} />
            <ProtectedRoute path="/messages/:userId" component={MessageThread} />
            <ProtectedRoute path="/profile/me" component={ProfileEdit} />
            <Route path="/profile/:username" component={Profile} />
            <ProtectedRoute path="/videos/upload" component={VideoUpload} />
            <Route path="/videos/:id" component={VideoDetail} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
