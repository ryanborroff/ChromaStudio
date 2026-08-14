import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import {
  useListVideos,
  getListVideosQueryKey,
  useListCollections,
  getListCollectionsQueryKey,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  useBulkMoveVideos,
  useBulkSetVideoCategory,
} from "@workspace/api-client-react";
import type { Video, ListVideosParams, Collection } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { ShareDialog } from "@/components/share-dialog";
import { useToast } from "@/hooks/use-toast";
import { DOWNLOAD_FORMAT_LABELS } from "@/lib/downloadFormats";
import { FolderTree } from "@/components/folder-tree";
import { FileBrowser, type BrowserItem } from "@/components/file-browser";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  FolderPlus,
  Folder,
  Film,
  UploadCloud,
  Download,
  Search,
  Library as LibraryIcon,
  LayoutGrid,
  List,
  Move,
  Tag,
  ChevronRight,
  X,
} from "lucide-react";

const CATEGORIES = [
  { value: "reel", label: "Reel" },
  { value: "rushes", label: "Rushes" },
  { value: "other", label: "Other" },
] as const;

const categoryLabel = (c?: string | null) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? "Other";

const buildDownloadHref = (streamUid: string, title: string, format: string) =>
  `https://videodelivery.net/${streamUid}/downloads/default.mp4?filename=${encodeURIComponent(
    `${title.replace(/[^\w.-]+/g, "_")}-${format}.mp4`,
  )}`;

type Location =
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "category"; category: "reel" | "rushes" | "other" }
  | { kind: "folder"; id: number };

function locationTitle(loc: Location) {
  switch (loc.kind) {
    case "all":
      return "All videos";
    case "uncategorized":
      return "Uncategorized";
    case "category":
      return categoryLabel(loc.category);
    case "folder":
      return "Folder";
  }
}

function parsePathIds(path: string) {
  return path
    .split("/")
    .filter((s) => s.length > 0)
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
}

export function Library() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [location, setCurrentLocation] = useState<Location>({ kind: "all" });
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const trimmedSearch = debouncedSearch.trim();
  const isSearching = trimmedSearch.length > 0;
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [shareVideo, setShareVideo] = useState<Video | null>(null);

  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoveTarget, setBulkMoveTarget] = useState<number | null>(null);

  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);

  const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);
  const [bulkDownloadFormat, setBulkDownloadFormat] = useState<string>("1080p");

  const collectionsQuery = useListCollections({
    query: { queryKey: getListCollectionsQueryKey() },
  });
  const collections = collectionsQuery.data?.collections ?? [];

  const collectionById = useMemo(() => {
    const map = new Map<number, Collection>();
    for (const c of collections) map.set(c.id, c);
    return map;
  }, [collections]);

  const listParams: ListVideosParams = useMemo(() => {
    const base: ListVideosParams = { mine: true, limit: 100 };
    if (isSearching) {
      return { ...base, search: trimmedSearch };
    }
    switch (location.kind) {
      case "all":
        return base;
      case "uncategorized":
        return { ...base, collectionId: "none" };
      case "category":
        return { ...base, category: location.category };
      case "folder":
        return { ...base, collectionId: String(location.id) };
    }
  }, [location, isSearching, trimmedSearch]);

  const videosQuery = useListVideos(listParams, {
    query: { queryKey: getListVideosQueryKey(listParams) },
  });
  const videos = videosQuery.data?.videos ?? [];

  const items: BrowserItem[] = useMemo(() => {
    const query = trimmedSearch.toLowerCase();
    const folderItems: BrowserItem[] = [];
    if (isSearching) {
      folderItems.push(
        ...collections
          .filter((c) => c.name.toLowerCase().includes(query))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({ kind: "folder" as const, collection: c })),
      );
    } else if (location.kind === "folder") {
      folderItems.push(
        ...collections
          .filter((c) => c.parentId === location.id)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({ kind: "folder" as const, collection: c })),
      );
    } else if (location.kind === "uncategorized") {
      folderItems.push(
        ...collections
          .filter((c) => c.parentId == null)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({ kind: "folder" as const, collection: c })),
      );
    }
    return [...folderItems, ...videos.map((v) => ({ kind: "video" as const, video: v }))];
  }, [collections, videos, location, isSearching, trimmedSearch]);

  // Keep the tree expanded to the current folder path.
  useEffect(() => {
    if (location.kind === "folder") {
      const c = collectionById.get(location.id);
      if (c) {
        setExpanded((prev) => {
          const next = new Set(prev);
          for (const id of parsePathIds(c.path)) next.add(id);
          next.add(c.id);
          return next;
        });
      }
    }
  }, [location, collectionById]);

  // Clear search when changing location, and clear selection when searching.
  useEffect(() => {
    setSearch("");
  }, [location]);

  useEffect(() => {
    setSelectedItems(new Set());
    setLastSelected(null);
  }, [debouncedSearch]);

  function invalidate() {
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0].startsWith("/api/videos") ||
          q.queryKey[0].startsWith("/api/collections")),
    });
  }

  const createMutation = useCreateCollection({
    mutation: {
      onSuccess: () => {
        setNewFolderName("");
        setCreating(false);
        invalidate();
      },
      onError: () => toast({ title: "Could not create folder", variant: "destructive" }),
    },
  });

  const updateCollectionMutation = useUpdateCollection({
    mutation: {
      onSuccess: () => invalidate(),
    },
  });

  const deleteCollectionMutation = useDeleteCollection({
    mutation: {
      onSuccess: () => {
        if (location.kind === "folder") {
          setCurrentLocation({ kind: "uncategorized" });
        }
        invalidate();
      },
      onError: () => toast({ title: "Could not delete folder", variant: "destructive" }),
    },
  });

  const bulkMoveMutation = useBulkMoveVideos({
    mutation: {
      onSuccess: () => {
        setSelectedItems(new Set());
        setLastSelected(null);
        setBulkMoveOpen(false);
        invalidate();
      },
      onError: () => toast({ title: "Could not move videos", variant: "destructive" }),
    },
  });

  const bulkCategoryMutation = useBulkSetVideoCategory({
    mutation: {
      onSuccess: () => {
        setSelectedItems(new Set());
        setLastSelected(null);
        setBulkCategoryOpen(false);
        invalidate();
      },
      onError: () => toast({ title: "Could not update categories", variant: "destructive" }),
    },
  });

  const handleGoTo = useCallback(
    (loc: Location) => {
      setCurrentLocation(loc);
      setSelectedItems(new Set());
      setLastSelected(null);
    },
    [],
  );

  const handleOpen = useCallback(
    (item: BrowserItem) => {
      if (item.kind === "folder") {
        handleGoTo({ kind: "folder", id: item.collection.id });
      } else {
        setLocation(`/videos/${item.video.id}`);
      }
    },
    [handleGoTo, setLocation],
  );

  const selectedFolderIds = useMemo(() => {
    return Array.from(selectedItems)
      .filter((k) => k.startsWith("folder-"))
      .map((k) => parseInt(k.replace("folder-", ""), 10));
  }, [selectedItems]);

  const selectedVideoIds = useMemo(() => {
    return Array.from(selectedItems)
      .filter((k) => k.startsWith("video-"))
      .map((k) => parseInt(k.replace("video-", ""), 10));
  }, [selectedItems]);

  const selectedCount = selectedItems.size;

  function handleSelect(key: string, index: number, e: React.MouseEvent) {
    e.preventDefault();
    const isMac = e.metaKey;
    const isCtrl = e.ctrlKey;
    const isShift = e.shiftKey && lastSelected != null;

    if (isMac || isCtrl) {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      setLastSelected(key);
    } else if (isShift) {
      const lastIndex = items.findIndex((i) => itemKey(i) === lastSelected);
      if (lastIndex !== -1) {
        const start = Math.min(lastIndex, index);
        const end = Math.max(lastIndex, index);
        const next = new Set<string>();
        for (let i = start; i <= end; i++) {
          next.add(itemKey(items[i]));
        }
        setSelectedItems(next);
      }
    } else {
      setSelectedItems(new Set([key]));
      setLastSelected(key);
    }
  }

  function handleDragStart(item: BrowserItem, e: React.DragEvent) {
    const type = item.kind;
    const inSelection = selectedItems.has(itemKey(item));
    const ids = inSelection
      ? Array.from(selectedItems)
          .filter((k) => k.startsWith(`${type}-`))
          .map((k) => parseInt(k.replace(`${type}-`, ""), 10))
      : [itemId(item)];
    e.dataTransfer.setData("text/plain", JSON.stringify({ type, ids }));
    e.dataTransfer.effectAllowed = "move";
  }

  async function moveFolderToParent(folderId: number, parentId: number | null) {
    await updateCollectionMutation.mutateAsync({
      id: folderId,
      data: { parentId },
    });
  }

  async function handleDrop(targetId: number | null, data: { type: "folder" | "video"; ids: number[] }) {
    if (data.ids.length === 0) return;

    if (data.type === "video") {
      bulkMoveMutation.mutate({ data: { ids: data.ids, collectionId: targetId } });
    } else {
      // Moving folders: skip if target is one of the dragged folders or their descendant.
      // The backend also validates, but we can pre-filter.
      if (targetId != null && data.ids.includes(targetId)) return;
      const targetCollection = targetId == null ? null : collectionById.get(targetId);
      for (const id of data.ids) {
        if (id === targetId) continue;
        if (targetCollection) {
          const moving = collectionById.get(id);
          if (moving && targetCollection.path.startsWith(moving.path)) continue;
        }
        await moveFolderToParent(id, targetId);
      }
      invalidate();
      setSelectedItems(new Set());
      setLastSelected(null);
    }
  }

  function handleBrowserDrop(
    target: BrowserItem,
    data: { type: "folder" | "video"; ids: number[] },
  ) {
    if (target.kind !== "folder") return;
    handleDrop(target.collection.id, data);
  }

  function handleTreeDrop(
    targetId: number,
    data: { type: "folder" | "video"; ids: number[] },
  ) {
    handleDrop(targetId, data);
  }

  function handleRootDrop(data: { type: "folder" | "video"; ids: number[] }) {
    handleDrop(null, data);
  }

  async function handleBulkMove() {
    if (selectedVideoIds.length > 0) {
      bulkMoveMutation.mutate({
        data: { ids: selectedVideoIds, collectionId: bulkMoveTarget },
      });
    }
    if (selectedFolderIds.length > 0) {
      const targetCollection =
        bulkMoveTarget == null ? null : collectionById.get(bulkMoveTarget);
      for (const id of selectedFolderIds) {
        if (id === bulkMoveTarget) continue;
        if (targetCollection) {
          const moving = collectionById.get(id);
          if (moving && targetCollection.path.startsWith(moving.path)) continue;
        }
        await moveFolderToParent(id, bulkMoveTarget);
      }
      invalidate();
      setSelectedItems(new Set());
      setLastSelected(null);
      setBulkMoveOpen(false);
    }
  }

  function handleBulkCategory(category: string) {
    if (selectedVideoIds.length === 0) return;
    bulkCategoryMutation.mutate({
      data: { ids: selectedVideoIds, category: category as "reel" | "rushes" | "other" },
    });
  }

  function handleBulkDownload() {
    let opened = 0;
    for (const id of selectedVideoIds) {
      const video = videos.find((v) => v.id === id);
      if (!video?.streamUid || !video.downloadFormats?.length) continue;
      const format = video.downloadFormats.includes(bulkDownloadFormat)
        ? bulkDownloadFormat
        : video.downloadFormats[0];
      const a = document.createElement("a");
      a.href = buildDownloadHref(video.streamUid, video.title, format);
      a.download = `${video.title.replace(/[^\w.-]+/g, "_")}-${format}.mp4`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      opened++;
    }
    if (opened === 0) {
      toast({ title: "No downloadable videos selected", variant: "destructive" });
    } else {
      toast({ title: `Opened ${opened} download(s)` });
    }
    setBulkDownloadOpen(false);
    setSelectedItems(new Set());
    setLastSelected(null);
  }

  function handleCreateFolder(e?: React.FormEvent) {
    e?.preventDefault();
    if (!newFolderName.trim()) return;
    const parentId =
      location.kind === "folder" ? location.id : null;
    createMutation.mutate({ data: { name: newFolderName.trim(), parentId } });
  }

  function handleDeleteFolder(id: number) {
    if (window.confirm("Delete this folder and its subfolders?")) {
      deleteCollectionMutation.mutate({ id });
    }
  }

  const currentCollection =
    location.kind === "folder" ? collectionById.get(location.id) : null;

  const breadcrumbs = useMemo(() => {
    if (!currentCollection) return [];
    const ids = parsePathIds(currentCollection.path);
    return ids
      .map((id) => collectionById.get(id))
      .filter((c): c is Collection => c != null);
  }, [currentCollection, collectionById]);

  const sidebarItem = (active: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
      active ? "bg-primary/15 text-white" : "text-muted-foreground hover:text-white hover:bg-white/5"
    }`;

  const folderDepth = (c: Collection) => Math.max(0, c.path.split("/").filter(Boolean).length - 1);

  // Move target options
  const excludedMoveTargets = useMemo(() => {
    const excluded = new Set<number>();
    for (const id of selectedFolderIds) {
      const c = collectionById.get(id);
      if (!c) continue;
      excluded.add(id);
      for (const other of collections) {
        if (other.path.startsWith(c.path)) excluded.add(other.id);
      }
    }
    return excluded;
  }, [selectedFolderIds, collectionById, collections]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <LibraryIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Media Library</h1>
            <p className="text-sm text-muted-foreground">Finder-style folders, drag-and-drop, and bulk actions.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/videos/upload">
            <UploadCloud className="w-4 h-4 mr-2" /> Upload video
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 min-h-[60vh]">
        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="space-y-1">
            <button
              className={sidebarItem(location.kind === "all")}
              onClick={() => handleGoTo({ kind: "all" })}
            >
              <Film className="w-4 h-4 shrink-0" /> All videos
            </button>
            <div
              className={cn(
                sidebarItem(location.kind === "uncategorized"),
                "cursor-grab",
              )}
              onClick={() => handleGoTo({ kind: "uncategorized" })}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData("text/plain");
                if (!raw) return;
                try {
                  const data = JSON.parse(raw);
                  if (
                    data &&
                    (data.type === "folder" || data.type === "video") &&
                    Array.isArray(data.ids)
                  ) {
                    handleRootDrop(data);
                  }
                } catch {
                  // ignore
                }
              }}
            >
              <Folder className="w-4 h-4 shrink-0" /> Uncategorized
            </div>

            <div className="pt-3 pb-1 px-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Smart folders</span>
            </div>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                className={sidebarItem(
                  location.kind === "category" && location.category === c.value,
                )}
                onClick={() =>
                  handleGoTo({ kind: "category", category: c.value as "reel" | "rushes" | "other" })
                }
              >
                <Film className="w-4 h-4 shrink-0" /> {c.label}
              </button>
            ))}

            <div className="pt-4 pb-1 px-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Folders</span>
              <button
                className="text-muted-foreground hover:text-white"
                onClick={() => setCreating((v) => !v)}
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>

            {creating && (
              <form
                className="flex gap-1.5 px-1 pb-2"
                onSubmit={handleCreateFolder}
              >
                <Input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New folder"
                  className="h-8 bg-input border-border text-white text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={createMutation.isPending}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </form>
            )}

            <FolderTree
              folders={collections}
              selectedId={location.kind === "folder" ? location.id : null}
              expanded={expanded}
              onToggleExpand={(id) =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onSelect={(id) => handleGoTo({ kind: "folder", id })}
              onRename={(id, name) =>
                updateCollectionMutation.mutate({ id, data: { name } })
              }
              onDelete={handleDeleteFolder}
              onDrop={handleTreeDrop}
              onNewFolder={(parentId) => {
                setCreating(true);
                if (parentId != null) {
                  // If creating in a specific folder, the parent is set on submit.
                  // We temporarily navigate there so the new folder is created in the right place.
                  handleGoTo({ kind: "folder", id: parentId });
                }
              }}
            />
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0">
          {/* Breadcrumb + toolbar */}
          <div className="flex flex-col gap-4 mb-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                {breadcrumbs.length > 0 ? (
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink
                          className="cursor-pointer"
                          onClick={() => handleGoTo({ kind: "uncategorized" })}
                        >
                          Media Library
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      {breadcrumbs.map((crumb, idx) => {
                        const isLast = idx === breadcrumbs.length - 1;
                        return (
                          <BreadcrumbItem key={crumb.id}>
                            {isLast ? (
                              <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink
                                className="cursor-pointer"
                                onClick={() =>
                                  handleGoTo({ kind: "folder", id: crumb.id })
                                }
                              >
                                {crumb.name}
                              </BreadcrumbLink>
                            )}
                            {!isLast && <BreadcrumbSeparator />}
                          </BreadcrumbItem>
                        );
                      })}
                    </BreadcrumbList>
                  </Breadcrumb>
                ) : (
                  <h2 className="text-lg font-semibold text-white">
                    {isSearching ? "Search results" : locationTitle(location)}
                  </h2>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Search library */}
                <div className="flex items-center gap-2 bg-[#1a1a1a] border-[0.5px] border-[#3a3a38] rounded-lg px-3 py-[6px] min-w-[200px] focus-within:border-[#fb923c] focus-within:shadow-[0_0_0_1px_rgba(251,146,60,0.3)] transition-[border-color,box-shadow] duration-150">
                  <Search className="w-4 h-4 text-[#888888]" />
                  <input
                    type="search"
                    placeholder="Search library"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-transparent border-0 outline-none text-[#f2f2f2] text-[13px] w-full placeholder:text-[#888888]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={view === "grid" ? "bg-white/10" : ""}
                    onClick={() => setView("grid")}
                  >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={view === "list" ? "bg-white/10" : ""}
                  onClick={() => setView("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Bulk toolbar */}
            {selectedCount > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20 flex-wrap">
                <span className="text-sm font-medium text-white px-2">
                  {selectedCount} selected
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkMoveOpen(true)}
                >
                  <Move className="w-3.5 h-3.5 mr-1.5" /> Move to
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkCategoryOpen(true)}
                >
                  <Tag className="w-3.5 h-3.5 mr-1.5" /> Category
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkDownloadOpen(true)}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setSelectedItems(new Set());
                    setLastSelected(null);
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          {videosQuery.isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Film className="w-10 h-10" />}
              title="Good to have you here"
              description="Let's get your first upload sorted."
              action={
                <Button asChild>
                  <Link href="/videos/upload">
                    <UploadCloud className="w-4 h-4 mr-2" /> Upload video
                  </Link>
                </Button>
              }
            />
          ) : (
            <FileBrowser
              items={items}
              view={view}
              selectedItems={selectedItems}
              lastSelected={lastSelected}
              onSelect={handleSelect}
              onOpen={handleOpen}
              onDragStart={handleDragStart}
              onDrop={handleBrowserDrop}
              onRename={(id, name) =>
                updateCollectionMutation.mutate({ id, data: { name } })
              }
              onDelete={handleDeleteFolder}
              onShare={(video) => setShareVideo(video)}
              onDownload={(video, format) => {
                const a = document.createElement("a");
                a.href = buildDownloadHref(video.streamUid!, video.title, format);
                a.download = `${video.title.replace(/[^\w.-]+/g, "_")}-${format}.mp4`;
                a.target = "_blank";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
            />
          )}
        </main>
      </div>

      {/* Bulk move dialog */}
      <Dialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selectedCount} selected</DialogTitle>
            <DialogDescription>Choose a destination folder.</DialogDescription>
          </DialogHeader>
          <Select
            value={bulkMoveTarget == null ? "root" : String(bulkMoveTarget)}
            onValueChange={(val) =>
              setBulkMoveTarget(val === "root" ? null : parseInt(val, 10))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">Media Library (root)</SelectItem>
              {collections
                .filter((c) => !excludedMoveTargets.has(c.id))
                .sort((a, b) => a.path.localeCompare(b.path))
                .map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span style={{ paddingLeft: `${folderDepth(c) * 16}px` }}>
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setBulkMoveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkMove}
              disabled={
                bulkMoveMutation.isPending || updateCollectionMutation.isPending
              }
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk category dialog */}
      <Dialog open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set category</DialogTitle>
            <DialogDescription>
              Apply a category to the {selectedVideoIds.length} selected video(s).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <Button
                key={c.value}
                variant="secondary"
                onClick={() => handleBulkCategory(c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setBulkCategoryOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk download dialog */}
      <Dialog open={bulkDownloadOpen} onOpenChange={setBulkDownloadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download {selectedVideoIds.length} video(s)</DialogTitle>
            <DialogDescription>
              Choose a format. Videos without that format will use their first available format.
            </DialogDescription>
          </DialogHeader>
          <Select
            value={bulkDownloadFormat}
            onValueChange={setBulkDownloadFormat}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DOWNLOAD_FORMAT_LABELS).map(([value, meta]) => (
                <SelectItem key={value} value={value}>
                  {meta.label} — {meta.hint}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setBulkDownloadOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkDownload}>Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function itemKey(item: BrowserItem) {
  return item.kind === "folder"
    ? `folder-${item.collection.id}`
    : `video-${item.video.id}`;
}

function itemId(item: BrowserItem) {
  return item.kind === "folder" ? item.collection.id : item.video.id;
}
