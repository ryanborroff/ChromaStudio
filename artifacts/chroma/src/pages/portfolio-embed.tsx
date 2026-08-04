import { useParams } from "wouter";
import {
  getGetPortfolioEmbedQueryKey,
  useGetPortfolioEmbed,
} from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { Stream } from "@cloudflare/stream-react";

export function PortfolioEmbed() {
  const { id = "" } = useParams();
  const videoId = Number(id);
  const { data, isLoading, isError } = useGetPortfolioEmbed(videoId, {
    query: {
      enabled: Number.isInteger(videoId),
      retry: false,
      queryKey: getGetPortfolioEmbedQueryKey(videoId),
    },
  });
  if (isLoading)
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 className="h-7 w-7 animate-spin text-white/60" />
      </div>
    );
  if (isError || !data)
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-sm text-white/60">
        This embed is unavailable.
      </div>
    );
  return (
    <div className="fixed inset-0 bg-black">
      {data.streamUid ? (
        <Stream
          controls
          responsive={false}
          height="100%"
          width="100%"
          src={data.streamUid}
          poster={data.thumbnailUrl ?? undefined}
        />
      ) : data.videoUrl ? (
        <video
          src={data.videoUrl}
          poster={data.thumbnailUrl ?? undefined}
          className="h-full w-full"
          controls
          playsInline
        />
      ) : null}
      {data.whiteLabel && data.customLogoUrl && (
        <img
          src={data.customLogoUrl}
          alt=""
          className="absolute right-4 top-4 max-h-8 max-w-32 object-contain"
        />
      )}
    </div>
  );
}
