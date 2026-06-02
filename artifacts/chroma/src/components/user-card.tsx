import { Link } from "wouter";
import { MapPin, Film } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { User } from "@workspace/api-client-react";

interface UserCardProps {
  user: User;
}

export function UserCard({ user }: UserCardProps) {
  return (
    <Link href={`/profile/${user.username}`} className="block group" data-testid={`user-card-${user.id}`}>
      <div className="rounded-xl bg-card border border-border/50 p-5 hover:border-primary/50 transition-colors h-full flex flex-col">
        <div className="flex items-start gap-4 mb-4">
          <Avatar className="h-14 w-14 border border-border/50" data-testid={`user-avatar-${user.id}`}>
            <AvatarImage src={user.avatarUrl || undefined} />
            <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
              {user.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate group-hover:text-primary transition-colors" data-testid={`user-name-${user.id}`}>
              {user.name}
            </h3>
            <p className="text-sm font-medium text-primary truncate" data-testid={`user-profession-${user.id}`}>
              {user.profession}
            </p>
            {user.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate" data-testid={`user-location-${user.id}`}>
                <MapPin className="w-3 h-3" />
                {user.location}
              </p>
            )}
          </div>
        </div>
        
        {user.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4" data-testid={`user-bio-${user.id}`}>
            {user.bio}
          </p>
        )}
        
        <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium" data-testid={`user-videos-${user.id}`}>
              <Film className="w-4 h-4" />
              {user.videoCount}
            </span>
            <span className="font-medium" data-testid={`user-followers-${user.id}`}>
              <span className="text-white">{user.followerCount}</span> followers
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}