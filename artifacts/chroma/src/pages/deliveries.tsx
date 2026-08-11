import { useState } from "react";
import { Link } from "wouter";
import {
  useListDeliveries,
  getListDeliveriesQueryKey,
  useCreateDelivery,
} from "@workspace/api-client-react";
import { Loader2, Send, Plus, Lock, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

export function Deliveries() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");

  const { data, isLoading } = useListDeliveries({
    query: { queryKey: getListDeliveriesQueryKey() },
  });

  const create = useCreateDelivery({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
        setOpen(false);
        setTitle("");
        setMessage("");
        setPassword("");
        toast({ title: "Delivery created" });
      },
      onError: () => toast({ title: "Could not create delivery", variant: "destructive" }),
    },
  });

  const deliveries = data?.deliveries ?? [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Client Delivery</h1>
          <p className="text-muted-foreground mt-2 font-medium">
            Send clients a private download link for any files — cuts, stills, docs or ZIPs.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="font-semibold" data-testid="btn-new-delivery">
              <Plus className="w-4 h-4 mr-2" />
              New delivery
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New delivery</DialogTitle>
              <DialogDescription>
                Create a delivery, then upload your files and share the link.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!title.trim()) return;
                create.mutate({
                  data: {
                    title: title.trim(),
                    message: message.trim() || undefined,
                    password: password.trim() || undefined,
                  },
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="d-title">Title</Label>
                <Input
                  id="d-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Final cut — Acme brand film"
                  data-testid="input-delivery-title"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-message">Message to client (optional)</Label>
                <Textarea
                  id="d-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Here's the final delivery — let me know if you need any other formats."
                  rows={3}
                  data-testid="input-delivery-message"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d-password">Password (optional)</Label>
                <Input
                  id="d-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank for no password"
                  data-testid="input-delivery-password"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!title.trim() || create.isPending} className="font-semibold">
                  {create.isPending ? "Creating…" : "Create delivery"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : deliveries.length > 0 ? (
        <div className="space-y-3">
          {deliveries.map((d) => (
            <Link
              key={d.id}
              href={`/studio/delivery/${d.id}`}
              className="flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-4 hover:bg-card/70 transition-colors"
              data-testid={`link-delivery-${d.id}`}
            >
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{d.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {d.fileCount} {d.fileCount === 1 ? "file" : "files"}
                  </span>
                  {d.hasPassword && (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      Password
                    </span>
                  )}
                  <span>{format(new Date(d.createdAt), "MMM d, yyyy")}</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Send className="w-10 h-10" />}
          title="Nothing sent yet"
          description="Upload your files whenever you're ready — we'll turn them into a link your client can open with one click."
        />
      )}
    </div>
  );
}
