import { useParams, Link } from "wouter";
import { useState } from "react";
import {
  useGetSharedDelivery,
  getGetSharedDeliveryQueryKey,
  useUnlockSharedDelivery,
} from "@workspace/api-client-react";
import type { PublicDelivery } from "@workspace/api-client-react";
import { Loader2, Lock, FileText, Download, Send } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatBytes(bytes?: number | null) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function DeliveryPage() {
  const params = useParams();
  const token = params.token as string;
  const [unlocked, setUnlocked] = useState<PublicDelivery | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading, isError } = useGetSharedDelivery(token, {
    query: { queryKey: getGetSharedDeliveryQueryKey(token), retry: false },
  });

  const unlock = useUnlockSharedDelivery({
    mutation: {
      onSuccess: (res) => setUnlocked(res),
      onError: () => setError("Incorrect password"),
    },
  });

  const delivery = unlocked ?? data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !delivery) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <EmptyState title="Delivery not found" description="This link is invalid or has been disabled." />
      </div>
    );
  }

  const needsUnlock = delivery.requiresPassword && !delivery.unlocked;

  const downloadHref = (fileId: number) => {
    const key = delivery.downloadKey;
    const suffix = key ? `?k=${encodeURIComponent(key)}` : "";
    return `/api/deliveries/shared/${token}/files/${fileId}/download${suffix}`;
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
          <Send className="w-6 h-6" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{delivery.title}</h1>
        {delivery.message && (
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap mt-3">{delivery.message}</p>
        )}
      </div>

      {needsUnlock ? (
        <div className="rounded-xl border border-border/50 bg-card p-8 max-w-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              unlock.mutate({ token, data: { password } });
            }}
          >
            <Lock className="h-7 w-7 text-muted-foreground mb-4" />
            <p className="text-white font-semibold mb-1">Password protected</p>
            <p className="text-muted-foreground text-xs mb-4">Enter the password to view these files.</p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg bg-background/40 border border-border/50 px-3 py-2 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-primary/60"
              data-testid="input-unlock-password"
            />
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            <Button type="submit" disabled={!password || unlock.isPending} className="mt-4 w-full font-semibold">
              {unlock.isPending ? "Checking…" : "Unlock"}
            </Button>
          </form>
        </div>
      ) : delivery.files.length > 0 ? (
        <div className="space-y-2">
          {delivery.files.map((f) => (
            <a
              key={f.id}
              href={downloadHref(f.id)}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3 hover:bg-card/70 transition-colors"
              data-testid={`download-file-${f.id}`}
            >
              <FileText className="w-5 h-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{f.name}</p>
                {f.size ? <p className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</p> : null}
              </div>
              <Download className="w-4 h-4 shrink-0 text-muted-foreground" />
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border/50 bg-card/30 px-4 py-8 text-center">
          No files have been added to this delivery yet.
        </p>
      )}

      <div className="mt-12 pt-6 border-t border-border/40 flex items-center justify-center">
        <Link href="/" className="text-xs text-muted-foreground hover:text-white transition-colors">
          Delivered with <span className="font-bold text-white">ChromaStudio</span>
        </Link>
      </div>
    </div>
  );
}
