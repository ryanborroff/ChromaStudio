import { useState } from "react";
import { useListVideos, getListVideosQueryKey } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video-card";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Search, SlidersHorizontal, Grid3X3, Check, ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "most_viewed", label: "Most Viewed" },
  { value: "community_rated", label: "Community Rated" },
] as const;

export function Explore() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [sort, setSort] = useState<"featured" | "newest" | "most_viewed" | "community_rated" | "community_rated_asc">("featured");
  const isCommunity = sort === "community_rated" || sort === "community_rated_asc";

  const { data, isLoading } = useListVideos(
    { search: debouncedSearch || undefined, sort },
    { query: { queryKey: getListVideosQueryKey({ search: debouncedSearch || undefined, sort }) } }
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* macOS-style sticky toolbar */}
      <div
        className="sticky top-12 z-10 flex items-center justify-between px-6 py-3"
        style={{
          background: "rgba(14,14,14,0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div>
          <h1 className="text-[15px] font-semibold text-white tracking-tight">Explore</h1>
          <p className="text-xs text-white/35 font-medium">Discover exceptional work.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort pills */}
          <div className="hidden sm:flex items-center gap-1 mr-2">
            {SORT_OPTIONS.map(opt => {
              const active = opt.value === "community_rated" ? isCommunity : sort === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${active ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}
                >
                  {opt.label}
                </button>
              );
            })}

            {/* Highest / Lowest toggle — community rated only */}
            {isCommunity && (
              <div className="flex items-center gap-0.5 ml-1 pl-2 border-l border-white/10">
                <button
                  onClick={() => setSort("community_rated")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${sort === "community_rated" ? "bg-primary/15 text-primary" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}
                  data-testid="btn-rated-highest"
                >
                  <ArrowDownWideNarrow className="w-3.5 h-3.5" />
                  Highest
                </button>
                <button
                  onClick={() => setSort("community_rated_asc")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${sort === "community_rated_asc" ? "bg-primary/15 text-primary" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}
                  data-testid="btn-rated-lowest"
                >
                  <ArrowUpNarrowWide className="w-3.5 h-3.5" />
                  Lowest
                </button>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 w-44 md:w-56 text-sm rounded-lg outline-none text-white/80 placeholder:text-white/25 focus:ring-1 focus:ring-primary/40 transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              data-testid="input-search-videos"
            />
          </div>

          {/* Sort dropdown — mobile only */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="sm:hidden h-8 w-8 flex items-center justify-center rounded-lg text-white/45 hover:text-white transition-all"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                aria-label="Sort"
                data-testid="btn-sort-mobile"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border">
              {SORT_OPTIONS.filter(opt => opt.value !== "community_rated").map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className="cursor-pointer text-sm justify-between gap-4"
                  data-testid={`sort-option-${opt.value}`}
                >
                  {opt.label}
                  {sort === opt.value && <Check className="w-3.5 h-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onClick={() => setSort("community_rated")}
                className="cursor-pointer text-sm justify-between gap-4"
                data-testid="sort-option-community_rated"
              >
                Community Rated · Highest
                {sort === "community_rated" && <Check className="w-3.5 h-3.5 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSort("community_rated_asc")}
                className="cursor-pointer text-sm justify-between gap-4"
                data-testid="sort-option-community_rated_asc"
              >
                Community Rated · Lowest
                {sort === "community_rated_asc" && <Check className="w-3.5 h-3.5 text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-white transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : data?.videos && data.videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {data.videos.map(video => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No videos found"
            description="We couldn't find any videos matching your search criteria. Try adjusting your filters."
          />
        )}
      </div>
    </div>
  );
}
