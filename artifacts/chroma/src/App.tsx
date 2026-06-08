import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/useAuth";

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
import { Library } from "@/pages/library";
import { SharePage } from "@/pages/share-page";
import { EmbedPlayer } from "@/pages/embed-player";
import { SignInPage, SignUpPage } from "@/pages/auth";
import { ComingSoon } from "@/pages/coming-soon";
import {
  Radio, Clapperboard, History, FolderOpen, Cloud, Send,
  Code2, BarChart3, ShoppingBag, ShieldCheck, KeyRound,
} from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  return isSignedIn ? <Redirect to="/feed" /> : <Home />;
}

function ProtectedRoute({ component: Component, ...rest }: any) {
  return (
    <Route {...rest}>
      {(params: Record<string, string>) => {
        const { isSignedIn, isLoaded } = useAuth();
        if (!isLoaded) return null;
        return isSignedIn ? <Component params={params} /> : <Redirect to="/sign-in" />;
      }}
    </Route>
  );
}

function AppRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
        <ProtectedRoute path="/feed" component={Feed} />
        <Route path="/explore" component={Explore} />
        <Route path="/crew" component={Crew} />
        <Route path="/projects" component={Projects} />
        <ProtectedRoute path="/projects/new" component={ProjectNew} />
        <ProtectedRoute path="/projects/:id" component={ProjectDetail} />
        <ProtectedRoute path="/messages" component={Messages} />
        <ProtectedRoute path="/messages/:userId" component={MessageThread} />
        <ProtectedRoute path="/profile/me" component={ProfileEdit} />
        <Route path="/profile/:username" component={Profile} />
        <ProtectedRoute path="/videos/upload" component={VideoUpload} />
        <Route path="/videos/:id" component={VideoDetail} />
        <Route path="/watch/:token" component={SharePage} />

        {/* Live & cinema events */}
        <Route path="/live">
          <ComingSoon
            icon={Radio}
            title="Live Streaming"
            description="Broadcast premieres, Q&As and ticketed events to your audience in real time."
            features={["Ticketed live events", "Pay-per-view & free streams", "Automatic replays after the broadcast"]}
          />
        </Route>
        <Route path="/cinema">
          <ComingSoon
            icon={Clapperboard}
            title="Cinema Events"
            description="Host scheduled online screenings and premieres with a true cinema feel."
            features={["Timed screenings & countdowns", "Ticketing and capacity limits", "Audience chat during the show"]}
          />
        </Route>
        <Route path="/live/replays">
          <ComingSoon
            icon={History}
            title="Replays"
            description="Catch up on past live streams and cinema events on demand."
            features={["Full replay library", "Chapter markers", "Viewer analytics per replay"]}
          />
        </Route>

        {/* Studio — creator workspace */}
        <ProtectedRoute path="/studio/portfolio" component={() => (
          <ComingSoon
            icon={FolderOpen}
            title="Portfolio Collections"
            description="Organise your work into showreels and categories with drag-and-drop."
            features={["Showreels & themed collections", "Drag-and-drop ordering", "Featured work on your profile"]}
          />
        )} />
        <ProtectedRoute path="/studio/storage" component={Library} />
        <ProtectedRoute path="/studio/delivery" component={() => (
          <ComingSoon
            icon={Send}
            title="Client Delivery Portal"
            description="Send branded deliveries and collect approvals and feedback in one place."
            features={["Branded delivery pages", "Approvals & timestamped feedback", "Download permissions"]}
          />
        )} />
        <ProtectedRoute path="/studio/embeds" component={() => (
          <ComingSoon
            icon={Code2}
            title="Website Embedding"
            description="Embed your players and galleries on any external website."
            features={["Embeddable video players", "Gallery & showreel embeds", "Custom branding controls"]}
          />
        )} />
        <ProtectedRoute path="/studio/analytics" component={() => (
          <ComingSoon
            icon={BarChart3}
            title="Analytics Dashboard"
            description="A full creator dashboard for views, audience and revenue."
            features={["Views, watch time & retention", "Audience & traffic sources", "Revenue & payout tracking"]}
          />
        )} />

        {/* Store */}
        <Route path="/store">
          <ComingSoon
            icon={ShoppingBag}
            title="Download Store"
            description="Sell and buy LUTs, presets, project files and other creator assets."
            features={["LUTs, presets & project files", "Instant secure downloads", "Creator payouts"]}
          />
        </Route>

        {/* Admin */}
        <ProtectedRoute path="/admin" component={() => (
          <ComingSoon
            icon={ShieldCheck}
            title="Admin Dashboard"
            description="Manage users, moderate content and review reports across the platform."
            features={["User & role management", "Content moderation", "Reports & platform insights"]}
          />
        )} />

        {/* Account security */}
        <ProtectedRoute path="/account/security" component={() => (
          <ComingSoon
            icon={KeyRound}
            title="Account & Security"
            description="Manage your password, email verification and account security."
            features={["Password reset", "Email verification", "Active sessions & devices"]}
          />
        )} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={basePath}>
          <Switch>
            <Route path="/embed/:token" component={EmbedPlayer} />
            <Route>
              <AppRoutes />
            </Route>
          </Switch>
        </WouterRouter>
        <Toaster />
      </QueryClientProvider>
    </TooltipProvider>
  );
}

export default App;
