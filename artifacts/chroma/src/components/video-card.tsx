import { Link } from "wouter";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Film, Heart, Eye, Play, Award, Sparkles, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "@/components/star-rating";
import type { Video } from "@workspace/api-client-react";

interface VideoCardProps {
  video: Video;
  showAuthor?: boolean;
}

const TAG_POOL = [
  { label: "Staff Pick", icon: Sparkles, bg: "rgba(245,158,11,0.16)", fg: "#f5c667", border: "rgba(245,158,11,0.3)" },
  { label: "Award Winner", icon: Award, bg: "rgba(251,146,60,0.16)", fg: "#fdba8c", border: "rgba(251,146,60,0.3)" },
  { label: "4K", icon: Zap, bg: "rgba(251,191,36,0.14)", fg: "#fde68a", border: "rgba(251,191,36,0.28)" },
] as const;

/** Deterministic mock tag(s) derived from video id — stable across renders. */
function getVideoTags(id: number) {
  const tags = [];
  if (id % 3 === 0) tags.push(TAG_POOL[0]);
  if (id % 5 === 0) tags.push(TAG_POOL[1]);
  if (id % 4 === 0) tags.push(TAG_POOL[2]);
  return tags.slice(0, 2);
}

export function VideoCard({ video, showAuthor = true }: VideoCardProps) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tags = useMemo(() => getVideoTags(video.id), [video.id]);

  return (
    <div
      className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
      style={{
        background: "#111116",
        border: "1px solid #232329",
        boxShadow: hovered ? "0 8px 40px rgba(0,0,0,0.5)" : "0 2px 12px rgba(0,0,0,0.3)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid={`video-card-${video.id}`}
    >
      {/* Thumbnail */}
      <Link href={`/videos/${video.id}`} className="block relative aspect-video overflow-hidden">
        {video.thumbnailUrl && !imgError ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="object-cover w-full h-full transition-transform duration-700 ease-out group-hover:scale-110"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <Film className="w-10 h-10 text-white/15" />
          </div>
        )}

        {/* Tag badges */}
        {tags.length > 0 && (
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
            {tags.map(({ label, icon: Icon, bg, fg, border }) => (
              <span
                key={label}
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm"
                style={{ background: bg, color: fg, border: `1px solid ${border}` }}
              >
                <Icon className="w-2.5 h-2.5" />
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Gradient + stats overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-medium text-white/65">
              <Eye className="w-3 h-3" />{video.viewCount}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-white/65">
              <Heart className="w-3 h-3" />{video.likeCount}
            </span>
          </div>
          {/* Play button bloom */}
          <div className="relative w-9 h-9 flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
            <div
              className="absolute inset-0 rounded-full blur-md"
              style={{ background: "rgba(245,158,11,0.55)" }}
            />
            <div
              className="relative w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 2px 12px rgba(245,158,11,0.5)" }}
            >
              <Play className="w-3.5 h-3.5 text-black fill-black ml-0.5" />
            </div>
          </div>
        </div>
      </Link>

      {/* Meta */}
      <div className="px-4 py-3 flex gap-3">
        {showAuthor && video.user && (
          <Link href={`/profile/${video.user.username}`} className="flex-shrink-0 mt-0.5">
            <Avatar className="h-8 w-8" data-testid={`video-author-avatar-${video.id}`}>
              <AvatarImage src={video.user.avatarUrl || undefined} />
              <AvatarFallback className="text-xs font-semibold" style={{ background: "rgba(255,176,32,0.15)", color: "hsl(39 100% 65%)" }}>
                {video.user.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        )}

        <div className="flex flex-col flex-1 min-w-0">
          <Link
            href={`/videos/${video.id}`}
            className="font-medium text-sm text-[#f2f2f2] leading-tight truncate transition-colors duration-200 tracking-tight group-hover:text-[#f5c667]"
            data-testid={`video-title-${video.id}`}
          >
            {video.title}
          </Link>

          {showAuthor && video.user && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Link
                href={`/profile/${video.user.username}`}
                className="text-xs text-[#9a9a94] hover:text-white/70 transition-colors truncate"
                data-testid={`video-author-name-${video.id}`}
              >
                {video.user.name}
              </Link>
              {video.user.profession && (
                <>
                  <span className="text-white/20 text-xs">·</span>
                  <span className="text-xs text-[#9a9a94] truncate">{video.user.profession}</span>
                </>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-1.5">
            <StarRating
              videoId={video.id}
              ratingAvg={video.ratingAvg ?? 0}
              ratingCount={video.ratingCount ?? 0}
              userRating={video.userRating ?? null}
            />
            <span className="text-xs text-[#9a9a94] shrink-0" data-testid={`video-date-${video.id}`}>
              {format(new Date(video.createdAt), "MMM d, yyyy")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
