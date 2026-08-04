import { useEffect, useState } from "react";
import {
  getGetMyPortfolioQueryKey,
  useGetMyPortfolio,
  useUpdateMyPortfolio,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export function PortfolioSettings() {
  const { toast } = useToast();
  const query = useGetMyPortfolio({
    query: { queryKey: getGetMyPortfolioQueryKey() },
  });
  const update = useUpdateMyPortfolio({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetMyPortfolioQueryKey(),
        });
        toast({ title: "Portfolio settings saved" });
      },
      onError: () =>
        toast({
          title: "Could not save portfolio settings",
          variant: "destructive",
        }),
    },
  });
  const portfolio = query.data;
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    if (!portfolio) return;
    setHandle(portfolio.handle);
    setDisplayName(portfolio.displayName);
    setBio(portfolio.bio ?? "");
    setIsPublished(portfolio.isPublished);
  }, [portfolio]);

  if (query.isLoading || !portfolio)
    return (
      <div className="p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  return (
    <div className="container mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-black text-white">Portfolio presentation</h1>
      <p className="mt-2 text-white/50">
        Publish a focused showcase separate from your working library.
      </p>
      <form
        className="mt-8 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate({ data: { handle, displayName, bio, isPublished } });
        }}
      >
        <label className="block text-sm text-white/70">
          Public handle
          <Input
            className="mt-2"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </label>
        <label className="block text-sm text-white/70">
          Display name
          <Input
            className="mt-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="block text-sm text-white/70">
          Bio
          <Textarea
            className="mt-2"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-3 text-sm text-white/70">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          Publish at{" "}
          <span className="text-primary">
            /portfolio/{handle || "your-handle"}
          </span>
        </label>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save portfolio"}
        </Button>
      </form>
    </div>
  );
}
