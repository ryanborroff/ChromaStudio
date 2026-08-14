import { Bookmark, Sparkles } from "lucide-react";
import { VideoCard } from "@/components/video-card";
import { MOCK_VIDEOS } from "@/lib/mock-videos";

export function Saved() {
  const savedVideos = MOCK_VIDEOS.slice(0, 4);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 rounded-lg bg-primary/10">
          <Bookmark className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Saved</h1>
      </div>
      <p className="text-muted-foreground font-medium mb-6">Films you've bookmarked to watch later.</p>

      <div
        className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg mb-6 w-fit"
        style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24" }}
        data-testid="saved-demo-notice"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Showing sample saves for demonstration
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {savedVideos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </div>
  );
}
