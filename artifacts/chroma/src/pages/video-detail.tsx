import { useParams, Link } from "wouter";
import {
  useGetVideo,
  getGetVideoQueryKey,
  useLikeVideo,
  useListComments,
  getListCommentsQueryKey,
  useCreateComment,
  useListReviewComments,
  getListReviewCommentsQueryKey,
  useResolveReviewComment,
  useSetOwnerApprovalStatus,
  downloadEditingExport,
} from "@workspace/api-client-react";
import {
  Loader2,
  Heart,
  Share2,
  Eye,
  UserPlus,
  Clock,
  Download,
  Film,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DOWNLOAD_FORMAT_LABELS } from "@/lib/downloadFormats";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/useAuth";
import { Stream } from "@cloudflare/stream-react";
import MuxPlayer from "@mux/mux-player-react";

export function VideoDetail() {
  const params = useParams();
  const videoId = Number(params.id);
  const { toast } = useToast();
  const { user, isSignedIn } = useAuth();
  const [commentText, setCommentText] = useState("");

  const {
    data: video,
    isLoading,
    error,
  } = useGetVideo(videoId, {
    query: {
      enabled: !isNaN(videoId),
      queryKey: getGetVideoQueryKey(videoId),
    },
  });

  const { data: commentsData, isLoading: commentsLoading } = useListComments(
    videoId,
    {
      query: {
        enabled: !isNaN(videoId),
        queryKey: getListCommentsQueryKey(videoId),
      },
    },
  );
  const { data: reviewCommentsData } = useListReviewComments(videoId, {
    query: {
      enabled: !isNaN(videoId) && isSignedIn,
      queryKey: getListReviewCommentsQueryKey(videoId),
    },
  });

  const likeMutation = useLikeVideo({
    mutation: {
      onSuccess: (result) => {
        queryClient.setQueryData(getGetVideoQueryKey(videoId), (old: any) =>
          old
            ? { ...old, isLiked: result.liked, likeCount: result.likeCount }
            : old,
        );
      },
    },
  });

  const commentMutation = useCreateComment({
    mutation: {
      onSuccess: () => {
        setCommentText("");
        toast({ title: "Comment posted" });
        queryClient.invalidateQueries({
          queryKey: getListCommentsQueryKey(videoId),
        });
      },
      onError: () => {
        toast({ title: "Failed to post comment", variant: "destructive" });
      },
    },
  });
  const resolveReviewCommentMutation = useResolveReviewComment({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getListReviewCommentsQueryKey(videoId),
        }),
      onError: () =>
        toast({
          title: "Could not resolve review note",
          variant: "destructive",
        }),
    },
  });
  const ownerApprovalMutation = useSetOwnerApprovalStatus({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getGetVideoQueryKey(videoId),
        }),
      onError: () =>
        toast({
          title: "Could not update approval status",
          variant: "destructive",
        }),
    },
  });

  const handleEditingExport = async () => {
    try {
      const xml = await downloadEditingExport(videoId);
      const url = URL.createObjectURL(
        new Blob([xml], { type: "application/xml;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${video?.title?.replace(/[^\w.-]+/g, "_") || "chroma-edit"}.fcpxml`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: "Editing project downloaded" });
    } catch {
      toast({
        title: "Could not create editing export",
        variant: "destructive",
      });
    }
  };

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
    likeMutation.mutate({ id: videoId });
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate({ id: videoId, data: { body: commentText } });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="aspect-video bg-black rounded-xl overflow-hidden mb-8 border border-border/50 shadow-xl shadow-black/50">
        {video.streamProvider === "mux" ? (
          video.streamPlaybackId ? (
            <MuxPlayer
              playbackId={video.streamPlaybackId}
              poster={video.thumbnailUrl || undefined}
              style={{ width: "100%", height: "100%" }}
              accentColor="#6B5BFF"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-card">
              <span className="text-muted-foreground font-medium">
                Processing video…
              </span>
            </div>
          )
        ) : video.streamProvider === "cloudflare" && video.streamUid ? (
          <Stream
            controls
            responsive={false}
            height="100%"
            width="100%"
            src={video.streamUid}
            poster={video.thumbnailUrl || undefined}
          />
        ) : video.videoUrl ? (
          <video
            src={video.videoUrl}
            poster={video.thumbnailUrl || undefined}
            className="w-full h-full"
            controls
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-card">
            <span className="text-muted-foreground font-medium">
              Video playback not available
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <h1
              className="text-3xl md:text-4xl font-black text-white tracking-tight mb-4"
              data-testid="video-title"
            >
              {video.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-border/40 mb-6">
              <div className="flex items-center gap-4">
                {video.user && (
                  <Link
                    href={`/profile/${video.user.username}`}
                    className="flex items-center gap-3 group"
                  >
                    <Avatar className="h-12 w-12 border border-border/50">
                      <AvatarImage src={video.user.avatarUrl || undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                        {video.user.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-white group-hover:text-primary transition-colors">
                        {video.user.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {video.user.followerCount || 0} followers
                      </p>
                    </div>
                  </Link>
                )}

                {isSignedIn && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="ml-2 font-semibold"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Follow
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-secondary/50 rounded-full px-4 py-2 border border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-auto p-0 hover:bg-transparent ${video.isLiked ? "text-primary" : "text-white"}`}
                    onClick={handleLike}
                    data-testid="btn-like"
                  >
                    <Heart
                      className={`w-5 h-5 mr-2 ${video.isLiked ? "fill-current" : ""}`}
                    />
                    <span className="font-bold">{video.likeCount}</span>
                  </Button>
                  <div className="w-px h-4 bg-border mx-2" />
                  <div className="flex items-center text-muted-foreground font-medium text-sm">
                    <Eye className="w-4 h-4 mr-2" />
                    {video.viewCount}
                  </div>
                </div>

                <div className="flex items-center bg-secondary/50 rounded-full px-4 py-2 border border-border/50">
                  <StarRating
                    videoId={video.id}
                    ratingAvg={video.ratingAvg ?? 0}
                    ratingCount={video.ratingCount ?? 0}
                    userRating={video.userRating ?? null}
                    size="md"
                  />
                </div>

                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast({ title: "Link copied to clipboard" });
                  }}
                >
                  <Share2 className="w-5 h-5" />
                </Button>

                {video.streamUid &&
                  video.downloadFormats &&
                  video.downloadFormats.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          className="rounded-full font-semibold"
                          data-testid="btn-download"
                        >
                          <Download className="w-5 h-5 mr-2" />
                          Download
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Download formats</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {video.downloadFormats.map((fmt) => {
                          const meta = DOWNLOAD_FORMAT_LABELS[fmt];
                          const safeTitle = video.title.replace(
                            /[^\w.-]+/g,
                            "_",
                          );
                          return (
                            <DropdownMenuItem key={fmt} asChild>
                              <a
                                href={`https://videodelivery.net/${video.streamUid}/downloads/default.mp4`}
                                download={`${safeTitle}-${fmt}.mp4`}
                                data-testid={`download-${fmt}`}
                                className="flex items-center justify-between gap-3 cursor-pointer"
                              >
                                <span className="font-medium">
                                  {meta?.label ?? fmt}
                                </span>
                                {meta?.hint && (
                                  <span className="text-xs text-muted-foreground">
                                    {meta.hint}
                                  </span>
                                )}
                              </a>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                {video.userId === user?.id && (
                  <Button
                    variant="secondary"
                    className="rounded-full font-semibold"
                    onClick={handleEditingExport}
                  >
                    <Film className="w-5 h-5 mr-2" />
                    Export to editor
                  </Button>
                )}
              </div>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-border/50 bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                Client review:{" "}
                <span className="text-primary">
                  {video.approvalStatus?.replace("_", " ") ?? "pending"}
                </span>
              </span>
              {isSignedIn && video.userId === user?.id && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    disabled={ownerApprovalMutation.isPending}
                    onClick={() =>
                      ownerApprovalMutation.mutate({
                        id: videoId,
                        data: { status: "changes_requested" },
                      })
                    }
                  >
                    Request changes
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-primary"
                    disabled={ownerApprovalMutation.isPending}
                    onClick={() =>
                      ownerApprovalMutation.mutate({
                        id: videoId,
                        data: { status: "approved" },
                      })
                    }
                  >
                    Approve
                  </Button>
                </>
              )}
              {reviewCommentsData && reviewCommentsData.comments.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {reviewCommentsData.comments.length} timestamped{" "}
                  {reviewCommentsData.comments.length === 1 ? "note" : "notes"}
                </span>
              )}
            </div>

            <div className="bg-card/50 rounded-xl p-6 border border-border/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mb-4">
                <Clock className="w-4 h-4" />
                Published on {format(new Date(video.createdAt), "MMMM d, yyyy")}
              </div>
              <p className="text-white leading-relaxed whitespace-pre-wrap">
                {video.description || "No description provided."}
              </p>

              {video.tags && video.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6">
                  {video.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            {reviewCommentsData && reviewCommentsData.comments.length > 0 && (
              <div className="mb-10">
                <h3 className="mb-4 text-xl font-bold text-white">
                  Client review notes
                </h3>
                <div className="space-y-3">
                  {reviewCommentsData.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border border-primary/20 bg-primary/5 p-4"
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        {Math.floor(comment.timecodeSeconds / 60)}:
                        {Math.floor(comment.timecodeSeconds % 60)
                          .toString()
                          .padStart(2, "0")}{" "}
                        · {comment.authorName}
                      </div>
                      <div className="mt-2 flex items-start justify-between gap-3">
                        <p className="text-sm text-white">{comment.body}</p>
                        {!comment.resolved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 shrink-0 text-xs text-muted-foreground"
                            disabled={resolveReviewCommentMutation.isPending}
                            onClick={() =>
                              resolveReviewCommentMutation.mutate({
                                id: videoId,
                                commentId: comment.id,
                              })
                            }
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <h3 className="text-xl font-bold text-white mb-6">
              {commentsData?.comments.length || 0} Comments
            </h3>

            {isSignedIn && (
              <form onSubmit={handleComment} className="flex gap-4 mb-8">
                <Avatar className="h-10 w-10 border border-border/50 shrink-0">
                  <AvatarImage src={user?.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                    {user?.name?.charAt(0) || "U"}
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
                    <Button
                      type="submit"
                      disabled={
                        !commentText.trim() || commentMutation.isPending
                      }
                      size="sm"
                    >
                      {commentMutation.isPending && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      Comment
                    </Button>
                  </div>
                </div>
              </form>
            )}

            <div className="space-y-6">
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : commentsData?.comments.length ? (
                commentsData.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-4">
                    <Link href={`/profile/${comment.user?.username || ""}`}>
                      <Avatar className="h-10 w-10 border border-border/50 cursor-pointer">
                        <AvatarImage
                          src={comment.user?.avatarUrl || undefined}
                        />
                        <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                          {comment.user?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <Link
                          href={`/profile/${comment.user?.username || ""}`}
                          className="font-bold text-white hover:text-primary transition-colors text-sm"
                        >
                          {comment.user?.name}
                        </Link>
                        <span className="text-xs text-muted-foreground font-medium">
                          {format(new Date(comment.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {comment.body}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No comments yet. Be the first to share your thoughts.
                </p>
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
            <p className="text-sm text-muted-foreground italic">
              No credits provided.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
