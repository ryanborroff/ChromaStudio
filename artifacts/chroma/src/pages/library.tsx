import { useState } from "react";
import { Link } from "wouter";
import {
  useListVideos,
  getListVideosQueryKey,
  useListCollections,
  getListCollectionsQueryKey,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  useUpdateVideo,
} from "@workspace/api-client-react";
import type { Video, ListVideosParams } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ShareDialog } from "@/components/share-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, FolderPlus, Folder, Film, UploadCloud, Share2,
  Trash2, Pencil, Check, X, Library as LibraryIcon, Lock,
  Eye, Heart,
} from "lucide-react";

const CATEGORIES = [
  { value: "reel", label: "Reel" },
  { value: "reel", label: "Reel" },
  { value: "rushes", label: "Rushes" },
  { value: "other", label: "Other" },
] as const;

const categoryLabel = (c?: string | null) => CATEGORIES.find((x) => x.value === c)?.label ?? "Other";

type Selected = { kind: "all" } | { kind: "none" } | { kind: "collection"; id: number };

export function Library() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Selected>({ kind: "all" });
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [shareVideo, setShareVideo] = useState<Video | null>(null);

  const collectionsQuery = useListCollections({
    query: { queryKey: getListCollectionsQueryKey() },
  });
  const collections = collectionsQuery.data?.collections ?? [];

  const params: ListVideosParams = {
    mine: true,
    limit: 100,
    ...(selected.kind === "collection" ? { collectionId: String(selected.id) } : {}),
    ...(selected.kind === "none" ? { collectionId: "none" } : {}),
    ...(categoryFilter !== "all" ? { category: categoryFilter as ListVideosParams["category"] } : {}),
  };
  const videosQuery = useListVideos(params, { query: { queryKey: getListVideosQueryKey(params) } });
  const videos = videosQuery.data?.videos ?? [];

  function invalidate() {
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0].startsWith("/api/videos") || q.queryKey[0].startsWith("/api/collections")),
    });
  }

  const createMutation = useCreateCollection({
    mutation: {
      onSuccess: () => { setNewName(""); setCreating(false); invalidate(); },
      onError: () => toast({ title: "Could not create collection", variant: "destructive" }),
    },
  });
  const updateCollectionMutation = useUpdateCollection({
    mutation: { onSuccess: () => { setEditingId(null); invalidate(); } },
  });
  const deleteCollectionMutation = useDeleteCollection({
    mutation: {
      onSuccess: () => { setSelected({ kind: "all" }); invalidate(); },
      onError: () => toast({ title: "Could not delete collection", variant: "destructive" }),
    },
  });
  const updateVideoMutation = useUpdateVideo({
    mutation: { onSuccess: invalidate, onError: () => toast({ title: "Could not update video", variant: "destructive" }) },
  });

  const sidebarItem = (active: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
      active ? "bg-primary/15 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"
    }`;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <LibraryIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Media Library</h1>
            <p className="text-sm text-muted-foreground">Organise reels, reels and rushes — then share or embed them.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/videos/upload"><UploadCloud className="w-4 h-4 mr-2" /> Upload video</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar: collections */}
        <aside className="space-y-1">
          <button className={sidebarItem(selected.kind === "all")} onClick={() => setSelected({ kind: "all" })}>
            <Film className="w-4 h-4 shrink-0" /> All videos
          </button>
          <button className={sidebarItem(selected.kind === "none")} onClick={() => setSelected({ kind: "none" })}>
            <Folder className="w-4 h-4 shrink-0" /> Uncategorized
          </button>

          <div className="pt-4 pb-1 px-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Collections</span>
            <button className="text-muted-foreground hover:text-white" onClick={() => setCreating((v) => !v)}>
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          {creating && (
            <form
              className="flex gap-1.5 px-1 pb-2"
              onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate({ data: { name: newName.trim() } }); }}
            >
              <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Collection name" className="h-8 bg-input border-border text-white text-sm" />
              <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={createMutation.isPending}>
                <Check className="w-4 h-4" />
              </Button>
            </form>
          )}

          {collections.map((c) => {
            const active = selected.kind === "collection" && selected.id === c.id;
            if (editingId === c.id) {
              return (
                <form
                  key={c.id}
                  className="flex gap-1.5 px-1"
                  onSubmit={(e) => { e.preventDefault(); if (editName.trim()) updateCollectionMutation.mutate({ id: c.id, data: { name: editName.trim() } }); }}
                >
                  <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 bg-input border-border text-white text-sm" />
                  <Button type="submit" size="icon" className="h-8 w-8 shrink-0"><Check className="w-4 h-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                </form>
              );
            }
            return (
              <div key={c.id} className={`group flex items-center ${active ? "bg-primary/15 rounded-lg" : ""}`}>
                <button className={sidebarItem(active) + " flex-1"} onClick={() => setSelected({ kind: "collection", id: c.id })}>
                  <Folder className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.videoCount}</span>
                </button>
                <div className="flex opacity-0 group-hover:opacity-100 pr-1">
                  <button className="p-1 text-muted-foreground hover:text-white" onClick={() => { setEditingId(c.id); setEditName(c.name); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1 text-muted-foreground hover:text-red-400" onClick={() => deleteCollectionMutation.mutate({ id: c.id })}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </aside>

        {/* Main: videos */}
        <main className="min-w-0">
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <button onClick={() => setCategoryFilter("all")} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${categoryFilter === "all" ? "bg-white text-black" : "bg-white/5 text-muted-foreground hover:text-white"}`}>All</button>
            {CATEGORIES.map((c) => (
              <button key={c.value} onClick={() => setCategoryFilter(c.value)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${categoryFilter === c.value ? "bg-white text-black" : "bg-white/5 text-muted-foreground hover:text-white"}`}>{c.label}</button>
            ))}
          </div>

          {videosQuery.isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : videos.length === 0 ? (
            <EmptyState
              icon={<Film className="w-10 h-10" />}
              title="No videos here yet"
              description="Upload a video, then categorise it and add it to a collection."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {videos.map((v) => (
                <div key={v.id} className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col">
                  <Link href={`/videos/${v.id}`} className="block aspect-video bg-black relative">
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Film className="w-7 h-7 text-white/30" /></div>
                    )}
                    <Badge className="absolute top-2 left-2 bg-black/70 text-white border-0 text-[10px]">{categoryLabel(v.category)}</Badge>
                    {v.shareEnabled && (
                      <span className="absolute top-2 right-2 flex items-center gap-1 bg-primary/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                        {v.hasSharePassword && <Lock className="w-2.5 h-2.5" />} Shared
                      </span>
                    )}
                  </Link>

                  <div className="p-3 flex flex-col gap-3 flex-1">
                    <p className="text-sm font-semibold text-white line-clamp-1">{v.title}</p>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 text-xs font-medium text-white/55">
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{v.viewCount}</span>
                        <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{v.likeCount}</span>
                      </div>
                    </div>
                    <StarRating
                      videoId={v.id}
                      ratingAvg={v.ratingAvg ?? 0}
                      ratingCount={v.ratingCount ?? 0}
                      userRating={v.userRating ?? null}
                    />

                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <Select value={v.category ?? "other"} onValueChange={(val) => updateVideoMutation.mutate({ id: v.id, data: { category: val as Video["category"] } })}>
                        <SelectTrigger className="h-8 bg-input border-border text-white text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Select
                        value={v.collectionId ? String(v.collectionId) : "none"}
                        onValueChange={(val) => updateVideoMutation.mutate({ id: v.id, data: { collectionId: val === "none" ? null : Number(val) } })}
                      >
                        <SelectTrigger className="h-8 bg-input border-border text-white text-xs"><SelectValue placeholder="Collection" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No collection</SelectItem>
                          {collections.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button variant="secondary" size="sm" className="w-full" onClick={() => setShareVideo(v)}>
                      <Share2 className="w-3.5 h-3.5 mr-2" /> Share & embed
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {shareVideo && (
        <ShareDialog
          open={!!shareVideo}
          onOpenChange={(o) => !o && setShareVideo(null)}
          video={{
            id: shareVideo.id,
            title: shareVideo.title,
            shareEnabled: shareVideo.shareEnabled ?? false,
            shareToken: shareVideo.shareToken ?? null,
            hasSharePassword: shareVideo.hasSharePassword ?? false,
          }}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}
