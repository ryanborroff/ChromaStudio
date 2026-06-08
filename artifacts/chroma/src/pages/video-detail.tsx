import { useParams, Link } from "wouter";
import { 
  useGetVideo, getGetVideoQueryKey, 
  useLikeVideo, 
  useListComments, getListCommentsQueryKey,
  useCreateComment
} from "@workspace/api-client-react";
import { Loader2, Heart, Share2, Eye, UserPlus, Clock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Show, useUser } from "@clerk/react";

export function VideoDetail() {
  const params = useParams();
  const videoId = Number(params.id);
  const { toast } = useToast();
  const { user } = useUser();
  const [commentText, setCommentText] = useState("");

  const { data: video, isLoading, error } = useGetVideo(videoId, {
    query: {
      enabled: !isNaN(videoId),
      queryKey: getGetVideoQueryKey(videoId)
    }
  });

  const { data: commentsData, isLoading: commentsLoading } = useListComments(videoId, {
    query: {
      enabled: !isNaN(videoId),
      queryKey: getListCommentsQueryKey(videoId)
    }
  });

  const likeMutation = useLikeVideo({
    mutation: {
      onSuccess: (result) => {
        queryClient.setQueryData(getGetVideoQueryKey(videoId), (old: any) => 
          old ? { ...old, isLiked: result.liked, likeCount: result.likeCount } : old
        );
      }
    }
  });

  const commentMutation = useCreateComment({
    mutation: {
      onSuccess: () => {
        setCommentText("");
        toast({ title: "Comment posted" });
        queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(videoId) });
      },
      onError: () => {
        toast({ title: "Failed to post comment", variant: "destructive" });
      }
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <EmptyState
          title="Video not found"
          description="This video may have been removed or is private."
        />
      </div>
    );
  }

  const handleLike = () => {
    if (!user) {
      toast({ title: "Please sign in to like videos" });
      return;
    }
    likeMutation.mutate({ data: { videoId } });
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate({ data: { videoId, body: commentText } });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="aspect-video bg-black rounded-xl overflow-hidden mb-8 border border-border/50 shadow-xl shadow-black/50">
        {video.videoUrl ? (
          <video
            src={video.videoUrl}
            poster={video.thumbnailUrl || undefined}
            className="w-full h-full"
            controls
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-card">
            <span className="text-muted-foreground font-medium">Video playback not available</span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4" data-testid="video-title">{video.title}</h1>
            
            <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-border/40 mb-6">
              <div className="flex items-center gap-4">
                {video.user && (
                  <Link href={`/profile/${video.user.username}`} className="flex items-center gap-3 group">
                    <Avatar className="h-12 w-12 border border-border/50">
                      <AvatarImage src={video.user.avatarUrl || undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                        {video.user.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-white group-hover:text-primary transition-colors">{video.user.name}</p>
                      <p className="text-xs text-muted-foreground">{video.user.followerCount || 0} followers</p>
                    </div>
                  </Link>
                )}
                
                <Show when="signed-in">
                  <Button variant="secondary" size="sm" className="ml-2 font-semibold">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Follow
                  </Button>
                </Show>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-secondary/50 rounded-full px-4 py-2 border border-border/50">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`h-auto p-0 hover:bg-transparent ${video.isLiked ? 'text-primary' : 'text-white'}`}
                    onClick={handleLike}
                    data-testid="btn-like"
                  >
                    <Heart className={`w-5 h-5 mr-2 ${video.isLiked ? 'fill-current' : ''}`} />
                    <span className="font-bold">{video.likeCount}</span>
                  </Button>
                  <div className="w-px h-4 bg-border mx-2" />
                  <div className="flex items-center text-muted-foreground font-medium text-sm">
                    <Eye className="w-4 h-4 mr-2" />
                    {video.viewCount}
                  </div>
                </div>
                
                <Button variant="secondary" size="icon" className="rounded-full" onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast({ title: "Link copied to clipboard" });
                }}>
                  <Share2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            <div className="bg-card/50 rounded-xl p-6 border border-border/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-4">
                <Clock className="w-4 h-4" />
                Published on {format(new Date(video.createdAt), "MMMM d, yyyy")}
              </div>
              <p className="text-white leading-relaxed whitespace-pre-wrap">{video.description || "No description provided."}</p>
              
              {video.tags && video.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6">
                  {video.tags.map((tag, i) => (
                    <span key={i} className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-white mb-6">{commentsData?.comments.length || 0} Comments</h3>
            
            <Show when="signed-in">
              <form onSubmit={handleComment} className="flex gap-4 mb-8">
                <Avatar className="h-10 w-10 border border-border/50 shrink-0">
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                    {user?.firstName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <Textarea 
                    placeholder="Add a public comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="bg-card border-border/50 resize-none"
                    rows={2}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={!commentText.trim() || commentMutation.isPending} size="sm">
                      {commentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Comment
                    </Button>
                  </div>
                </div>
              </form>
            </Show>
            
            <div className="space-y-6">
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : commentsData?.comments.length ? (
                commentsData.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-4">
                    <Link href={`/profile/${comment.user?.username || ''}`}>
                      <Avatar className="h-10 w-10 border border-border/50 cursor-pointer">
                        <AvatarImage src={comment.user?.avatarUrl || undefined} />
                        <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                          {comment.user?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <Link href={`/profile/${comment.user?.username || ''}`} className="font-bold text-white hover:text-primary transition-colors text-sm">
                          {comment.user?.name}
                        </Link>
                        <span className="text-xs text-muted-foreground font-medium">
                          {format(new Date(comment.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">{comment.body}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">No comments yet. Be the first to share your thoughts.</p>
              )}
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Credits</h3>
          {video.credits ? (
            <div className="bg-card/50 rounded-xl p-5 border border-border/30 whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
              {video.credits}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No credits provided.</p>
          )}
        </div>
      </div>
    </div>
  );
}