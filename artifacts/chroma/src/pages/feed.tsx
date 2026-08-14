import { useGetFeed, useListVideos, getListVideosQueryKey } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video-card";
import { HeroFeatured } from "@/components/hero-featured";
import { FilterStrip } from "@/components/filter-strip";
import { EmptyState } from "@/components/empty-state";
import { Film, Loader2, Compass, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function Feed() {
  const { data: feedData, isLoading } = useGetFeed();

  const feedVideos = Array.isArray(feedData?.videos) ? feedData.videos : [];

  const discoverParams = { sort: "featured" as const, limit: 8 };
  const { data: discoverData, isLoading: discoverLoading } = useListVideos(
    discoverParams,
    {
      query: {
        enabled: !isLoading && feedVideos.length === 0,
        queryKey: getListVideosQueryKey(discoverParams),
      },
    },
  );

  const discoverVideos = Array.isArray(discoverData?.videos) ? discoverData.videos : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (feedVideos.length > 0) {
    const [featured, ...rest] = feedVideos;
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {featured && <HeroFeatured video={featured} />}

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1">Your Feed</h1>
          <p className="text-muted-foreground font-medium">View the latest work from filmmakers you follow.</p>
        </div>

        <FilterStrip />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {rest.map((video) => (
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
          <h1 className="text-2xl font-black tracking-tight text-white mb-1">Your feed is quiet</h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-lg">
            Follow filmmakers whose work you admire — new work shows up here the second it drops. In the meantime, here's what everyone's watching on ChromaStudio.
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
        ) : discoverVideos.length > 0 ? (
          <>
            <FilterStrip />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {discoverVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </>
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
