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
import { Messages } from "@/pages/messages";
import { MessageThread } from "@/pages/message-thread";
import { Profile } from "@/pages/profile";
import { ProfileEdit } from "@/pages/profile-edit";
import { VideoUpload } from "@/pages/video-upload";
import { VideoDetail } from "@/pages/video-detail";
import { Library } from "@/pages/library";
import { Pricing } from "@/pages/pricing";
import { SharePage } from "@/pages/share-page";
import { EmbedPlayer } from "@/pages/embed-player";
import { PortfolioEmbed } from "@/pages/portfolio-embed";
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
import { PublicPortfolio } from "@/pages/public-portfolio";
import { PortfolioSettings } from "@/pages/portfolio-settings";
import {
  Radio,
  Clapperboard,
  History,
  FolderOpen,
  Code2,
  BarChart3,
  ShoppingBag,
  ShieldCheck,
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
    <Layout>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
        <ProtectedRoute path="/onboarding" component={Onboarding} />
        <ProtectedRoute path="/feed" component={Feed} />
        <Route path="/explore" component={Explore} />
        <Route path="/pricing" component={Pricing} />
        <ProtectedRoute path="/messages" component={Messages} />
        <ProtectedRoute path="/messages/:userId" component={MessageThread} />
        <ProtectedRoute path="/profile/me" component={ProfileEdit} />
        <Route path="/profile/:username" component={Profile} />
        <Route path="/portfolio/:handle" component={PublicPortfolio} />
        <ProtectedRoute path="/videos/upload" component={VideoUpload} />
        <Route path="/videos/:id" component={VideoDetail} />
        <Route path="/watch/:token" component={SharePage} />
        <Route path="/deliver/:token" component={DeliveryPage} />

        {/* Live & cinema events */}
        <Route path="/live">
          <ComingSoon
            icon={Radio}
            title="Streaming"
            description="Broadcast premieres, Q&As and ticketed events to your audience in real time."
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
          component={PortfolioSettings}
        />
        <ProtectedRoute path="/studio/storage" component={Library} />
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
              title="Website Embedding"
              description="Embed your players and galleries on any external website."
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
              title="Analytics Dashboard"
              description="A full creator dashboard for views, audience and revenue."
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
            title="Download Shop"
            description="Sell and buy LUTs, presets, project files and other creator assets."
            features={[
              "LUTs, presets & project files",
              "Instant secure downloads",
              "Creator payouts",
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
  );
}

function App() {
  return (
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={basePath}>
          <Switch>
            <Route path="/embed/video/:id" component={PortfolioEmbed} />
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
