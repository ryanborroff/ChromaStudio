import {
  useGetStorageUsage,
  useListExportJobs,
  useRequestBulkExport,
  useCreatePortalSession,
} from "@workspace/api-client-react";
import {
  CreditCard,
  Database,
  Download,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/useAuth";
import { queryClient } from "@/lib/queryClient";

function formatBytes(bytes?: number | null) {
  const safeBytes =
    typeof bytes === "number" && Number.isFinite(bytes)
      ? Math.max(0, bytes)
      : 0;

  if (safeBytes < 1024) return `${safeBytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = safeBytes;
  let unit = -1;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function StorageConfidence() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: usage, isLoading: usageLoading } = useGetStorageUsage();
  const portalMutation = useCreatePortalSession({
    mutation: {
      onSuccess: (result) => {
        window.location.href = result.url;
      },
      onError: () => {
        toast({
          title: "Could not open billing portal",
          description: "Try again in a moment.",
          variant: "destructive",
        });
      },
    },
  });
  const { data: jobs = [], isLoading: jobsLoading } = useListExportJobs();
  const exportMutation = useRequestBulkExport({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Export prepared",
          description: "Your download links are ready below.",
        });
        void queryClient.invalidateQueries();
      },
      onError: () =>
        toast({
          title: "Export unavailable",
          description: "Try again when your videos are ready.",
          variant: "destructive",
        }),
    },
  });

  const percent = Math.min(usage?.usagePercent ?? 0, 100);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Storage &amp; exports
          </h1>
          <p className="text-sm text-muted-foreground">
            Keep visibility and a portable copy of your work.
          </p>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-border/50 bg-card p-6">
        <div className="mb-3 flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-white">Billing</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white">
              Current plan:{" "}
              <span className="font-semibold capitalize text-primary">
                {user?.plan ?? "free"}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {user?.plan && user.plan !== "free"
                ? "Manage your subscription, payment method, and invoices."
                : "Upgrade from the pricing page to unlock sharing, embeds, and more."}
            </p>
          </div>
          {user?.plan && user.plan !== "free" ? (
            <Button
              variant="secondary"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Manage subscription
            </Button>
          ) : (
            <Button variant="secondary" asChild>
              <a href="/pricing">View plans</a>
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border/50 bg-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-white">Storage usage</h2>
        </div>
        {usageLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : usage ? (
          <>
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <span className="text-2xl font-black text-white">
                {formatBytes(usage.totalBytesUsed)}
              </span>
              <span className="text-sm text-muted-foreground">
                of {formatBytes(usage.planStorageLimitBytes)}
              </span>
            </div>
            <Progress value={percent} />
            <p
              className={`mt-3 text-sm ${usage.warning ? "text-amber-300" : "text-muted-foreground"}`}
            >
              {usage.warning
                ? "You are approaching your plan limit. Exports remain available."
                : `${usage.videoCount} ready video${usage.videoCount === 1 ? "" : "s"} tracked.`}
            </p>
          </>
        ) : null}
      </section>

      <section className="mt-6 rounded-xl border border-border/50 bg-card p-6">
        <div className="mb-3">
          <h2 className="font-bold text-white">Export my data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate direct download links hosted by your video provider. No
            media is proxied through Chroma.
          </p>
        </div>
        <Button
          onClick={() => exportMutation.mutate({ data: { scope: "account" } })}
          disabled={exportMutation.isPending}
        >
          {exportMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export all ready videos
        </Button>

        {jobsLoading ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-primary" />
        ) : (
          <div className="mt-6 space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-lg border border-border/40 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium capitalize text-white">
                      {job.scope} export
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {job.downloadUrls.length} direct link
                      {job.downloadUrls.length === 1 ? "" : "s"} ·{" "}
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {job.status}
                  </span>
                </div>
                {job.downloadUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.downloadUrls.map((url, index) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-white hover:border-primary"
                      >
                        <Download className="h-3 w-3" /> Download {index + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
