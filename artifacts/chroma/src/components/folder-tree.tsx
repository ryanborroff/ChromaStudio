import { useMemo, useState, useRef, useEffect } from "react";
import type { Collection } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

interface FolderTreeNode {
  collection: Collection;
  children: FolderTreeNode[];
}

export interface FolderTreeProps {
  folders: Collection[];
  selectedId: number | null;
  expanded: Set<number>;
  onToggleExpand: (id: number) => void;
  onSelect: (id: number) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onDrop?: (targetId: number, data: { type: "folder" | "video"; ids: number[] }) => void;
  onNewFolder?: (parentId: number | null) => void;
}

function buildTree(folders: Collection[]): FolderTreeNode[] {
  const map = new Map<number, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  for (const c of folders) {
    map.set(c.id, { collection: c, children: [] });
  }

  for (const c of folders) {
    const node = map.get(c.id)!;
    if (c.parentId == null) {
      roots.push(node);
    } else {
      const parent = map.get(c.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  roots.sort((a, b) => a.collection.name.localeCompare(b.collection.name));
  for (const node of map.values()) {
    node.children.sort((a, b) => a.collection.name.localeCompare(b.collection.name));
  }

  return roots;
}

function TreeRow({
  node,
  depth,
  selectedId,
  expanded,
  onToggleExpand,
  onSelect,
  onRename,
  onDelete,
  onDrop,
  onNewFolder,
}: {
  node: FolderTreeNode;
  depth: number;
  selectedId: number | null;
  expanded: Set<number>;
  onToggleExpand: (id: number) => void;
  onSelect: (id: number) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onDrop?: (targetId: number, data: { type: "folder" | "video"; ids: number[] }) => void;
  onNewFolder?: (parentId: number | null) => void;
}) {
  const { collection, children } = node;
  const isOpen = expanded.has(collection.id);
  const isSelected = selectedId === collection.id;
  const hasChildren = children.length > 0;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function startRename() {
    setEditName(collection.name);
    setIsEditing(true);
  }

  function submitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== collection.name) onRename(collection.id, trimmed);
    setIsEditing(false);
  }

  function onDragOverItem(e: React.DragEvent) {
    if (!onDrop) return;
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeaveItem(e: React.DragEvent) {
    setDragOver(false);
  }

  function onDropItem(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!onDrop) return;
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data && (data.type === "folder" || data.type === "video") && Array.isArray(data.ids)) {
        onDrop(collection.id, data);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 pr-2 py-1.5 rounded-lg text-sm select-none transition-colors",
          isSelected
            ? "bg-primary/15 text-white"
            : "text-muted-foreground hover:bg-white/5 hover:text-white",
          dragOver && "bg-primary/25 ring-1 ring-primary/50",
        )}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(collection.id);
        }}
        onDragOver={onDragOverItem}
        onDragLeave={onDragLeaveItem}
        onDrop={onDropItem}
      >
        <button
          className={cn(
            "p-0.5 rounded hover:bg-white/10 transition-transform",
            hasChildren ? "visible" : "invisible",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(collection.id);
          }}
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {isSelected || isOpen ? (
          <FolderOpen className="w-4 h-4 shrink-0 text-primary" />
        ) : (
          <Folder className="w-4 h-4 shrink-0" />
        )}

        {isEditing ? (
          <form
            className="flex-1 min-w-0 flex gap-1"
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
              className="h-6 py-0 text-xs bg-input border-border text-white"
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Escape") setIsEditing(false);
              }}
            />
          </form>
        ) : (
          <span className="truncate flex-1 min-w-0">{collection.name}</span>
        )}

        <span className="text-xs text-muted-foreground tabular-nums">
          {collection.videoCount}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                startRename();
              }}
            >
              <Pencil className="w-3.5 h-3.5" /> Rename
            </DropdownMenuItem>
            {onNewFolder && (
              <DropdownMenuItem
                className="gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewFolder(collection.id);
                }}
              >
                <Folder className="w-3.5 h-3.5" /> New folder
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="gap-2 text-red-400 focus:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(collection.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isOpen && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeRow
              key={child.collection.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onDrop={onDrop}
              onNewFolder={onNewFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({
  folders,
  selectedId,
  expanded,
  onToggleExpand,
  onSelect,
  onRename,
  onDelete,
  onDrop,
  onNewFolder,
}: FolderTreeProps) {
  const tree = useMemo(() => buildTree(folders), [folders]);

  if (tree.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
        No folders yet.
        {onNewFolder && (
          <div className="mt-2">
            <Button variant="ghost" size="sm" onClick={() => onNewFolder(null)}>
              <Folder className="w-3.5 h-3.5 mr-1.5" /> New folder
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <TreeRow
          key={node.collection.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
          onDrop={onDrop}
          onNewFolder={onNewFolder}
        />
      ))}
    </div>
  );
}
