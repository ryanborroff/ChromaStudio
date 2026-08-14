import { useParams } from "wouter";
import { 
  useGetUserByUsername, getGetUserByUsernameQueryKey,
  useFollowUser,
  useListEndorsements, getListEndorsementsQueryKey,
  useCreateEndorsement,
  useDeleteEndorsement,
} from "@workspace/api-client-react";
import { Loader2, MapPin, Link as LinkIcon, Film, UserPlus, UserCheck, Play, Instagram, Linkedin, Twitter, Quote, Clapperboard, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { VideoCard } from "@/components/video-card";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/useAuth";
import { Link } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

type UserCreditItem = { title: string; role: string; year?: string };

function ProfileTabs({ user, videos, isOwnProfile, currentUser }: {
  user: any;
  videos: any[];
  isOwnProfile: boolean;
  currentUser: any;
}) {
  const { toast } = useToast();
  const [endorseText, setEndorseText] = useState("");
  const [showEndorseForm, setShowEndorseForm] = useState(false);

  const { data: endorsementsData, isLoading: endorsementsLoading } = useListEndorsements(
    user.id,
    { query: { queryKey: getListEndorsementsQueryKey(user.id) } }
  );

  const createEndorsementMutation = useCreateEndorsement({
    mutation: {
      onSuccess: () => {
        toast({ title: "Endorsement written" });
        queryClient.invalidateQueries({ queryKey: getListEndorsementsQueryKey(user.id) });
        setEndorseText("");
        setShowEndorseForm(false);
      },
      onError: () => toast({ title: "Failed to write endorsement", variant: "destructive" }),
    },
  });

  const deleteEndorsementMutation = useDeleteEndorsement({
    mutation: {
      onSuccess: () => {
        toast({ title: "Endorsement removed" });
        queryClient.invalidateQueries({ queryKey: getListEndorsementsQueryKey(user.id) });
      },
    },
  });

  const credits: UserCreditItem[] = Array.isArray(user.credits) ? user.credits : [];
  const hasMyEndorsement = !!endorsementsData?.myEndorsement;
  const canEndorse = currentUser && currentUser.id !== user.id;

  return (
    <Tabs defaultValue="portfolio" className="w-full">
      <TabsList className="w-full justify-start bg-transparent border-b border-border/40 rounded-none h-auto p-0 mb-8 gap-8">
        {[
          { value: "portfolio", label: "Portfolio" },
          { value: "credits", label: `Credits${credits.length ? ` (${credits.length})` : ""}` },
          { value: "endorsements", label: `Endorsements${endorsementsData ? ` (${endorsementsData.total})` : ""}` },
        ].map(t => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 py-3 text-lg font-bold"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="portfolio" className="mt-0 outline-none">
        {videos && videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {videos.map((video: any) => (
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

      <TabsContent value="credits" className="mt-0 outline-none">
        {credits.length > 0 ? (
          <div className="space-y-3">
            {credits.map((c, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-card/30 border border-border/30">
                <Clapperboard className="w-5 h-5 text-primary/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{c.title}</p>
                  <p className="text-white/50 text-sm">{c.role}{c.year ? ` · ${c.year}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Clapperboard className="w-10 h-10" />}
            title="No credits yet"
            description={isOwnProfile ? "Add your film credits in Edit Profile to showcase your work history." : "This filmmaker hasn't added any credits yet."}
            action={isOwnProfile && (
              <Button asChild size="lg" className="mt-4 font-bold">
                <Link href="/profile/me">Edit Profile</Link>
              </Button>
            )}
          />
        )}
      </TabsContent>

      <TabsContent value="endorsements" className="mt-0 outline-none">
        {canEndorse && (
          <div className="mb-6">
            {!showEndorseForm ? (
              <Button
                variant="outline"
                className="border-border/50 gap-2"
                onClick={() => setShowEndorseForm(true)}
              >
                <Star className="w-4 h-4" />
                {hasMyEndorsement ? "Edit my endorsement" : "Write an endorsement"}
              </Button>
            ) : (
              <div className="p-5 rounded-xl bg-card/50 border border-border/50 space-y-3">
                <p className="text-sm font-semibold text-white">Your endorsement of {user.name}</p>
                <Textarea
                  value={endorseText}
                  onChange={e => setEndorseText(e.target.value)}
                  placeholder="Describe working with this filmmaker — their skills, professionalism, what you'd hire them for..."
                  className="bg-input border-border text-white min-h-[100px] resize-none"
                  maxLength={500}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!endorseText.trim() || createEndorsementMutation.isPending}
                    onClick={() => createEndorsementMutation.mutate({ userId: user.id, data: { text: endorseText.trim() } })}
                  >
                    {createEndorsementMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    Submit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowEndorseForm(false)}>Cancel</Button>
                  {hasMyEndorsement && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 ml-auto"
                      onClick={() => deleteEndorsementMutation.mutate({ userId: user.id })}
                    >
                      Remove mine
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {endorsementsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : endorsementsData && endorsementsData.endorsements.length > 0 ? (
          <div className="space-y-4">
            {endorsementsData.endorsements.map((e) => (
              <div key={e.id} className="p-5 rounded-xl bg-card/30 border border-border/30 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={e.fromUser.avatarUrl || undefined} />
                    <AvatarFallback className="text-sm bg-secondary">{e.fromUser.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <Link href={`/profile/${e.fromUser.username}`} className="text-white font-semibold text-sm hover:text-primary transition-colors">
                      {e.fromUser.name}
                    </Link>
                    <p className="text-white/40 text-xs">{e.fromUser.profession}</p>
                  </div>
                  <Quote className="w-4 h-4 text-primary/40 ml-auto shrink-0" />
                </div>
                <p className="text-white/70 text-sm leading-relaxed">"{e.text}"</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Quote className="w-10 h-10" />}
            title="No endorsements yet"
            description={canEndorse ? `Be the first to endorse ${user.name}.` : "No endorsements yet."}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

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
          <div className="absolute inset-0 bg-gradient-to-r from-primary/25 to-amber-700/10" />
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

            {(() => {
              const links = (user.socialLinks as Record<string, string> | null) ?? {};
              const entries: { icon: React.ReactNode; label: string; href: string }[] = [];
              if (links.instagram) entries.push({ icon: <Instagram className="w-4 h-4" />, label: "Instagram", href: links.instagram.startsWith("http") ? links.instagram : `https://instagram.com/${links.instagram.replace("@", "")}` });
              if (links.linkedin) entries.push({ icon: <Linkedin className="w-4 h-4" />, label: "LinkedIn", href: links.linkedin.startsWith("http") ? links.linkedin : `https://linkedin.com/in/${links.linkedin}` });
              if (links.twitter) entries.push({ icon: <Twitter className="w-4 h-4" />, label: "X / Twitter", href: links.twitter.startsWith("http") ? links.twitter : `https://x.com/${links.twitter.replace("@", "")}` });
              if (links.vimeo) entries.push({ icon: <Film className="w-4 h-4" />, label: "Vimeo", href: links.vimeo.startsWith("http") ? links.vimeo : `https://vimeo.com/${links.vimeo}` });
              if (links.imdb) entries.push({ icon: <LinkIcon className="w-4 h-4" />, label: "IMDb", href: links.imdb.startsWith("http") ? links.imdb : `https://imdb.com/name/${links.imdb}` });
              if (entries.length === 0) return null;
              return (
                <div className="bg-card/30 p-6 rounded-2xl border border-border/30">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Social</h3>
                  <div className="flex flex-col gap-2">
                    {entries.map(e => (
                      <a key={e.label} href={e.href} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2.5 text-sm text-white/50 hover:text-primary transition-colors font-medium">
                        {e.icon}
                        {e.label}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right Column: Portfolio, Credits, Endorsements */}
          <div className="lg:col-span-2">
            <ProfileTabs user={user} videos={videos} isOwnProfile={isOwnProfile} currentUser={currentUser} />
          </div>
        </div>
      </div>
    </div>
  );
}