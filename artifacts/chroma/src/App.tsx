import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/lib/useAuth";

// Pages
import { Home } from "@/pages/home";
import { Feed } from "@/pages/feed";
import { Explore } from "@/pages/explore";
import { Saved } from "@/pages/saved";
import { History as HistoryPage } from "@/pages/history";
import { Messages } from "@/pages/messages";
import { MessageThread } from "@/pages/message-thread";
import { Profile } from "@/pages/profile";
import { ProfileEdit } from "@/pages/profile-edit";
import { VideoUpload } from "@/pages/video-upload";
import { VideoDetail } from "@/pages/video-detail";
import { Library } from "@/pages/library";
import { MediaWarehouse } from "@/pages/media-warehouse";
import { Pricing } from "@/pages/pricing";
import { SharePage } from "@/pages/share-page";
import { EmbedPlayer } from "@/pages/embed-player";
import { Deliveries } from "@/pages/deliveries";
import { DeliveryManage } from "@/pages/delivery-manage";
import { DeliveryPage } from "@/pages/delivery-page";
import { SignInPage, SignUpPage } from "@/pages/auth";
import { PrivacyPolicy } from "@/pages/privacy";
import { TermsOfService } from "@/pages/terms";
import { Onboarding } from "@/pages/onboarding";
import { ComingSoon } from "@/pages/coming-soon";
import { AdminDashboard } from "@/pages/admin";
import { ReviewPage } from "@/pages/review-page";
import { StorageConfidence } from "@/pages/storage-confidence";
import {
  Radio,
  Clapperboard,
  History,
  FolderOpen,
  Code2,
  BarChart3,
  ShoppingBag,
  ShieldCheck,
  Users,
} from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AuthLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null; // Home page has its own hero — no spinner needed here
  return isSignedIn ? <Redirect to="/feed" /> : <Home />;
}

function ProtectedRoute({ component: Component, ...rest }: any) {
  return (
    <Route {...rest}>
      {(params: Record<string, string>) => {
        const { isSignedIn, isLoaded } = useAuth();
        if (!isLoaded) return <AuthLoader />;
        return isSignedIn ? (
          <Component params={params} />
        ) : (
          <Redirect to="/sign-in" />
        );
      }}
    </Route>
  );
}

function AppRoutes() {
  return (
    <ErrorBoundary>
    <Layout>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
        <ProtectedRoute path="/onboarding" component={Onboarding} />
        <ProtectedRoute path="/feed" component={Feed} />
        <Route path="/explore" component={Explore} />
        <ProtectedRoute path="/saved" component={Saved} />
        <ProtectedRoute path="/history" component={HistoryPage} />
        <Route path="/pricing" component={Pricing} />
        <ProtectedRoute path="/messages" component={Messages} />
        <ProtectedRoute path="/messages/:userId" component={MessageThread} />
        <ProtectedRoute path="/profile/me" component={ProfileEdit} />
        <Route path="/profile/:username" component={Profile} />
        <ProtectedRoute path="/videos/upload" component={VideoUpload} />
        <Route path="/videos/:id" component={VideoDetail} />
        <Route path="/watch/:token" component={SharePage} />
        <Route path="/deliver/:token" component={DeliveryPage} />

        {/* Live & cinema events */}
        {/* /studio bare path → canonical starting page */}
        <Route path="/studio">
          <Redirect to="/studio/portfolio" />
        </Route>

        <Route path="/live">
          <ComingSoon
            icon={Radio}
            title="Save the date, soon"
            description="Premieres, Q&As and ticketed events, broadcast straight to your audience. Coming soon."
            features={[
              "Ticketed live events",
              "Pay-per-view & free streams",
              "Automatic replays after the broadcast",
            ]}
          />
        </Route>
        <Route path="/cinema">
          <ComingSoon
            icon={Clapperboard}
            title="Cinema Events"
            description="Host scheduled online screenings and premieres with a true cinema feel."
            features={[
              "Timed screenings & countdowns",
              "Ticketing and capacity limits",
              "Audience chat during the show",
            ]}
          />
        </Route>
        <Route path="/live/replays">
          <ComingSoon
            icon={History}
            title="Replays"
            description="Catch up on past live streams and cinema events on demand."
            features={[
              "Full replay library",
              "Chapter markers",
              "Viewer analytics per replay",
            ]}
          />
        </Route>

        {/* Studio — creator workspace */}
        <ProtectedRoute
          path="/studio/portfolio"
          component={() => (
            <ComingSoon
              icon={FolderOpen}
              title="A home for your best work"
              description="Organise everything into reels and collections, drag-and-drop. Coming soon."
              features={[
                "Reels & themed collections",
                "Drag-and-drop ordering",
                "Featured work on your profile",
              ]}
            />
          )}
        />
        <ProtectedRoute path="/studio/storage" component={Library} />
        <ProtectedRoute path="/studio/warehouse" component={MediaWarehouse} />
        <ProtectedRoute path="/studio/delivery" component={Deliveries} />
        <ProtectedRoute
          path="/studio/delivery/:id"
          component={DeliveryManage}
        />
        <ProtectedRoute
          path="/studio/embeds"
          component={() => (
            <ComingSoon
              icon={Code2}
              title="Almost ready to share"
              description="Embed your players and galleries anywhere you like. Coming very soon."
              features={[
                "Embeddable video players",
                "Gallery & reel embeds",
                "Custom branding controls",
              ]}
            />
          )}
        />
        <ProtectedRoute
          path="/studio/analytics"
          component={() => (
            <ComingSoon
              icon={BarChart3}
              title="Your numbers are on their way"
              description="Views, audience and revenue, all in one place. We're putting the finishing touches on it."
              features={[
                "Views, watch time & retention",
                "Audience & traffic sources",
                "Revenue & payout tracking",
              ]}
            />
          )}
        />

        {/* Store */}
        <Route path="/store">
          <ComingSoon
            icon={ShoppingBag}
            title="Getting the shelves stocked"
            description="Buy and sell LUTs, presets and project files with other creators. Coming soon."
            features={[
              "LUTs, presets & project files",
              "Instant secure downloads",
              "Creator payouts",
            ]}
          />
        </Route>

        {/* Community */}
        <Route path="/community">
          <ComingSoon
            icon={Users}
            title="Community"
            description="Connect with other filmmakers, join groups, and discover collaborations."
            features={[
              "Filmmaker groups",
              "Project collaborations",
              "Community events",
            ]}
          />
        </Route>

        {/* Legal */}
        <Route path="/privacy" component={PrivacyPolicy} />
        <Route path="/terms" component={TermsOfService} />

        {/* Admin */}
        <ProtectedRoute path="/admin" component={AdminDashboard} />

        {/* Account security */}
        <ProtectedRoute
          path="/account/security"
          component={StorageConfidence}
        />

        <Route component={NotFound} />
      </Switch>
    </Layout>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={basePath}>
          <Switch>
            <Route path="/embed/:token" component={EmbedPlayer} />
            <Route path="/review/:token" component={ReviewPage} />
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
