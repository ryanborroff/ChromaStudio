import { Link } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { Film, Heart, Eye, Play } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Video } from "@workspace/api-client-react";

interface VideoCardProps {
  video: Video;
  showAuthor?: boolean;
}

export function VideoCard({ video, showAuthor = true }: VideoCardProps) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
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
            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <Film className="w-10 h-10 text-white/15" />
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
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
          >
            <Play className="w-3 h-3 text-white fill-white ml-0.5" />
          </div>
        </div>
      </Link>

      {/* Meta */}
      <div className="px-4 py-3 flex gap-3">
        {showAuthor && video.user && (
          <Link href={`/profile/${video.user.username}`} className="flex-shrink-0 mt-0.5">
            <Avatar className="h-8 w-8" data-testid={`video-author-avatar-${video.id}`}>
              <AvatarImage src={video.user.avatarUrl || undefined} />
              <AvatarFallback className="text-xs font-semibold" style={{ background: "rgba(229,62,62,0.15)", color: "hsl(0 80% 65%)" }}>
                {video.user.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        )}

        <div className="flex flex-col flex-1 min-w-0">
          <Link
            href={`/videos/${video.id}`}
            className="font-semibold text-sm text-white/90 leading-tight truncate hover:text-primary transition-colors tracking-tight"
            data-testid={`video-title-${video.id}`}
          >
            {video.title}
          </Link>

          {showAuthor && video.user && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Link
                href={`/profile/${video.user.username}`}
                className="text-xs text-white/40 hover:text-white/70 transition-colors truncate"
                data-testid={`video-author-name-${video.id}`}
              >
                {video.user.name}
              </Link>
              {video.user.profession && (
                <>
                  <span className="text-white/20 text-xs">·</span>
                  <span className="text-xs text-white/25 truncate">{video.user.profession}</span>
                </>
              )}
            </div>
          )}

          <span className="text-xs text-white/25 mt-1" data-testid={`video-date-${video.id}`}>
            {format(new Date(video.createdAt), "MMM d, yyyy")}
          </span>
        </div>
      </div>
    </div>
  );
}
