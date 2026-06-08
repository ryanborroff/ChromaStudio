import { useParams } from "wouter";
import { useState } from "react";
import {
  useGetSharedVideo,
  getGetSharedVideoQueryKey,
  useUnlockSharedVideo,
} from "@workspace/api-client-react";
import type { SharePublic } from "@workspace/api-client-react";
import { Stream } from "@cloudflare/stream-react";
import { Loader2, Lock, Film } from "lucide-react";

export function EmbedPlayer() {
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
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      </div>
    );
  }

  if (isError || !video) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white/70 gap-3">
        <Film className="h-8 w-8" />
        <p className="text-sm font-medium">This video is unavailable.</p>
      </div>
    );
  }

  const needsUnlock = video.requiresPassword && !video.streamUid && !video.videoUrl;

  if (needsUnlock) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            unlock.mutate({ token, data: { password } });
          }}
          className="w-full max-w-xs text-center"
        >
          <Lock className="mx-auto h-7 w-7 text-white/60 mb-4" />
          <p className="text-white font-semibold mb-1">Password required</p>
          <p className="text-white/50 text-xs mb-4">Enter the password to watch this video.</p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/40"
          />
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          <button
            type="submit"
            disabled={!password || unlock.isPending}
            className="mt-4 w-full rounded-lg bg-white text-black text-sm font-semibold py-2 disabled:opacity-50"
          >
            {unlock.isPending ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {video.streamUid ? (
        <Stream controls responsive={false} height="100%" width="100%" src={video.streamUid} poster={video.thumbnailUrl || undefined} />
      ) : video.videoUrl ? (
        <video src={video.videoUrl} poster={video.thumbnailUrl || undefined} className="w-full h-full" controls playsInline />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/60 text-sm">Playback not available</div>
      )}
    </div>
  );
}
