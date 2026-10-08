import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
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
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/api/media-assets/${asset.id}/download`}>
                      <Download className="mr-2 h-4 w-4" /> Download original
                    </a>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
