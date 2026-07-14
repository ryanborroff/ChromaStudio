import { useGetFeed, useListVideos, getListVideosQueryKey } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video-card";
import { EmptyState } from "@/components/empty-state";
import { Film, Loader2, Compass, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function Feed() {
  const { data: feedData, isLoading } = useGetFeed();

  const discoverParams = { sort: "featured" as const, limit: 8 };
  const { data: discoverData, isLoading: discoverLoading } = useListVideos(
    discoverParams,
    {
      query: {
        enabled: !isLoading && (feedData?.videos.length ?? 0) === 0,
        queryKey: getListVideosQueryKey(discoverParams),
      },
    },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const videos = feedData?.videos ?? [];

  if (videos.length > 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">Your Feed</h1>
          <p className="text-muted-foreground mt-2 font-medium">Latest work from filmmakers you follow.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Empty-feed hero */}
      <div className="mb-10 rounded-2xl border border-border/40 bg-card/30 px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="p-4 rounded-xl bg-primary/10 shrink-0">
          <Compass className="w-8 h-8 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-white tracking-tight mb-1">Your feed is quiet</h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-lg">
            Follow filmmakers whose work you admire — their latest videos will appear here. In the meantime, here's what's trending on ChromaStudio.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <Button asChild>
            <Link href="/explore">Browse All</Link>
          </Button>
        </div>
      </div>

      {/* Discover / Trending section */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Trending on ChromaStudio</h2>
        </div>

        {discoverLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : discoverData && discoverData.videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {discoverData.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Film className="w-10 h-10" />}
            title="Nothing here yet"
            description="Be among the first to upload — your work will be featured here."
            action={
              <Button asChild className="mt-4">
                <Link href="/videos/upload">Upload Your Work</Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
