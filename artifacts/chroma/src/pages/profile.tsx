import { useParams } from "wouter";
import { 
  useGetUserByUsername, getGetUserByUsernameQueryKey,
  useFollowUser,
  useListFollowers, getListFollowersQueryKey,
  useListFollowing, getListFollowingQueryKey
} from "@workspace/api-client-react";
import { Loader2, MapPin, Link as LinkIcon, Film, Users, UserPlus, UserCheck, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VideoCard } from "@/components/video-card";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/useAuth";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Profile() {
  const params = useParams();
  const username = params.username;
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, error } = useGetUserByUsername(username || "", {
    query: {
      enabled: !!username,
      queryKey: getGetUserByUsernameQueryKey(username || "")
    }
  });

  const followMutation = useFollowUser({
    mutation: {
      onSuccess: (result) => {
        queryClient.setQueryData(getGetUserByUsernameQueryKey(username || ""), (old: any) => 
          old ? { 
            ...old, 
            user: {
              ...old.user,
              isFollowing: result.following,
              followerCount: result.followerCount
            }
          } : old
        );
      }
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <EmptyState
          title="Filmmaker not found"
          description="The profile you're looking for doesn't exist or has been removed."
        />
      </div>
    );
  }

  const { user, videos } = data;
  const isOwnProfile = currentUser?.username === user.username || currentUser?.id === user.id;

  const handleFollow = () => {
    if (!currentUser) {
      toast({ title: "Please sign in to follow filmmakers" });
      return;
    }
    followMutation.mutate({ userId: user.id });
  };

  return (
    <div className="w-full pb-12">
      {/* Cover Photo */}
      <div className="w-full h-48 md:h-64 lg:h-80 bg-secondary relative overflow-hidden">
        {user.coverUrl ? (
          <img src={user.coverUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-blue-500/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="container mx-auto px-4 max-w-6xl relative -mt-20 md:-mt-32">
        <div className="flex flex-col md:flex-row gap-6 md:items-end mb-8">
          <Avatar className="w-32 h-32 md:w-40 md:h-40 border-4 border-background bg-card shadow-2xl">
            <AvatarImage src={user.avatarUrl || undefined} />
            <AvatarFallback className="text-4xl font-black bg-secondary text-secondary-foreground">
              {user.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 pb-2">
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">{user.name}</h1>
            <p className="text-xl md:text-2xl text-primary font-bold mt-1">{user.profession}</p>
            
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground font-medium">
              {user.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {user.location}
                </span>
              )}
              {user.website && (
                <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <LinkIcon className="w-4 h-4" />
                  {new URL(user.website).hostname.replace('www.', '')}
                </a>
              )}
            </div>
          </div>

          <div className="flex gap-3 pb-2 w-full md:w-auto mt-4 md:mt-0">
            {isOwnProfile ? (
              <Button asChild className="font-bold w-full md:w-auto" size="lg">
                <Link href="/profile/me">Edit Profile</Link>
              </Button>
            ) : (
              <>
                <Button 
                  className={`font-bold w-full md:w-auto px-8 transition-all ${user.isFollowing ? 'bg-secondary text-white hover:bg-secondary/80' : ''}`}
                  size="lg"
                  onClick={handleFollow}
                  disabled={followMutation.isPending}
                >
                  {user.isFollowing ? (
                    <><UserCheck className="w-5 h-5 mr-2" /> Following</>
                  ) : (
                    <><UserPlus className="w-5 h-5 mr-2" /> Follow</>
                  )}
                </Button>
                <Button variant="outline" className="font-bold w-full md:w-auto border-border/50 hover:bg-secondary" size="lg" asChild>
                  <Link href={`/messages/${user.id}`}>Message</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12 mt-12">
          {/* Left Column: Info */}
          <div className="space-y-8">
            <div className="flex items-center justify-between p-6 rounded-2xl bg-card border border-border/50 shadow-lg">
              <div className="text-center flex-1">
                <div className="text-3xl font-black text-white">{user.followerCount || 0}</div>
                <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-1">Followers</div>
              </div>
              <div className="w-px h-12 bg-border/50" />
              <div className="text-center flex-1">
                <div className="text-3xl font-black text-white">{user.followingCount || 0}</div>
                <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-1">Following</div>
              </div>
            </div>

            {user.bio && (
              <div className="bg-card/30 p-6 rounded-2xl border border-border/30">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Film className="w-4 h-4 text-primary" /> About
                </h3>
                <p className="text-muted-foreground leading-relaxed font-medium">{user.bio}</p>
              </div>
            )}

            {user.skills && user.skills.length > 0 && (
              <div className="bg-card/30 p-6 rounded-2xl border border-border/30">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Core Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill, i) => (
                    <Badge key={i} variant="secondary" className="bg-secondary/80 text-white border-0 px-3 py-1 font-medium">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Portfolio */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="portfolio" className="w-full">
              <TabsList className="w-full justify-start bg-transparent border-b border-border/40 rounded-none h-auto p-0 mb-8 gap-8">
                <TabsTrigger 
                  value="portfolio" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 py-3 text-lg font-bold"
                >
                  Portfolio
                </TabsTrigger>
                {/* Could add Credits or Endorsements tabs here later */}
              </TabsList>
              
              <TabsContent value="portfolio" className="mt-0 outline-none">
                {videos && videos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {videos.map((video) => (
                      <VideoCard key={video.id} video={video} showAuthor={false} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Play className="w-10 h-10 ml-1" />}
                    title="Empty Canvas"
                    description={isOwnProfile ? "Your portfolio is empty. Upload your first video to start building your cinematic identity." : "This filmmaker hasn't uploaded any videos yet."}
                    action={isOwnProfile && (
                      <Button asChild size="lg" className="mt-4 font-bold">
                        <Link href="/videos/upload">Upload Your First Video</Link>
                      </Button>
                    )}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}