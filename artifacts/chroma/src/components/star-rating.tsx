import { useState } from "react";
import { Star } from "lucide-react";
import { useRateVideo, getListVideosQueryKey, getGetVideoQueryKey, getGetFeedQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StarRatingProps {
  videoId: number;
  ratingAvg: number;
  ratingCount: number;
  userRating?: number | null;
  /** "sm" for compact cards, "md" for detail pages */
  size?: "sm" | "md";
  /** When false, stars are display-only (no interaction) */
  interactive?: boolean;
}

export function StarRating({
  videoId,
  ratingAvg,
  ratingCount,
  userRating,
  size = "sm",
  interactive = true,
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const [optimistic, setOptimistic] = useState<{ avg: number; count: number; mine: number } | null>(null);
  const { toast } = useToast();

  const rate = useRateVideo({
    mutation: {
      onSuccess: (res) => {
        setOptimistic({ avg: res.ratingAvg, count: res.ratingCount, mine: res.userRating ?? 0 });
        queryClient.invalidateQueries({ queryKey: getListVideosQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetVideoQueryKey(videoId) });
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
      },
      onError: () => {
        setOptimistic(null);
        toast({ title: "Couldn't save your rating", description: "Please try again.", variant: "destructive" });
      },
    },
  });

  const avg = optimistic?.avg ?? ratingAvg;
  const count = optimistic?.count ?? ratingCount;
  const mine = optimistic?.mine ?? userRating ?? 0;

  const px = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  const filledTo = hover || mine || Math.round(avg);

  return (
    <div className="flex items-center gap-1.5" data-testid={`star-rating-${videoId}`}>
      <div className="flex items-center" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= filledTo;
          return (
            <button
              key={star}
              type="button"
              disabled={!interactive || rate.isPending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOptimistic({ avg, count: mine ? count : count + 1, mine: star });
                rate.mutate({ id: videoId, data: { rating: star } });
              }}
              onMouseEnter={() => interactive && setHover(star)}
              className={`${interactive ? "cursor-pointer" : "cursor-default"} p-0.5 transition-transform ${interactive ? "hover:scale-110" : ""} disabled:opacity-100`}
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
              data-testid={`star-${videoId}-${star}`}
            >
              <Star
                className={`${px} transition-colors`}
                style={{
                  color: active ? "#fbbf24" : "rgba(255,255,255,0.25)",
                  fill: active ? "#fbbf24" : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>
      <span className={`${size === "sm" ? "text-xs" : "text-sm"} font-medium text-white/55`}>
        {count > 0 ? `${avg.toFixed(1)} (${count})` : "Not rated"}
      </span>
    </div>
  );
}
