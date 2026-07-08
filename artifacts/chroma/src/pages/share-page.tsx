import { useParams, Link } from "wouter";
import { useState } from "react";
import {
  useGetSharedVideo,
  getGetSharedVideoQueryKey,
  useUnlockSharedVideo,
} from "@workspace/api-client-react";
import type { SharePublic } from "@workspace/api-client-react";
import { Stream } from "@cloudflare/stream-react";
import { Loader2, Lock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [unlocked, setUnlocked] = useState<SharePublic | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading, isError } = useGetSharedVideo(token, {
    query: { queryKey: getGetSharedVideoQueryKey(token), retry: false },
  });

  const unlock = useUnlockSharedVideo({
    mutation: {
      onSuccess: (res) => setUnlocked(res),
      onError: () => setError("Incorrect password"),
    },
  });

  const video = unlocked ?? data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !video) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <EmptyState title="Video not found" description="This share link is invalid or has been disabled." />
      </div>
    );
  }

  const needsUnlock = video.requiresPassword && !video.streamUid && !video.videoUrl;

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="aspect-video bg-black rounded-xl overflow-hidden border border-border/50 shadow-xl shadow-black/50">
        {needsUnlock ? (
          <div className="w-full h-full flex items-center justify-center p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                unlock.mutate({ token, data: { password } });
              }}
              className="w-full max-w-xs text-center"
            >
              <Lock className="mx-auto h-7 w-7 text-white/60 mb-4" />
              <p className="text-white font-semibold mb-1">Password protected</p>
              <p className="text-muted-foreground text-xs mb-4">Enter the password to watch this video.</p>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40"
              />
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
              <Button type="submit" disabled={!password || unlock.isPending} className="mt-4 w-full">
                {unlock.isPending ? "Checking…" : "Unlock"}
              </Button>
            </form>
          </div>
        ) : video.streamUid ? (
          <Stream controls responsive={false} height="100%" width="100%" src={video.streamUid} poster={video.thumbnailUrl || undefined} />
        ) : video.videoUrl ? (
          <video src={video.videoUrl} poster={video.thumbnailUrl || undefined} className="w-full h-full" controls playsInline />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Playback not available</div>
        )}
      </div>

      <div className="mt-6">
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{video.title}</h1>
        {video.description && (
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap mt-3">{video.description}</p>
        )}
      </div>

      <div className="mt-10 pt-6 border-t border-border/40 flex items-center justify-center">
        <Link href="/" className="text-xs text-muted-foreground hover:text-white transition-colors">
          Hosted on <span className="font-bold text-white">ChromaStudio</span>
        </Link>
      </div>
    </div>
  );
}
