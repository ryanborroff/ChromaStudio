import { Link } from "wouter";
import { useState } from "react";
import { format } from "date-fns";
import { Film, Heart, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Video } from "@workspace/api-client-react";

interface VideoCardProps {
  video: Video;
  showAuthor?: boolean;
}

export function VideoCard({ video, showAuthor = true }: VideoCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group flex flex-col gap-3" data-testid={`video-card-${video.id}`}>
      <Link href={`/videos/${video.id}`} className="block relative aspect-video rounded-xl overflow-hidden bg-card border border-border/50">
        {video.thumbnailUrl && !imgError ? (
          <img 
            src={video.thumbnailUrl} 
            alt={video.title}
            className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-card transition-transform duration-500 group-hover:scale-105">
            <Film className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </Link>
      
      <div className="flex gap-3">
        {showAuthor && video.user && (
          <Link href={`/profile/${video.user.username}`}>
            <Avatar className="h-9 w-9 mt-1 border border-border/50" data-testid={`video-author-avatar-${video.id}`}>
              <AvatarImage src={video.user.avatarUrl || undefined} />
              <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                {video.user.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
          </Link>
        )}
        
        <div className="flex flex-col flex-1 min-w-0">
          <Link href={`/videos/${video.id}`} className="font-semibold text-white leading-tight truncate hover:text-primary transition-colors" data-testid={`video-title-${video.id}`}>
            {video.title}
          </Link>
          
          {showAuthor && video.user && (
            <Link href={`/profile/${video.user.username}`} className="text-sm text-muted-foreground hover:text-white transition-colors truncate mt-1" data-testid={`video-author-name-${video.id}`}>
              {video.user.name}
            </Link>
          )}
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 font-medium">
            <span className="flex items-center gap-1" data-testid={`video-views-${video.id}`}>
              <Eye className="w-3.5 h-3.5" />
              {video.viewCount}
            </span>
            <span className="flex items-center gap-1" data-testid={`video-likes-${video.id}`}>
              <Heart className="w-3.5 h-3.5" />
              {video.likeCount}
            </span>
            <span>•</span>
            <span data-testid={`video-date-${video.id}`}>{format(new Date(video.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}