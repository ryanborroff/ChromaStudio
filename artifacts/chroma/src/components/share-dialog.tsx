import { useState } from "react";
import { useUpdateVideoShare } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/useAuth";
import { Link } from "wouter";
import { Copy, Link2, Code2, Loader2, Lock, Sparkles } from "lucide-react";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: { id: number; title: string; shareEnabled: boolean; shareToken: string | null; hasSharePassword: boolean };
  onChanged?: () => void;
}

const base = import.meta.env.BASE_URL; // ends with "/"

export function ShareDialog({ open, onOpenChange, video, onChanged }: ShareDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPaid = (user?.plan ?? "free") !== "free";
  const [settings, setSettings] = useState({
    shareEnabled: video.shareEnabled,
    shareToken: video.shareToken,
    hasSharePassword: video.hasSharePassword,
  });
  const [password, setPassword] = useState("");

  const mutation = useUpdateVideoShare({
    mutation: {
      onSuccess: (res) => {
        setSettings({
          shareEnabled: res.shareEnabled,
          shareToken: res.shareToken ?? null,
          hasSharePassword: res.hasSharePassword,
        });
        setPassword("");
        onChanged?.();
      },
      onError: () => toast({ title: "Could not update sharing", variant: "destructive" }),
    },
  });

  function apply(next: { enabled: boolean; password?: string | null }) {
    mutation.mutate({ id: video.id, data: { enabled: next.enabled, password: next.password } });
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = settings.shareToken ? `${origin}${base}watch/${settings.shareToken}` : "";
  const embedUrl = settings.shareToken ? `${origin}${base}embed/${settings.shareToken}` : "";
  const embedCode = `<iframe src="${embedUrl}" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share & embed</DialogTitle>
          <DialogDescription className="truncate">{video.title}</DialogDescription>
        </DialogHeader>

        {!isPaid ? (
          <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/15">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">Sharing & embedding are a paid feature</p>
              <p className="text-xs text-muted-foreground">
                Upgrade your plan to create shareable links and embed your videos on external
                websites.
              </p>
            </div>
            <Button asChild className="w-full" onClick={() => onOpenChange(false)}>
              <Link href={`${base}pricing`}>
                <Sparkles className="mr-2 h-4 w-4" /> View plans
              </Link>
            </Button>
          </div>
        ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Share link</p>
              <p className="text-xs text-muted-foreground">Anyone with the link can watch.</p>
            </div>
            <Switch
              checked={settings.shareEnabled}
              disabled={mutation.isPending}
              onCheckedChange={(v) => apply({ enabled: v })}
            />
          </div>

          {settings.shareEnabled && settings.shareToken && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Share link
                </Label>
                <div className="flex gap-2">
                  <Input readOnly value={shareUrl} className="bg-input border-border text-white text-xs" />
                  <Button type="button" size="icon" variant="secondary" onClick={() => copy(shareUrl, "Link")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" /> Embed code
                </Label>
                <div className="flex gap-2">
                  <textarea
                    readOnly
                    value={embedCode}
                    rows={3}
                    className="flex-1 rounded-md bg-input border border-border text-white text-xs p-2 resize-none font-mono"
                  />
                  <Button type="button" size="icon" variant="secondary" onClick={() => copy(embedCode, "Embed code")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 pt-1 border-t border-border/40">
                <Label className="text-xs text-muted-foreground">
                  Password protection {settings.hasSharePassword && <span className="text-primary">• enabled</span>}
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={settings.hasSharePassword ? "Set a new password" : "Add a password"}
                    className="bg-input border-border text-white"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!password || mutation.isPending}
                    onClick={() => apply({ enabled: true, password })}
                  >
                    {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set"}
                  </Button>
                </div>
                {settings.hasSharePassword && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-white px-0"
                    disabled={mutation.isPending}
                    onClick={() => apply({ enabled: true, password: null })}
                  >
                    Remove password
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
