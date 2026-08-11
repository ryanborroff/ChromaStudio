import { useRef, useEffect, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { Collection, Video } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DOWNLOAD_FORMAT_LABELS } from "@/lib/downloadFormats";
import {
  Folder,
  FolderOpen,
  Film,
  MoreHorizontal,
  Pencil,
  Trash2,
  Share2,
  Download,
  Eye,
  Heart,
  Lock,
  GripVertical,
} from "lucide-react";

export type BrowserItem =
  | { kind: "folder"; collection: Collection }
  | { kind: "video"; video: Video };

const CATEGORIES = [
  { value: "reel", label: "Reel" },
  { value: "rushes", label: "Rushes" },
  { value: "other", label: "Other" },
] as const;

const categoryLabel = (c?: string | null) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? "Other";

export interface FileBrowserProps {
  items: BrowserItem[];
  view: "grid" | "list";
  selectedItems: Set<string>;
  lastSelected: string | null;
  onSelect: (key: string, index: number, e: React.MouseEvent) => void;
  onOpen: (item: BrowserItem) => void;
  onDragStart: (item: BrowserItem, e: React.DragEvent) => void;
  onDrop?: (
    target: BrowserItem,
    data: { type: "folder" | "video"; ids: number[] },
  ) => void;
  onRename?: (id: number, name: string) => void;
  onDelete?: (id: number) => void;
  onShare?: (video: Video) => void;
  onDownload?: (video: Video, format: string) => void;
}

function itemKey(item: BrowserItem) {
  return `${item.kind}-${item.kind === "folder" ? item.collection.id : item.video.id}`;
}

function itemId(item: BrowserItem) {
  return item.kind === "folder" ? item.collection.id : item.video.id;
}

function VideoCard({
  video,
  selected,
  onSelect,
  onOpen,
  onDragStart,
  onShare,
  onDownload,
}: {
  video: Video;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onShare?: (video: Video) => void;
  onDownload?: (video: Video, format: string) => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={cn(
        "group relative rounded-xl border overflow-hidden cursor-pointer transition-all",
        selected
          ? "border-primary ring-2 ring-primary/50"
          : "border-border/50 bg-card hover:border-primary/30",
      )}
      onClick={onSelect}
      onDoubleClick={onOpen}
      draggable
      onDragStart={onDragStart}
      data-testid={`video-card-${video.id}`}
    >
      <Link
        href={`/videos/${video.id}`}
        className="block aspect-video bg-black relative"
        onClick={(e) => e.preventDefault()}
      >
        {video.thumbnailUrl && !imgError ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-8 h-8 text-white/30" />
          </div>
        )}
        <Badge className="absolute top-2 left-2 bg-black/70 text-white border-0 text-[10px]">
          {categoryLabel(video.category)}
        </Badge>
        {video.shareEnabled && (
          <span className="absolute top-2 right-2 flex items-center gap-1 bg-primary/90 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
            {video.hasSharePassword && <Lock className="w-2.5 h-2.5" />} Shared
          </span>
        )}
      </Link>

      <div className="p-3 flex flex-col gap-2">
        <p className="text-sm font-semibold text-white line-clamp-1">
          {video.title}
        </p>
        <div className="flex items-center gap-3 text-xs text-white/55">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {video.viewCount}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" />
            {video.likeCount}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-auto">
          {onShare && (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onShare(video);
              }}
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
            </Button>
          )}

          {video.streamUid && video.downloadFormats && video.downloadFormats.length > 0 && onDownload ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 flex-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Download formats</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {video.downloadFormats.map((fmt) => {
                  const meta = DOWNLOAD_FORMAT_LABELS[fmt];
                  return (
                    <DropdownMenuItem
                      key={fmt}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload(video, fmt);
                      }}
                    >
                      <span className="font-medium">{meta?.label ?? fmt}</span>
                      {meta?.hint && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {meta.hint}
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 flex-1"
              disabled
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FolderCard({
  collection,
  selected,
  onSelect,
  onOpen,
  onDragStart,
  onDrop,
  onRename,
  onDelete,
}: {
  collection: Collection;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDrop?: (data: { type: "folder" | "video"; ids: number[] }) => void;
  onRename?: (id: number, name: string) => void;
  onDelete?: (id: number) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function submitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== collection.name && onRename) {
      onRename(collection.id, trimmed);
    }
    setIsEditing(false);
  }

  return (
    <div
      className={cn(
        "group relative rounded-xl border p-4 cursor-pointer transition-all",
        selected
          ? "border-primary ring-2 ring-primary/50"
          : "border-border/50 bg-card hover:border-primary/30",
        dragOver && "border-primary ring-2 ring-primary/50",
      )}
      onClick={onSelect}
      onDoubleClick={onOpen}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        if (!onDrop) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (!onDrop) return;
        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;
        try {
          const data = JSON.parse(raw);
          if (
            data &&
            (data.type === "folder" || data.type === "video") &&
            Array.isArray(data.ids)
          ) {
            onDrop(data);
          }
        } catch {
          // ignore
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-1">
          {selected || dragOver ? (
            <FolderOpen className="w-10 h-10 text-primary" />
          ) : (
            <Folder className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitRename();
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 text-sm bg-input border-border text-white"
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsEditing(false);
                }}
              />
            </form>
          ) : (
            <p className="text-sm font-semibold text-white truncate">
              {collection.name}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            {collection.videoCount} videos
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/10 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setEditName(collection.name);
                setIsEditing(true);
              }}
            >
              <Pencil className="w-3.5 h-3.5" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-red-400 focus:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(collection.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ListRow({
  item,
  index,
  selected,
  onSelect,
  onOpen,
  onDragStart,
  onDrop,
  onRename,
  onDelete,
  onShare,
  onDownload,
}: {
  item: BrowserItem;
  index: number;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDrop?: (data: { type: "folder" | "video"; ids: number[] }) => void;
  onRename?: (id: number, name: string) => void;
  onDelete?: (id: number) => void;
  onShare?: (video: Video) => void;
  onDownload?: (video: Video, format: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-pointer",
        selected
          ? "bg-primary/15 border-primary/50"
          : "border-transparent hover:bg-white/5",
        dragOver && "bg-primary/10 border-primary/50",
      )}
      onClick={onSelect}
      onDoubleClick={onOpen}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        if (item.kind !== "folder" || !onDrop) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (item.kind !== "folder" || !onDrop) return;
        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;
        try {
          const data = JSON.parse(raw);
          if (
            data &&
            (data.type === "folder" || data.type === "video") &&
            Array.isArray(data.ids)
          ) {
            onDrop(data);
          }
        } catch {
          // ignore
        }
      }}
    >
      {item.kind === "folder" ? (
        <>
          <FolderOpen className="w-5 h-5 shrink-0 text-primary" />
          <span className="flex-1 min-w-0 text-sm font-medium text-white truncate">
            {item.collection.name}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">
            {item.collection.videoCount} videos
          </span>
          <div className="opacity-0 group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1.5 hover:bg-white/10 rounded"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem
                  className="gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    // handled by parent via onRename? list row inline edit is complex; open a dialog in parent
                    onRename?.(item.collection.id, item.collection.name);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-red-400 focus:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(item.collection.id);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      ) : (
        <>
          <Film className="w-5 h-5 shrink-0 text-white/40" />
          <span className="flex-1 min-w-0 text-sm font-medium text-white truncate">
            {item.video.title}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {categoryLabel(item.video.category)}
          </Badge>
          <span className="text-xs text-muted-foreground w-24 text-right hidden sm:block">
            {format(new Date(item.video.createdAt), "MMM d, yyyy")}
          </span>
          <span className="text-xs text-muted-foreground w-16 text-right hidden sm:block">
            {item.video.viewCount}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            {onShare && (
              <button
                className="p-1.5 hover:bg-white/10 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(item.video);
                }}
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
            {item.video.streamUid &&
              item.video.downloadFormats &&
              item.video.downloadFormats.length > 0 &&
              onDownload && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1.5 hover:bg-white/10 rounded"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel>Download formats</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {item.video.downloadFormats.map((fmt) => {
                      const meta = DOWNLOAD_FORMAT_LABELS[fmt];
                      return (
                        <DropdownMenuItem
                          key={fmt}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownload(item.video, fmt);
                          }}
                        >
                          <span className="font-medium">
                            {meta?.label ?? fmt}
                          </span>
                          {meta?.hint && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              {meta.hint}
                            </span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
          </div>
        </>
      )}
    </div>
  );
}

export function FileBrowser({
  items,
  view,
  selectedItems,
  lastSelected,
  onSelect,
  onOpen,
  onDragStart,
  onDrop,
  onRename,
  onDelete,
  onShare,
  onDownload,
}: FileBrowserProps) {
  if (view === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {items.map((item, index) => {
          const key = itemKey(item);
          const selected = selectedItems.has(key);
          if (item.kind === "folder") {
            return (
              <FolderCard
                key={key}
                collection={item.collection}
                selected={selected}
                onSelect={(e) => onSelect(key, index, e)}
                onOpen={() => onOpen(item)}
                onDragStart={(e) => onDragStart(item, e)}
                onDrop={onDrop ? (data) => onDrop(item, data) : undefined}
                onRename={onRename}
                onDelete={onDelete}
              />
            );
          }
          return (
            <VideoCard
              key={key}
              video={item.video}
              selected={selected}
              onSelect={(e) => onSelect(key, index, e)}
              onOpen={() => onOpen(item)}
              onDragStart={(e) => onDragStart(item, e)}
              onShare={onShare}
              onDownload={onDownload}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item, index) => {
        const key = itemKey(item);
        const selected = selectedItems.has(key);
        return (
          <ListRow
            key={key}
            item={item}
            index={index}
            selected={selected}
            onSelect={(e) => onSelect(key, index, e)}
            onOpen={() => onOpen(item)}
            onDragStart={(e) => onDragStart(item, e)}
            onDrop={onDrop ? (data) => onDrop(item, data) : undefined}
            onRename={onRename}
            onDelete={onDelete}
            onShare={onShare}
            onDownload={onDownload}
          />
        );
      })}
    </div>
  );
}
