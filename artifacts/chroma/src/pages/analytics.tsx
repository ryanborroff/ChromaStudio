import { useState } from "react";
import {
  getGetVideoAnalyticsQueryKey,
  getGetPortfolioAnalyticsQueryKey,
  getListVideosQueryKey,
  useGetPortfolioAnalytics,
  useGetVideoAnalytics,
  useListVideos,
} from "@workspace/api-client-react";
import { BarChart3, Eye, Loader2, Users, Clock3, Target } from "lucide-react";

function number(value: number) {
  return new Intl.NumberFormat().format(value);
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function Analytics() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const videosQuery = useListVideos(
    { mine: true, limit: 100 },
    { query: { queryKey: getListVideosQueryKey({ mine: true, limit: 100 }) } },
  );
  const portfolio = useGetPortfolioAnalytics({
    query: { queryKey: getGetPortfolioAnalyticsQueryKey() },
  });
  const detail = useGetVideoAnalytics(selectedId ?? 0, {
    query: {
      enabled: !!selectedId,
      queryKey: getGetVideoAnalyticsQueryKey(selectedId ?? 0),
    },
  });
  const videos = videosQuery.data?.videos ?? [];
  const selectedVideo = videos.find((video) => video.id === selectedId);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-black text-white">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Audience performance for your public work.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={Eye}
          label="Portfolio views"
          value={number(portfolio.data?.totalViews ?? 0)}
        />
        <Stat
          icon={Users}
          label="Published videos"
          value={number(portfolio.data?.videoCount ?? 0)}
        />
        <Stat
          icon={Clock3}
          label="Data source"
          value={portfolio.data ? "Live" : "—"}
        />
        <Stat icon={Target} label="Heatmaps" value="Coming later" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-border/50 bg-card p-5">
          <h2 className="font-bold text-white">Top portfolio work</h2>
          <div className="mt-4 space-y-2">
            {(portfolio.data?.videos ?? []).map((video) => (
              <button
                key={video.videoId}
                onClick={() => setSelectedId(video.videoId)}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                  selectedId === video.videoId
                    ? "border-primary/60 bg-primary/10"
                    : "border-border/40 hover:bg-white/5"
                }`}
              >
                <span className="min-w-0 truncate text-sm font-medium text-white">
                  {video.title}
                </span>
                <span className="ml-3 shrink-0 text-xs text-white/50">
                  {number(video.views)} views
                </span>
              </button>
            ))}
            {!portfolio.data?.videos.length && (
              <p className="text-sm text-white/45">
                Feature public videos in your portfolio to see them here.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border/50 bg-card p-5">
          <h2 className="font-bold text-white">
            {selectedVideo?.title ?? "Video detail"}
          </h2>
          {!selectedId ? (
            <p className="mt-4 text-sm text-white/45">
              Select a video to inspect watch behavior.
            </p>
          ) : detail.isLoading ? (
            <Loader2 className="mt-5 h-5 w-5 animate-spin text-primary" />
          ) : detail.data ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat
                icon={Eye}
                label="Views"
                value={number(detail.data.views)}
              />
              <Stat
                icon={Users}
                label="Unique viewers"
                value={number(detail.data.uniqueViewers)}
              />
              <Stat
                icon={Clock3}
                label="Avg watch time"
                value={`${detail.data.averageWatchTimeSeconds.toFixed(1)}s`}
              />
              <Stat
                icon={Target}
                label="Completion"
                value={`${detail.data.completionRatePercent.toFixed(1)}%`}
              />
            </div>
          ) : null}
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-border/50 bg-card p-5">
        <h2 className="font-bold text-white">Analytics source</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          When Mux Data credentials and plan access are available, Chroma reads
          playback metrics from Mux Data and caches them for ten minutes.
          Without that access, the dashboard safely falls back to Chroma&apos;s
          aggregate view counter instead of pretending detailed metrics exist.
        </p>
      </section>
    </div>
  );
}
