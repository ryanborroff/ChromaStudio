import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useListVideos } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Download, FileVideo2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MediaAsset = {
  id: number;
  originalFilename: string;
  contentType: string;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
};

function formatSize(bytes: number | null) {
  if (bytes == null) return "Size unknown";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  do { value /= 1024; unit++; } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/** A read-only view of verified original files. Does not expose raw R2 keys. */
export function MediaWarehouse() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<Record<number, number>>({});
  const [attaching, setAttaching] = useState<number | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const videosQuery = useListVideos({ mine: true, limit: 100 });
  const eligibleVideos = (videosQuery.data?.videos ?? []).filter(
    (video) => video.privacy === "private" && !video.videoUrl && !video.streamProvider,
  );

  async function attach(assetId: number) {
    const videoId = selectedVideo[assetId];
    if (!videoId) return;
    setAttaching(assetId);
    setAttachError(null);
    try {
      const response = await fetch(`/api/media-assets/${assetId}/attach`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      if (!response.ok) {
        const payload: { error?: string } = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Could not attach original");
      }
      await queryClient.invalidateQueries();
      await videosQuery.refetch();
      setSelectedVideo((previous) => ({ ...previous, [assetId]: 0 }));
    } catch (error) {
      setAttachError(error instanceof Error ? error.message : "Could not attach original");
    } finally {
      setAttaching(null);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/media-assets", {
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to load originals");
        const result: { assets: MediaAsset[] } = await response.json();
        if (!controller.signal.aborted) {
          setAssets(result.assets);
          setError(false);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? assets.filter((asset) => asset.originalFilename.toLowerCase().includes(query))
      : assets;
  }, [assets, search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Media Warehouse</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your original files, stored privately and available for future projects.
          </p>
        </div>
        <Button asChild><Link href="/videos/upload">Upload video</Link></Button>
      </div>
      <div className="mb-6 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search originals" placeholder="Search original filenames"
            className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>
      {attachError && <p role="alert" className="mb-4 text-sm text-red-400">{attachError}</p>}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading originals…
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-border p-6 text-sm">
          Originals could not be loaded. Please refresh the page.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card p-8 text-sm text-muted-foreground">
          {search ? "No originals match your search." : "No originals yet. Upload a video to get started."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
          <div className="border-b border-border/50 px-5 py-3 text-xs text-muted-foreground">
            {filtered.length} original{filtered.length === 1 ? "" : "s"} shown
            {assets.length === 100 ? " · Showing the latest 100" : ""}
          </div>
          <ul className="divide-y divide-border/50">
            {filtered.map((asset) => (
              <li key={asset.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileVideo2 className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white" title={asset.originalFilename}>
                      {asset.originalFilename}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatSize(asset.sizeBytes)} · {asset.status} · {new Date(asset.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {asset.status === "verified" && (
                  <div className="flex flex-wrap items-center gap-2">
                    {eligibleVideos.length > 0 && (
                      <>
                        <select
                          aria-label={`Select private video for ${asset.originalFilename}`}
                          className="max-w-52 rounded-md border border-border bg-background px-3 py-2 text-sm text-white"
                          value={selectedVideo[asset.id] || ""}
                          onChange={(event) => setSelectedVideo((previous) => ({
                            ...previous, [asset.id]: Number(event.target.value),
                          }))}
                        >
                          <option value="">Reuse in private video…</option>
                          {eligibleVideos.map((video) => (
                            <option key={video.id} value={video.id}>{video.title}</option>
                          ))}
                        </select>
                        <Button size="sm" variant="secondary"
                          disabled={!selectedVideo[asset.id] || attaching !== null}
                          onClick={() => void attach(asset.id)}>
                          {attaching === asset.id ? "Attaching…" : "Attach"}
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" asChild>
                    <a href={`/api/media-assets/${asset.id}/download`}>
                      <Download className="mr-2 h-4 w-4" /> Download original
                    </a>
                  </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
