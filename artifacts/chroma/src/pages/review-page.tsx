import { useState } from "react";
import { useParams } from "wouter";
import {
  getGetReviewLinkQueryKey,
  useGetReviewLink,
  usePostGuestReviewComment,
  useSelectReviewVersion,
  useSetGuestApprovalStatus,
  useUnlockReviewLink,
} from "@workspace/api-client-react";
import type { ReviewSession } from "@workspace/api-client-react";
import { Stream } from "@cloudflare/stream-react";
import MuxPlayer from "@mux/mux-player-react";
import {
  Loader2,
  Lock,
  MessageSquare,
  PlayCircle,
  Send,
  Check,
  RotateCcw,
  Download,
  History,
  Crosshair,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { DOWNLOAD_FORMAT_LABELS } from "@/lib/downloadFormats";
import { usePlayerTime } from "@/hooks/use-player-time";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function ReviewPage() {
  const { token = "" } = useParams();
  const [unlocked, setUnlocked] = useState<ReviewSession | null>(null);
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState(
    () => sessionStorage.getItem("chroma-review-name") ?? "",
  );
  const [timecode, setTimecode] = useState("0");
  const [timecodeCaptured, setTimecodeCaptured] = useState(false);
  const [body, setBody] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("");
  const { muxPlayerRef, streamRef, videoRef, getCurrentTime, seekTo } =
    usePlayerTime();

  const reviewQuery = useGetReviewLink(token, {
    query: {
      queryKey: getGetReviewLinkQueryKey(token),
      retry: false,
      enabled: !!token,
    },
  });
  const session = unlocked ?? reviewQuery.data;

  const unlockMutation = useUnlockReviewLink({
    mutation: {
      onSuccess: setUnlocked,
    },
  });
  const commentMutation = usePostGuestReviewComment({
    mutation: {
      onSuccess: (comment) => {
        setBody("");
        setTimecode("0");
        setTimecodeCaptured(false);
        setUnlocked((current) => {
          const base = current ?? reviewQuery.data;
          return base
            ? { ...base, comments: [...base.comments, comment] }
            : current;
        });
      },
    },
  });
  const approvalMutation = useSetGuestApprovalStatus({
    mutation: {
      onSuccess: (result) => {
        setUnlocked((current) => {
          const base = current ?? reviewQuery.data;
          return base
            ? { ...base, approvalStatus: result.approvalStatus }
            : current;
        });
        setApprovalMessage(
          result.approvalStatus === "approved"
            ? "Approved"
            : "Changes requested",
        );
      },
    },
  });
  const selectVersionMutation = useSelectReviewVersion({
    mutation: {
      onSuccess: setUnlocked,
    },
  });

  if (reviewQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (reviewQuery.isError || !session) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] px-4 py-16">
        <EmptyState
          title="Review link unavailable"
          description="This link is invalid, expired, or has been revoked."
        />
      </div>
    );
  }

  if (session.requiresPassword && !unlocked) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center px-4">
        <form
          className="w-full max-w-sm rounded-2xl border border-border/50 bg-card p-7 text-center"
          onSubmit={(event) => {
            event.preventDefault();
            unlockMutation.mutate({ token, data: { password } });
          }}
        >
          <Lock className="mx-auto mb-4 h-7 w-7 text-primary" />
          <h1 className="text-xl font-bold text-white">
            Private client review
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the password provided by the project owner.
          </p>
          <Input
            className="mt-5 bg-input text-white"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
          {unlockMutation.isError && (
            <p className="mt-2 text-xs text-red-400">Incorrect password.</p>
          )}
          <Button
            className="mt-4 w-full"
            disabled={!password || unlockMutation.isPending}
          >
            {unlockMutation.isPending ? "Unlocking…" : "Open review"}
          </Button>
        </form>
      </div>
    );
  }

  const canReview =
    !!session.streamPlaybackId || !!session.streamUid || !!session.videoUrl;
  const reviewPassword = unlocked ? password : undefined;
  const versions = session.versions ?? [];
  const latestVersion = versions[versions.length - 1];
  const isLatestVersion =
    versions.length <= 1 || !latestVersion || session.videoId === latestVersion.id;
  const safeTitle = session.title.replace(/[^\w.-]+/g, "_");
  const format = selectedFormat || session.downloadFormats?.[0] || "";
  const downloadHref =
    session.streamProvider === "mux" && session.streamPlaybackId
      ? `https://stream.mux.com/${session.streamPlaybackId}/high.mp4`
      : session.streamUid
        ? `https://videodelivery.net/${session.streamUid}/downloads/default.mp4?filename=${encodeURIComponent(`${safeTitle}-${format}.mp4`)}`
        : session.videoUrl || "";

  function captureCurrentTime() {
    setTimecode(getCurrentTime().toFixed(3));
    setTimecodeCaptured(true);
  }

  function saveName() {
    const value = guestName.trim();
    if (value) {
      sessionStorage.setItem("chroma-review-name", value);
      setGuestName(value);
    }
  }

  function postComment(event: React.FormEvent) {
    event.preventDefault();
    if (!guestName.trim() || !body.trim()) return;
    saveName();
    commentMutation.mutate({
      token,
      data: {
        authorName: guestName.trim(),
        body: body.trim(),
        timecodeSeconds: Math.max(0, Number(timecode) || 0),
        password: reviewPassword,
      },
    });
  }

  function selectVersion(videoId: number) {
    selectVersionMutation.mutate({
      token,
      videoId,
      data: { password: reviewPassword },
    });
  }

  function decide(status: "approved" | "changes_requested") {
    if (!guestName.trim()) return;
    saveName();
    approvalMutation.mutate({
      token,
      data: { status, authorName: guestName.trim(), password: reviewPassword },
    });
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Client review
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {session.title}
            </h1>
            {session.description && (
              <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">
                {session.description}
              </p>
            )}
          </div>
          <div className="rounded-full border border-border/50 bg-card px-4 py-2 text-sm">
            Status:{" "}
            <span className="font-semibold text-primary">
              {session.approvalStatus.replace("_", " ")}
            </span>
          </div>
        </div>

        {versions.length > 1 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Versions
            </span>
            {versions.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={
                  v.id === session.videoId || selectVersionMutation.isPending
                }
                onClick={() => selectVersion(v.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  v.id === session.videoId
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/50 bg-card text-muted-foreground hover:border-primary/50 hover:text-white"
                }`}
              >
                v{v.versionNumber}
                {v.id === latestVersion?.id ? " (latest)" : ""}
              </button>
            ))}
          </div>
        )}

        {!isLatestVersion && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            You're viewing an earlier version for comparison. Switch to the
            latest version to leave feedback or approve.
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <div className="aspect-video overflow-hidden rounded-2xl border border-border/50 bg-black shadow-2xl">
              {session.streamProvider === "mux" && session.streamPlaybackId ? (
                <MuxPlayer
                  ref={muxPlayerRef}
                  playbackId={session.streamPlaybackId}
                  streamType="on-demand"
                  metadataVideoTitle={session.title}
                  className="h-full w-full"
                />
              ) : session.streamUid ? (
                <Stream
                  streamRef={streamRef}
                  controls
                  responsive={false}
                  height="100%"
                  width="100%"
                  src={session.streamUid}
                  poster={session.thumbnailUrl || undefined}
                />
              ) : session.videoUrl ? (
                <video
                  ref={videoRef}
                  src={session.videoUrl}
                  poster={session.thumbnailUrl || undefined}
                  className="h-full w-full"
                  controls
                  playsInline
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Video is still processing.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-xl border border-border/50 bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <MessageSquare className="h-4 w-4 text-primary" /> Timestamped
                feedback
              </div>
              <div className="mt-4 space-y-3">
                {session.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No feedback yet. Add the first note below.
                  </p>
                ) : (
                  session.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`rounded-lg border p-3 ${comment.resolved ? "border-emerald-500/20 opacity-60" : "border-border/40"}`}
                    >
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
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
                        </span>
                        {comment.resolved && <span>Resolved</span>}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-white">
                        {comment.body}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-xl border border-border/50 bg-card p-5">
              <h2 className="font-semibold">Your review</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Leave your name once, then add notes or make a decision.
              </p>
              <Input
                className="mt-4 bg-input text-white"
                placeholder="Your name"
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
              />
              {session.allowComments && isLatestVersion && (
                <form className="mt-4 space-y-3" onSubmit={postComment}>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Input
                        className="w-28 bg-input text-white"
                        type="number"
                        min="0"
                        step="0.001"
                        value={timecode}
                        onChange={(event) => {
                          setTimecode(event.target.value);
                          setTimecodeCaptured(true);
                        }}
                        aria-label="Timecode in seconds"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={captureCurrentTime}
                        disabled={!canReview}
                      >
                        <Crosshair className="h-3.5 w-3.5" />
                        Use current time
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(Number(timecode) || 0)} — captured from
                      where you paused, or edit to fine-tune.
                    </p>
                  </div>
                  <Textarea
                    className="min-h-24 bg-input text-white"
                    placeholder="What should change?"
                    value={body}
                    onFocus={() => {
                      if (!timecodeCaptured) captureCurrentTime();
                    }}
                    onChange={(event) => setBody(event.target.value)}
                  />
                  <Button
                    className="w-full"
                    disabled={
                      !canReview ||
                      !guestName.trim() ||
                      !body.trim() ||
                      commentMutation.isPending
                    }
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {commentMutation.isPending ? "Posting…" : "Add feedback"}
                  </Button>
                </form>
              )}
            </div>

            {session.allowDownload &&
              session.downloadFormats &&
              session.downloadFormats.length > 0 &&
              downloadHref && (
                <div className="rounded-xl border border-border/50 bg-card p-5">
                  <h2 className="font-semibold">Download</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The owner has approved these download formats.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <select
                      className="min-w-0 flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm text-white"
                      value={format}
                      onChange={(event) =>
                        setSelectedFormat(event.target.value)
                      }
                    >
                      {session.downloadFormats.map((value) => (
                        <option key={value} value={value}>
                          {DOWNLOAD_FORMAT_LABELS[value]?.label ?? value}
                        </option>
                      ))}
                    </select>
                    <Button asChild variant="secondary">
                      <a
                        href={downloadHref}
                        download={`${safeTitle}-${format}.mp4`}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Save
                      </a>
                    </Button>
                  </div>
                </div>
              )}

            <div className="rounded-xl border border-border/50 bg-card p-5">
              <h2 className="font-semibold">Decision</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Tell the owner whether this cut is ready to approve.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  disabled={
                    !isLatestVersion ||
                    !guestName.trim() ||
                    approvalMutation.isPending
                  }
                  onClick={() => decide("changes_requested")}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Changes
                </Button>
                <Button
                  disabled={
                    !isLatestVersion ||
                    !guestName.trim() ||
                    approvalMutation.isPending
                  }
                  onClick={() => decide("approved")}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
              {approvalMessage && (
                <p className="mt-3 text-center text-sm text-primary">
                  {approvalMessage}
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
