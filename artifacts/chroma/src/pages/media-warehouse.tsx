import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListVideos } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { Download, File, Loader2, Search } from "lucide-react";
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
  const [, navigate] = useLocation();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadController, setUploadController] = useState<AbortController | null>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Record<number, number>>({});
  const [attaching, setAttaching] = useState<number | null>(null);
  const [creatingVideo, setCreatingVideo] = useState<number | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const videosQuery = useListVideos({ mine: true, limit: 100 });
  const eligibleVideos = (videosQuery.data?.videos ?? []).filter(
    (video) => video.privacy === "private" && !video.videoUrl && !video.streamProvider,
  );

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    const controller = new AbortController();
    uploadControllerRef.current = controller;
    setUploadController(controller);
    const signal = controller.signal;
    const contentType = file.type || "application/octet-stream";
    let multipart: { objectPath: string; uploadId: string } | null = null;
    const jsonPost = async (path: string, body: unknown) => {
      const response = await fetch(path, {
        method: "POST", credentials: "include", signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Upload request failed (${response.status})`);
      return response.json();
    };
    try {
      let objectPath: string;
      if (file.size > 32 * 1024 * 1024) {
        multipart = await jsonPost("/api/media-assets/multipart/start", {
          originalFilename: file.name, contentType, sizeBytes: file.size,
        }) as { objectPath: string; uploadId: string };
        const partSize = 32 * 1024 * 1024;
        const count = Math.ceil(file.size / partSize);
        if (count > 10000) throw new Error("File exceeds multipart part limit");
        const parts: { partNumber: number; etag: string }[] = [];
        for (let index = 0; index < count; index++) {
          if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
          const partNumber = index + 1;
          const { uploadURL }: { uploadURL: string } = await jsonPost("/api/media-assets/multipart/part-url", {
            ...multipart, partNumber,
          });
          const chunk = file.slice(index * partSize, Math.min((index + 1) * partSize, file.size));
          let etag: string | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            const response = await fetch(uploadURL, { method: "PUT", body: chunk, signal });
            if (response.ok) {
              etag = response.headers.get("ETag");
              break;
            }
            if (attempt === 2) throw new Error(`Part ${partNumber} failed`);
            await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          }
          if (!etag) throw new Error("Storage did not expose ETag. Check R2 CORS ExposeHeaders.");
          parts.push({ partNumber, etag });
          setUploadProgress(Math.round((partNumber / count) * 100));
        }
        await jsonPost("/api/media-assets/multipart/complete", { ...multipart, parts });
        objectPath = multipart.objectPath;
        multipart = null;
      } else {
        const { uploadURL, objectPath: path }: { uploadURL: string; objectPath: string } =
          await jsonPost("/api/media-assets/upload-url", {
            originalFilename: file.name, contentType, sizeBytes: file.size,
          });
        const response = await fetch(uploadURL, {
          method: "PUT", signal,
          headers: { "Content-Type": contentType, "x-amz-meta-original-filename": encodeURIComponent(file.name) },
          body: file,
        });
        if (!response.ok) throw new Error("File transfer failed");
        objectPath = path;
        setUploadProgress(100);
      }
      const { asset }: { asset: MediaAsset } = await jsonPost("/api/media-assets", {
        objectPath, originalFilename: file.name, contentType,
      });
      setAssets((previous) => [asset, ...previous.filter((item) => item.id !== asset.id)]);
    } catch (error) {
      if (multipart) {
        // Abort with a fresh request because the original signal may have been cancelled.
        void fetch("/api/media-assets/multipart/abort", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(multipart),
        }).catch(() => {});
      }
      setUploadError(signal.aborted ? "Upload cancelled" : error instanceof Error ? error.message : "Upload failed");
    } finally {
      uploadControllerRef.current = null;
      setUploadController(null);
      setUploading(false);
    }
  }

  async function createVideo(asset: MediaAsset) {
    const title = asset.originalFilename.replace(/\\.[^.]+$/, "").trim();
    if (title.length < 2) {
      setAttachError("Please rename the original before creating a video.");
      return;
    }
    setCreatingVideo(asset.id);
    setAttachError(null);
    try {
      const response = await fetch(`/api/media-assets/${asset.id}/create-video`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        const payload: { error?: string } = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Could not create video");
      }
      const result: { video: { id: number } } = await response.json();
      await queryClient.invalidateQueries();
      navigate(`/videos/${result.video.id}`);
    } catch (error) {
      setAttachError(error instanceof Error ? error.message : "Could not create video");
    } finally {
      setCreatingVideo(null);
    }
  }

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

  async function loadMore() {
    if (nextBeforeId === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: "50", beforeId: String(nextBeforeId) });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/media-assets?${params}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Could not load more originals");
      const result: { assets: MediaAsset[]; nextBeforeId: number | null } = await response.json();
      setAssets((previous) => [...previous, ...result.assets.filter((item) => !previous.some((old) => old.id === item.id))]);
      setNextBeforeId(result.nextBeforeId);
    } catch {
      setUploadError("Could not load more originals. Please retry.");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      void fetch(`/api/media-assets?${params}`, {
        credentials: "include", signal: controller.signal, cache: "no-store",
      }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to load originals");
        const result: { assets: MediaAsset[]; nextBeforeId: number | null } = await response.json();
        if (!controller.signal.aborted) {
          setAssets(result.assets);
          setNextBeforeId(result.nextBeforeId);
          setError(false);
        }
      }).catch(() => {
        if (!controller.signal.aborted) setError(true);
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [search]);

  const filtered = assets;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Media Warehouse</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your original files, stored privately and available for future projects.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {uploading ? `Uploading ${uploadProgress}%` : "Upload any file"}
          <input type="file" className="sr-only" disabled={uploading} onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
            event.target.value = "";
          }} />
        </label>
      </div>
      <div className="mb-6 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search originals" placeholder="Search original filenames"
            className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>
      {uploading && <div className="mb-4 flex items-center gap-3"><progress aria-label="Upload progress" value={uploadProgress} max={100} className="w-full" /><Button variant="outline" size="sm" onClick={() => uploadController?.abort()}>Cancel</Button></div>}
      {uploadError && <p role="alert" className="mb-4 text-sm text-red-400">{uploadError}</p>}
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
          {search ? "No originals match your search." : "No originals yet. Upload a file to get started."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
          <div className="border-b border-border/50 px-5 py-3 text-xs text-muted-foreground">
            {filtered.length} original{filtered.length === 1 ? "" : "s"} shown
            {nextBeforeId !== null ? " · More available" : ""}
          </div>
          <ul className="divide-y divide-border/50">
            {filtered.map((asset) => (
              <li key={asset.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <File className="h-5 w-5 shrink-0 text-primary" />
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
                    <Button variant="secondary" size="sm"
                      disabled={creatingVideo !== null || attaching !== null}
                      onClick={() => void createVideo(asset)}>
                      {creatingVideo === asset.id ? "Creating…" : "Create private video"}
                    </Button>
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
          {nextBeforeId !== null && (
            <div className="border-t border-border/50 p-4 text-center">
              <Button variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? "Loading…" : "Load more originals"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
