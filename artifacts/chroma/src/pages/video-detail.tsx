import { useParams, Link, useLocation } from "wouter";
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
  useListVideoVersions,
  getListVideoVersionsQueryKey,
  usePostOwnerReviewComment,
  useCreateVideoUploadUrl,
  useCreateVideo,
  useConfirmVideoUpload,
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
  UploadCloud,
  Crosshair,
  PlayCircle,
  Send,
} from "lucide-react";
import MuxUploader, {
  type MuxUploaderRefAttributes,
} from "@mux/mux-uploader-react";
import { uploadViaPost, uploadViaPut } from "@/lib/videoUpload";
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
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/useAuth";
import { Stream } from "@cloudflare/stream-react";
import MuxPlayer from "@mux/mux-player-react";
import { usePlayerTime } from "@/hooks/use-player-time";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function VideoDetail() {
  const params = useParams();
  const videoId = Number(params.id);
  const { toast } = useToast();
  const { user, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const [commentText, setCommentText] = useState("");
  const [reviewNoteBody, setReviewNoteBody] = useState("");
  const [reviewTimecode, setReviewTimecode] = useState("0");
  const [reviewTimecodeCaptured, setReviewTimecodeCaptured] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [versionUpload, setVersionUpload] = useState<{
    fileName: string;
    progress: number;
  } | null>(null);
  const dragCounter = useRef(0);
  const muxUploaderRef = useRef<MuxUploaderRefAttributes | null>(null);
  const { muxPlayerRef, streamRef, videoRef, getCurrentTime, seekTo } =
    usePlayerTime();

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

  const isOwner = isSignedIn && video?.userId === user?.id;
  const groupId = video?.reviewGroupId || (video ? `video-${video.id}` : "");
  const { data: versionsData } = useListVideoVersions(groupId, {
    query: {
      enabled: !!groupId && isOwner,
      queryKey: getListVideoVersionsQueryKey(groupId),
    },
  });
  const versions = versionsData?.versions ?? [];

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
  const postReviewCommentMutation = usePostOwnerReviewComment({
    mutation: {
      onSuccess: () => {
        setReviewNoteBody("");
        setReviewTimecode("0");
        setReviewTimecodeCaptured(false);
        queryClient.invalidateQueries({
          queryKey: getListReviewCommentsQueryKey(videoId),
        });
      },
      onError: () =>
        toast({
          title: "Could not post review note",
          variant: "destructive",
        }),
    },
  });

  const uploadUrlMutation = useCreateVideoUploadUrl();
  const createVersionMutation = useCreateVideo();
  const confirmUploadMutation = useConfirmVideoUpload();

  const handleVersionDrop = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast({ title: "Please drop a video file", variant: "destructive" });
      return;
    }
    setVersionUpload({ fileName: file.name, progress: 0 });
    try {
      const ticket = await uploadUrlMutation.mutateAsync();
      const uploadMethod = ticket.uploadMethod ?? "put";
      const streamProvider = ticket.streamProvider ?? null;
      const isObjectStorage = !streamProvider;

      const newVideo = await createVersionMutation.mutateAsync({
        data: {
          title: video!.title,
          description: video!.description ?? undefined,
          privacy: video!.privacy,
          fileSizeBytes: file.size,
          ...(isObjectStorage
            ? { videoUrl: `/api/storage${ticket.uid}` }
            : { streamUid: ticket.uid }),
          reviewGroupId: groupId,
        },
      });

      const onProgress = (pct: number) =>
        setVersionUpload({ fileName: file.name, progress: pct });

      if (streamProvider === "mux") {
        await new Promise<void>((resolve, reject) => {
          const uploader = muxUploaderRef.current;
          if (!uploader) {
            reject(new Error("Mux uploader is unavailable"));
            return;
          }
          uploader.setAttribute("endpoint", ticket.uploadURL);
          const onSuccess = () => {
            uploader.removeEventListener("success", onSuccess);
            uploader.removeEventListener("uploaderror", onError);
            resolve();
          };
          const onError = (event: Event) => {
            uploader.removeEventListener("success", onSuccess);
            uploader.removeEventListener("uploaderror", onError);
            const detail = (event as CustomEvent<{ message?: string }>)
              .detail;
            reject(new Error(detail?.message ?? "Mux upload failed"));
          };
          const onUploaderProgress = (event: Event) => {
            onProgress((event as CustomEvent<number>).detail);
          };
          uploader.addEventListener("success", onSuccess);
          uploader.addEventListener("uploaderror", onError);
          uploader.addEventListener("progress", onUploaderProgress);
          uploader.dispatchEvent(
            new CustomEvent("file-ready", {
              detail: file,
              bubbles: true,
              composed: true,
            }),
          );
        });
      } else if (uploadMethod === "put") {
        await uploadViaPut(ticket.uploadURL, file, onProgress);
      } else {
        await uploadViaPost(ticket.uploadURL, file, onProgress);
      }

      if (isObjectStorage) {
        await confirmUploadMutation.mutateAsync({ id: newVideo.id });
      }

      toast({ title: "New version uploaded" });
      setVersionUpload(null);
      setLocation(`/videos/${newVideo.id}`);
    } catch (err) {
      setVersionUpload(null);
      toast({
        title: "Could not upload new version",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    }
  };

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

  const captureReviewTime = () => {
    setReviewTimecode(getCurrentTime().toFixed(3));
    setReviewTimecodeCaptured(true);
  };

  const handlePostReviewComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewNoteBody.trim()) return;
    postReviewCommentMutation.mutate({
      id: videoId,
      data: {
        body: reviewNoteBody.trim(),
        timecodeSeconds: Math.max(0, Number(reviewTimecode) || 0),
      },
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {isOwner && (
        <MuxUploader
          ref={muxUploaderRef}
          noDrop
          noProgress
          noStatus
          noRetry
          style={{ display: "none" }}
        />
      )}
      <div className="aspect-video bg-black rounded-xl overflow-hidden mb-8 border border-border/50 shadow-xl shadow-black/50">
        {video.streamProvider === "mux" ? (
          video.streamPlaybackId ? (
            <MuxPlayer
              ref={muxPlayerRef}
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
            streamRef={streamRef}
            controls
            responsive={false}
            height="100%"
            width="100%"
            src={video.streamUid}
            poster={video.thumbnailUrl || undefined}
          />
        ) : video.videoUrl ? (
          <video
            ref={videoRef}
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
                {isOwner && (
                  <Button
                    variant="secondary"
                    className="rounded-full font-semibold"
                    onClick={handleEditingExport}
                  >
                    <Film className="w-5 h-5 mr-2" />
                    Export to editor
                  </Button>
                )}
                {isOwner && (
                  <Button asChild className="rounded-full font-semibold">
                    <Link
                      href={`/videos/upload?reviewGroupId=${encodeURIComponent(groupId)}&title=${encodeURIComponent(video.title)}`}
                    >
                      <UploadCloud className="w-5 h-5 mr-2" />
                      Upload new version
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {isOwner && (
              <div
                className={`mb-6 rounded-xl border-2 border-dashed p-4 transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-border/40"
                }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  dragCounter.current += 1;
                  if (e.dataTransfer.types.includes("Files"))
                    setIsDragActive(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => {
                  e.preventDefault();
                  dragCounter.current -= 1;
                  if (dragCounter.current <= 0) {
                    dragCounter.current = 0;
                    setIsDragActive(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  dragCounter.current = 0;
                  setIsDragActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && !versionUpload) void handleVersionDrop(file);
                }}
                data-testid="dropzone-new-version"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Version stack
                  </span>
                  {versions.length > 1 &&
                    versions.map((v) => (
                      <Link key={v.id} href={`/videos/${v.id}`}>
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                            v.id === videoId
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border/50 bg-card text-muted-foreground hover:border-primary/50 hover:text-white"
                          }`}
                        >
                          v{v.versionNumber}
                          {v.id === videoId && " · viewing"}
                        </span>
                      </Link>
                    ))}
                </div>
                {versionUpload ? (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    <span className="truncate">
                      Uploading {versionUpload.fileName}… {versionUpload.progress}%
                    </span>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UploadCloud className="h-3.5 w-3.5" />
                    Drag &amp; drop a revised cut here to stack it onto this
                    review, or use "Upload new version" above.
                  </p>
                )}
              </div>
            )}

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
            {isOwner && (
              <div className="mb-10">
                <h3 className="mb-4 text-xl font-bold text-white">
                  Client review notes
                </h3>
                {reviewCommentsData && reviewCommentsData.comments.length > 0 ? (
                  <div className="mb-4 space-y-3">
                    {reviewCommentsData.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-lg border border-primary/20 bg-primary/5 p-4"
                      >
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <button
                            type="button"
                            onClick={() => seekTo(comment.timecodeSeconds)}
                            className="flex items-center gap-1.5 hover:text-primary transition-colors"
                            title="Jump to this point in the video"
                          >
                            <PlayCircle className="h-3.5 w-3.5 text-primary" />
                            {formatTime(comment.timecodeSeconds)}
                          </button>
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
                ) : (
                  <p className="mb-4 text-sm text-muted-foreground">
                    No review notes yet.
                  </p>
                )}
                <form
                  onSubmit={handlePostReviewComment}
                  className="space-y-3 rounded-lg border border-border/30 bg-card/30 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="w-28 bg-input text-white"
                      type="number"
                      min="0"
                      step="0.001"
                      value={reviewTimecode}
                      onChange={(e) => {
                        setReviewTimecode(e.target.value);
                        setReviewTimecodeCaptured(true);
                      }}
                      aria-label="Timecode in seconds"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={captureReviewTime}
                    >
                      <Crosshair className="h-3.5 w-3.5" />
                      Use current time
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(Number(reviewTimecode) || 0)}
                    </span>
                  </div>
                  <Textarea
                    placeholder="Add a review note tied to this timecode..."
                    value={reviewNoteBody}
                    onFocus={() => {
                      if (!reviewTimecodeCaptured) captureReviewTime();
                    }}
                    onChange={(e) => setReviewNoteBody(e.target.value)}
                    className="bg-input border-border text-white resize-none"
                    rows={2}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        !reviewNoteBody.trim() ||
                        postReviewCommentMutation.isPending
                      }
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {postReviewCommentMutation.isPending
                        ? "Posting…"
                        : "Add review note"}
                    </Button>
                  </div>
                </form>
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
