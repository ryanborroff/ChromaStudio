import { useState, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  useGetDelivery,
  getGetDeliveryQueryKey,
  getListDeliveriesQueryKey,
  useAddDeliveryFile,
  useDeleteDeliveryFile,
  useUpdateDelivery,
  useDeleteDelivery,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import {
  Loader2,
  ArrowLeft,
  Upload,
  FileText,
  Trash2,
  Copy,
  Check,
  Lock,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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

export function DeliveryManage() {
  const params = useParams();
  const id = parseInt(params.id as string, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [password, setPassword] = useState("");

  const queryKey = getGetDeliveryQueryKey(id);
  const { data, isLoading, isError } = useGetDelivery(id, { query: { queryKey } });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
  };

  const addFile = useAddDeliveryFile({
    mutation: {
      onSuccess: () => invalidate(),
      onError: () => toast({ title: "Could not attach file", variant: "destructive" }),
    },
  });
  const deleteFile = useDeleteDeliveryFile({
    mutation: { onSuccess: () => invalidate() },
  });
  const updateDelivery = useUpdateDelivery({
    mutation: {
      onSuccess: () => {
        invalidate();
        setPassword("");
      },
    },
  });
  const deleteDelivery = useDeleteDelivery({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
        navigate("/studio/delivery");
      },
    },
  });

  const { uploadFile, isUploading } = useUpload({ uploadPath: "/uploads/request-file-url" });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const res = await uploadFile(file);
      if (!res) {
        toast({ title: `Upload failed: ${file.name}`, variant: "destructive" });
        continue;
      }
      await addFile.mutateAsync({
        id,
        data: {
          objectPath: res.objectPath,
          name: file.name,
          contentType: file.type || undefined,
          size: file.size || undefined,
        },
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <EmptyState title="Delivery not found" description="This delivery may have been deleted." />
      </div>
    );
  }

  const shareUrl = `${window.location.origin}${basePath}/deliver/${data.token}`;
  const busy = isUploading || addFile.isPending;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Link
        href="/studio/delivery"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        All deliveries
      </Link>

      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-3xl font-black text-white tracking-tight">{data.title}</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-400" data-testid="btn-delete-delivery">
              <Trash2 className="w-5 h-5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this delivery?</AlertDialogTitle>
              <AlertDialogDescription>
                The share link will stop working and all uploaded files will be removed. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDelivery.mutate({ id })}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {data.message && (
        <p className="text-muted-foreground whitespace-pre-wrap mb-6">{data.message}</p>
      )}

      {/* Share link */}
      <div className="rounded-xl border border-border/50 bg-card p-4 mb-6">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-2">
          <LinkIcon className="w-3.5 h-3.5" /> Private download link
        </Label>
        <div className="flex gap-2">
          <Input readOnly value={shareUrl} className="bg-background/40 text-sm" data-testid="input-share-url" />
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              toast({ title: "Link copied" });
              setTimeout(() => setCopied(false), 2000);
            }}
            data-testid="btn-copy-link"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Files */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white">Files</h2>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="input-file-upload"
        />
        <Button onClick={() => fileInputRef.current?.click()} disabled={busy} className="font-semibold" data-testid="btn-upload-files">
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {busy ? "Uploading…" : "Upload files"}
        </Button>
      </div>

      {data.files.length > 0 ? (
        <div className="space-y-2 mb-8">
          {data.files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 px-4 py-3"
              data-testid={`file-row-${f.id}`}
            >
              <FileText className="w-5 h-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{f.name}</p>
                {f.size ? <p className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</p> : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-red-400"
                onClick={() => deleteFile.mutate({ id, fileId: f.id })}
                data-testid={`btn-delete-file-${f.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mb-8 rounded-xl border border-dashed border-border/50 bg-card/30 px-4 py-8 text-center">
          No files yet. Upload cuts, stills, docs or ZIPs (up to 50 MB each).
        </p>
      )}

      {/* Password */}
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-2">
          <Lock className="w-3.5 h-3.5" /> Password protection
        </Label>
        <p className="text-sm text-muted-foreground mb-3">
          {data.hasPassword
            ? "This delivery is password protected. The client must enter the password to download."
            : "Add a password so only people with it can open the delivery."}
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={data.hasPassword ? "Set a new password" : "Choose a password"}
            className="bg-background/40"
            data-testid="input-manage-password"
          />
          <Button
            variant="secondary"
            disabled={!password.trim() || updateDelivery.isPending}
            onClick={() => updateDelivery.mutate({ id, data: { password: password.trim() } })}
            data-testid="btn-save-password"
          >
            Save
          </Button>
          {data.hasPassword && (
            <Button
              variant="ghost"
              disabled={updateDelivery.isPending}
              onClick={() => updateDelivery.mutate({ id, data: { password: null } })}
              className="text-muted-foreground hover:text-red-400"
              data-testid="btn-remove-password"
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
