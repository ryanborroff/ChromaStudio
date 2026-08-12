import { useCallback, useRef } from "react";
import type { MuxPlayerRefAttributes } from "@mux/mux-player-react";
import type { StreamPlayerApi } from "@cloudflare/stream-react";

// Exactly one of these refs will be attached at a time, depending on which
// provider rendered for a given video (Mux, Cloudflare Stream, or a plain
// <video> for object-storage playback). getCurrentTime/seekTo check them in
// this order and act on whichever is populated.
export function usePlayerTime() {
  const muxPlayerRef = useRef<MuxPlayerRefAttributes>(null);
  const streamRef = useRef<StreamPlayerApi | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);

  const getCurrentTime = useCallback((): number => {
    if (muxPlayerRef.current) return muxPlayerRef.current.currentTime || 0;
    if (streamRef.current) return streamRef.current.currentTime || 0;
    if (videoRef.current) return videoRef.current.currentTime || 0;
    return 0;
  }, []);

  const seekTo = useCallback((seconds: number) => {
    if (muxPlayerRef.current) {
      muxPlayerRef.current.currentTime = seconds;
      muxPlayerRef.current.pause();
    } else if (streamRef.current) {
      streamRef.current.currentTime = seconds;
      streamRef.current.pause();
    } else if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.pause();
    }
  }, []);

  return { muxPlayerRef, streamRef, videoRef, getCurrentTime, seekTo };
}
