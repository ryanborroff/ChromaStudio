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
import { SignInPage, SignUpPage } from "@/pages/auth";

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
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </QueryClientProvider>
    </TooltipProvider>
  );
}

export default App;
