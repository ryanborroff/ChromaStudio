import { Link, useParams } from "wouter";
import {
  getGetPublicPortfolioQueryKey,
  useGetPublicPortfolio,
} from "@workspace/api-client-react";
import { Loader2, ExternalLink, Film } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { VideoCard } from "@/components/video-card";

export function PublicPortfolio() {
  const { handle = "" } = useParams();
  const { data, isLoading, isError } = useGetPublicPortfolio(handle, {
    query: {
      enabled: !!handle,
      retry: false,
      queryKey: getGetPublicPortfolioQueryKey(handle),
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState
        title="Portfolio unavailable"
        description="This portfolio is unpublished or does not exist."
      />
    );
  }

  const { portfolio, videos } = data;
  return (
    <main
      className="min-h-screen bg-background"
      style={
        { "--portfolio-accent": portfolio.accentColor } as React.CSSProperties
      }
    >
      {portfolio.bannerUrl && (
        <div
          className="h-64 w-full bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url(${portfolio.bannerUrl})` }}
        />
      )}
      <div className="container mx-auto max-w-6xl px-6 py-12">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <Avatar className="h-24 w-24 border-2 border-primary/50">
            <AvatarImage src={portfolio.avatarUrl ?? undefined} />
            <AvatarFallback>
              {portfolio.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">
              Chroma portfolio
            </p>
            <h1 className="mt-2 text-4xl font-black text-white">
              {portfolio.displayName}
            </h1>
            <p className="text-white/50">@{portfolio.handle}</p>
          </div>
          <Link
            href={`/profile/${portfolio.handle}`}
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
          >
            Profile <ExternalLink className="h-4 w-4" />
          </Link>
        </header>
        {portfolio.bio && (
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/65">
            {portfolio.bio}
          </p>
        )}
        <section className="mt-14">
          <div className="mb-6 flex items-center gap-3">
            <Film className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-white">Selected work</h2>
          </div>
          {videos.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} showAuthor={false} />
              ))}
            </div>
          ) : (
            <p className="text-white/45">
              Selected work will appear here soon.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
