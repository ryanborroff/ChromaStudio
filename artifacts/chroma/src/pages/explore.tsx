import { useState, Fragment } from "react";
import { Link } from "wouter";
import { useListVideos, getListVideosQueryKey } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video-card";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Search, SlidersHorizontal, Grid3X3, List, Check, ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, Star } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SORT_OPTIONS = [
  { value: "featured", label: "Trending" },
  { value: "community_rated", label: "Community Rated" },
  { value: "most_viewed", label: "Most Viewed" },
  { value: "newest", label: "Newest" },
] as const;

// Shared pill class builder
function pillClass(active: boolean) {
  return [
    "flex items-center gap-1 px-4 py-[7px] rounded-full text-[13px] font-medium transition-colors cursor-pointer",
    active
      ? "bg-[#f2f2f2] text-[#111111]"
      : "bg-transparent text-[#b5b5b0] hover:text-[#e0e0dc]",
  ].join(" ");
}

function pillStyle(active: boolean): React.CSSProperties | undefined {
  return active ? undefined : { border: "0.5px solid #3a3a38" };
}

export function Explore() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [sort, setSort] = useState<"featured" | "newest" | "most_viewed" | "community_rated" | "community_rated_asc">("featured");
  const [view, setView] = useState<"grid" | "list">("grid");
  const isCommunity = sort === "community_rated" || sort === "community_rated_asc";

  // True when any filter/search is active (affects empty-state variant)
  const hasFilters = !!debouncedSearch || sort !== "featured";

  const showFeaturedStrip = sort === "featured" && !debouncedSearch;

  const { data: featuredData } = useListVideos(
    { featured: true, limit: 6 },
    {
      query: {
        enabled: showFeaturedStrip,
        queryKey: getListVideosQueryKey({ featured: true, limit: 6 }),
      },
    },
  );

  const { data, isLoading } = useListVideos(
    { search: debouncedSearch || undefined, sort },
    { query: { queryKey: getListVideosQueryKey({ search: debouncedSearch || undefined, sort }) } }
  );

  const featuredVideos = featuredData?.videos ?? [];
  const featuredIds = new Set(featuredVideos.map(v => v.id));
  const mainVideos = showFeaturedStrip && featuredVideos.length > 0
    ? (data?.videos ?? []).filter(v => !featuredIds.has(v.id))
    : (data?.videos ?? []);

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
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            {SORT_OPTIONS.map(opt =>
              opt.value === "community_rated" ? (
                <DropdownMenu key="community_rated">
                  <DropdownMenuTrigger asChild>
                    <button
                      className={pillClass(isCommunity)}
                      style={pillStyle(isCommunity)}
                      data-testid="btn-community-rated"
                    >
                      Community Rated
                      <ChevronDown className="w-3 h-3 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border">
                    <DropdownMenuItem
                      onClick={() => setSort("community_rated")}
                      className="cursor-pointer text-sm justify-between gap-4"
                      data-testid="sort-option-community_rated"
                    >
                      <span className="flex items-center gap-2"><ArrowDownWideNarrow className="w-3.5 h-3.5" /> Highest</span>
                      {sort === "community_rated" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSort("community_rated_asc")}
                      className="cursor-pointer text-sm justify-between gap-4"
                      data-testid="sort-option-community_rated_asc"
                    >
                      <span className="flex items-center gap-2"><ArrowUpNarrowWide className="w-3.5 h-3.5" /> Lowest</span>
                      {sort === "community_rated_asc" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={pillClass(sort === opt.value)}
                  style={pillStyle(sort === opt.value)}
                >
                  {opt.label}
                </button>
              )
            )}
          </div>

          {/* Search — distinct input styling with orange focus ring */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 min-w-[200px] transition-colors focus-within:shadow-[0_0_0_1px_rgba(224,99,31,0.3)]"
            style={{ background: "#1a1a1a", border: "0.5px solid #3a3a38" }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: "#888888" }} />
            <input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] w-full py-[6px]"
              style={{ color: "#f2f2f2" }}
              placeholder-style={{ color: "#888888" }}
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
              {SORT_OPTIONS.map(opt => (
                opt.value === "community_rated" ? (
                  <Fragment key="community_rated">
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
                  </Fragment>
                ) : (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setSort(opt.value)}
                    className="cursor-pointer text-sm justify-between gap-4"
                    data-testid={`sort-option-${opt.value}`}
                  >
                    {opt.label}
                    {sort === opt.value && <Check className="w-3.5 h-3.5 text-primary" />}
                  </DropdownMenuItem>
                )
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Grid / list toggle */}
          <button
            onClick={() => setView(view === "grid" ? "list" : "grid")}
            aria-label={view === "grid" ? "Switch to list view" : "Switch to grid view"}
            title={view === "grid" ? "Switch to list view" : "Switch to grid view"}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-white transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            data-testid="button-view-toggle"
          >
            {view === "grid" ? <Grid3X3 className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-1 space-y-10">
        {/* Featured Picks strip — only on Trending tab, no active search */}
        {showFeaturedStrip && featuredVideos.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Editor's Picks</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {featuredVideos.map(video => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        )}

        {/* Main grid */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : mainVideos.length > 0 ? (
          <section>
            {showFeaturedStrip && featuredVideos.length > 0 && (
              <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">All Videos</h2>
            )}
            <div className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4" : "grid grid-cols-1 gap-4 max-w-3xl"}>
              {mainVideos.map(video => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        ) : !showFeaturedStrip || featuredVideos.length === 0 ? (
          hasFilters ? (
            /* Variant B: search/filter active, zero results */
            <EmptyState
              title="No matches found"
              description="Try a different search term or clear your filters."
              action={
                <button
                  onClick={() => { setSearch(""); setSort("featured"); }}
                  className="text-[13px] font-medium px-5 py-[9px] rounded-lg transition-colors hover:bg-white/5"
                  style={{ background: "transparent", color: "#f2f2f2", border: "0.5px solid #3a3a38" }}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            /* Variant A: genuinely empty catalogue */
            <EmptyState
              title="Be the first to publish"
              description="Trending work will appear here once creators start uploading. Upload yours to kick things off."
              action={
                <Link
                  href="/videos/upload"
                  className="inline-block text-[13px] font-medium px-5 py-[9px] rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ background: "#e0631f" }}
                >
                  Upload a video
                </Link>
              }
            />
          )
        ) : null}
      </div>
    </div>
  );
}
