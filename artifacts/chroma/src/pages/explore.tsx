import { useState, Fragment } from "react";
import { useListVideos, getListVideosQueryKey } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video-card";
import { Search, SlidersHorizontal, Grid3X3, List, Check, ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronDown, Star, Film } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Link } from "wouter";
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

function pillClass(active: boolean) {
  return `text-[13px] font-medium px-4 py-[7px] rounded-[20px] cursor-pointer transition-colors duration-150 ease-[ease] ${
    active
      ? "bg-[#f2f2f2] text-[#111111]"
      : "bg-transparent text-[#b5b5b0] border-[0.5px] border-[#3a3a38] hover:border-[#55554f] hover:text-[#e0e0dc]"
  }`;
}

function VideoSkeletonCard() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="skeleton-shimmer relative aspect-video rounded-lg bg-[#1a1a1a] overflow-hidden" />
      <div className="h-3 rounded bg-[#1a1a1a] w-4/5" />
      <div className="h-[10px] rounded bg-[#1a1a1a] w-[45%]" />
    </div>
  );
}

function ExploreEmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="border-[0.5px] border-[#262624] rounded-xl px-8 py-12 text-center">
      <div className="w-14 h-14 rounded-full bg-[#241a12] flex items-center justify-center text-[#e08a3c] mx-auto mb-4">
        {hasFilters ? <Search className="w-[26px] h-[26px]" /> : <Film className="w-[26px] h-[26px]" />}
      </div>
      <h3 className="text-[18px] font-medium text-[#f2f2f2] mb-1.5">
        {hasFilters ? "Couldn't find that one" : "Be the first to publish"}
      </h3>
      <p className="text-sm text-[#9a9a94] leading-snug max-w-[340px] mx-auto mb-5">
        {hasFilters
          ? "Try a different word, or browse what's trending."
          : "Trending work will appear here once creators start uploading. Upload yours to kick things off."}
      </p>
      {hasFilters ? (
        <button
          onClick={onClear}
          className="inline-block bg-transparent text-[#f2f2f2] text-[13px] font-medium px-5 py-[9px] rounded-lg border-[0.5px] border-[#3a3a38] hover:border-[#55554f] hover:bg-[#1a1a1a] transition-colors"
        >
          Clear filters
        </button>
      ) : (
        <Link
          href="/videos/upload"
          className="inline-block bg-[#e0631f] text-white text-[13px] font-medium px-5 py-[9px] rounded-lg hover:bg-[#c8551a] transition-colors"
        >
          Upload a video
        </Link>
      )}
    </div>
  );
}

export function Explore() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [sort, setSort] = useState<"featured" | "newest" | "most_viewed" | "community_rated" | "community_rated_asc">("featured");
  const [view, setView] = useState<"grid" | "list">("grid");
  const isCommunity = sort === "community_rated" || sort === "community_rated_asc";

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

  const hasFilters = search.trim() !== "" || sort !== "featured";
  const showEmpty = !isLoading && mainVideos.length === 0 && (!showFeaturedStrip || featuredVideos.length === 0);

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
          <h1 className="text-[28px] font-medium text-[#f2f2f2] mb-1">Explore</h1>
          <p className="text-sm font-normal text-[#9a9a94]">Discover exceptional work.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort pills */}
          <div className="hidden sm:flex items-center gap-1 mr-2">
            {SORT_OPTIONS.map(opt => (
              opt.value === "community_rated" ? (
                <DropdownMenu key="community_rated">
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-1 ${pillClass(isCommunity)}`}
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
                >
                  {opt.label}
                </button>
              )
            ))}
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 bg-[#1a1a1a] border-[0.5px] border-[#3a3a38] rounded-lg px-3 py-[6px] min-w-[200px] focus-within:border-[#e0631f] focus-within:shadow-[0_0_0_1px_rgba(224,99,31,0.3)] transition-[border-color,box-shadow] duration-150"
          >
            <Search className="w-4 h-4 text-[#888888]" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-0 outline-none text-[#f2f2f2] text-[13px] w-full placeholder:text-[#888888]"
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

          <button
            onClick={() => setView(view === "grid" ? "list" : "grid")}
            aria-label="Toggle layout"
            title="Toggle layout"
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
          <section aria-label="Loading videos">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <VideoSkeletonCard key={i} />
              ))}
            </div>
          </section>
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
        ) : showEmpty ? (
          <ExploreEmptyState
            hasFilters={hasFilters}
            onClear={() => {
              setSearch("");
              setSort("featured");
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
