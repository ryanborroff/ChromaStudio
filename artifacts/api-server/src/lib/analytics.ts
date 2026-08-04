import Mux from "@mux/mux-node";

export type VideoAnalytics = {
  views: number;
  uniqueViewers: number;
  averageWatchTimeSeconds: number;
  completionRatePercent: number;
  countryBreakdown: Array<{ country: string; views: number }>;
  deviceBreakdown: Array<{ device: string; views: number }>;
  source: "mux_data" | "local";
};

function getMuxClient(): Mux {
  return new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
  });
}

export async function fetchMuxVideoAnalytics(
  playbackId: string,
  durationSeconds: number | null,
): Promise<VideoAnalytics | null> {
  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) return null;

  const mux = getMuxClient();
  const filters = [`video_id:${playbackId}`];
  const [viewsMetric, uniqueViewersMetric] = await Promise.all([
    mux.data.metrics.getOverallValues("views", { filters }),
    mux.data.metrics.getOverallValues("unique_viewers", { filters }),
  ]);
  const views: Array<{
    country_code: string | null;
    viewer_os_family: string | null;
    watch_time: number | null;
  }> = [];
  for await (const view of mux.data.videoViews.list({
    filters,
    timeframe: ["365:days"],
    limit: 1000,
  })) {
    views.push(view);
  }

  const countryCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();
  let watchTime = 0;
  for (const view of views) {
    const country = view.country_code ?? "Unknown";
    const device = view.viewer_os_family ?? "Unknown";
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
    deviceCounts.set(device, (deviceCounts.get(device) ?? 0) + 1);
    watchTime += view.watch_time ?? 0;
  }

  const viewCount = viewsMetric.data.total_views || views.length;
  const uniqueViewers = uniqueViewersMetric.data.value || 0;
  const averageWatchTimeSeconds = viewCount ? watchTime / viewCount : 0;
  return {
    views: viewCount,
    uniqueViewers,
    averageWatchTimeSeconds: Number(averageWatchTimeSeconds.toFixed(2)),
    completionRatePercent: durationSeconds
      ? Number(
          Math.min(
            (averageWatchTimeSeconds / durationSeconds) * 100,
            100,
          ).toFixed(2),
        )
      : 0,
    countryBreakdown: [...countryCounts.entries()]
      .map(([country, count]) => ({ country, views: count }))
      .sort((a, b) => b.views - a.views),
    deviceBreakdown: [...deviceCounts.entries()]
      .map(([device, count]) => ({ device, views: count }))
      .sort((a, b) => b.views - a.views),
    source: "mux_data",
  };
}

export function localVideoAnalytics(viewCount: number): VideoAnalytics {
  return {
    views: viewCount,
    uniqueViewers: 0,
    averageWatchTimeSeconds: 0,
    completionRatePercent: 0,
    countryBreakdown: [],
    deviceBreakdown: [],
    source: "local",
  };
}
