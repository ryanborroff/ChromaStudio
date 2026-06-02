import { useGetFeed } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video-card";
import { EmptyState } from "@/components/empty-state";
import { Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function Feed() {
  const { data: feedData, isLoading } = useGetFeed();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const videos = feedData?.videos || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight">Your Feed</h1>
        <p className="text-muted-foreground mt-2 font-medium">Latest work from filmmakers you follow and featured content.</p>
      </div>

      {videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Film className="w-10 h-10" />}
          title="Your feed is quiet"
          description="Follow more filmmakers to see their latest work populate here. Or maybe it's time to share something yourself."
          action={
            <div className="flex gap-4">
              <Button asChild variant="secondary">
                <Link href="/explore">Discover Creators</Link>
              </Button>
              <Button asChild>
                <Link href="/videos/upload">Upload Work</Link>
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
}