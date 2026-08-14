import { Link } from "wouter";
import { Play, Bookmark, Film } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Video } from "@workspace/api-client-react";

interface HeroFeaturedProps {
  video: Video;
}

export function HeroFeatured({ video }: HeroFeaturedProps) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl mb-10"
      style={{ border: "1px solid #232329" }}
      data-testid={`hero-featured-${video.id}`}
    >
      <div className="relative aspect-[21/9] sm:aspect-[21/8] w-full">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#111116]">
            <Film className="w-16 h-16 text-white/10" />
          </div>
        )}

        {/* Cinematic gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080809] via-[#080809]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080809]/80 via-transparent to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          <span
            className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full mb-4"
            style={{ background: "rgba(245,158,11,0.16)", color: "#f5c667", border: "1px solid rgba(245,158,11,0.3)" }}
          >
            Featured
          </span>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3 max-w-2xl leading-[1.1]">
            {video.title}
          </h1>

          {video.description && (
            <p className="text-white/60 text-sm sm:text-base max-w-xl leading-relaxed mb-5 line-clamp-2">
              {video.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/videos/${video.id}`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 20px rgba(245,158,11,0.35)" }}
              data-testid="btn-hero-watch"
            >
              <Play className="w-4 h-4 fill-black" />
              Watch Now
            </Link>
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-colors hover:bg-white/10"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
              data-testid="btn-hero-save"
            >
              <Bookmark className="w-4 h-4" />
              Save
            </button>

            {video.user && (
              <Link
                href={`/profile/${video.user.username}`}
                className="flex items-center gap-2 ml-1 group"
                data-testid="link-hero-author"
              >
                <Avatar className="h-8 w-8 ring-2 ring-white/10">
                  <AvatarImage src={video.user.avatarUrl || undefined} />
                  <AvatarFallback className="text-xs font-semibold" style={{ background: "rgba(245,158,11,0.15)", color: "#f5c667" }}>
                    {video.user.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-medium text-white/90 group-hover:text-[#f5c667] transition-colors">
                    {video.user.name}
                  </span>
                  {video.user.profession && (
                    <span className="text-xs text-white/40">{video.user.profession}</span>
                  )}
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
