import { useRef } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { Loader2, ImagePlus, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  value?: string | null;
  onChange: (url: string) => void;
  label: string;
  /** Visual shape of the preview. */
  variant?: "avatar" | "wide";
  /** Max file size in MB (default 8). */
  maxSizeMb?: number;
}

export function ImageUploader({
  value,
  onChange,
  label,
  variant = "wide",
  maxSizeMb = 8,
}: ImageUploaderProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (res) => {
      onChange(`/api/storage${res.objectPath}`);
      toast({ title: `${label} uploaded` });
    },
    onError: () =>
      toast({ title: `Failed to upload ${label.toLowerCase()}`, variant: "destructive" }),
  });

  function handleFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast({ title: `Image must be under ${maxSizeMb} MB`, variant: "destructive" });
      return;
    }
    void uploadFile(file);
  }

  const isAvatar = variant === "avatar";

  return (
    <div className="space-y-2">
      <label className="text-white text-sm font-medium block">{label}</label>
      <div className={cn("flex items-center gap-4", isAvatar ? "flex-row" : "flex-col items-stretch")}>
        <div
          className={cn(
            "relative overflow-hidden bg-input border border-border flex items-center justify-center text-muted-foreground shrink-0",
            isAvatar ? "h-20 w-20 rounded-full" : "h-40 w-full rounded-xl",
          )}
        >
          {value ? (
            <img src={value} alt={label} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6" />
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-input px-4 py-2 text-sm font-medium text-white hover:border-primary/60 transition-colors disabled:opacity-50"
          data-testid={`button-upload-${variant}`}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {value ? "Replace" : "Upload"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        data-testid={`input-image-${variant}`}
      />
    </div>
  );
}
