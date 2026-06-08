import { useState, useRef } from "react";
import { useCreateVideo, useCreateVideoUploadUrl } from "@workspace/api-client-react";
import { Loader2, UploadCloud, Film, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ImageUploader } from "@/components/ImageUploader";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const uploadSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  privacy: z.enum(["public", "private", "password_protected"]).default("public"),
  credits: z.string().optional(),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

function uploadFileToStream(
  uploadURL: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    xhr.open("POST", uploadURL, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}

export function VideoUpload() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
      description: "",
      privacy: "public",
      credits: "",
    },
  });

  const uploadUrlMutation = useCreateVideoUploadUrl();
  const createMutation = useCreateVideo();

  const busy = phase !== "idle";

  function pickFile(f: File | null) {
    if (f && !f.type.startsWith("video/")) {
      toast({ title: "Please choose a video file", variant: "destructive" });
      return;
    }
    setFile(f);
    if (f && !form.getValues("title")) {
      form.setValue("title", f.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function onSubmit(data: UploadFormValues) {
    if (!file) {
      toast({ title: "Choose a video file to upload", variant: "destructive" });
      return;
    }
    try {
      setPhase("uploading");
      setProgress(0);
      const ticket = await uploadUrlMutation.mutateAsync();
      await uploadFileToStream(ticket.uploadURL, file, setProgress);

      setPhase("saving");
      const video = await createMutation.mutateAsync({
        data: {
          ...data,
          streamUid: ticket.uid,
          ...(thumbnailUrl ? { thumbnailUrl } : {}),
        },
      });
      toast({ title: "Video uploaded — now processing" });
      setLocation(`/videos/${video.id}`);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
      setPhase("idle");
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-black text-white tracking-tight mb-8">Upload Video</h1>

      <div className="bg-card border border-border/50 rounded-xl p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="text-white text-sm font-medium mb-2 block">Video file</label>
              {!file ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className="w-full border-2 border-dashed border-border rounded-xl py-12 px-6 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/60 hover:text-white transition-colors"
                  data-testid="dropzone-video"
                >
                  <UploadCloud className="w-8 h-8" />
                  <span className="font-medium">Drag &amp; drop or click to choose a video</span>
                  <span className="text-xs">MP4, MOV, WebM and more</span>
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-input px-4 py-3">
                  <Film className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                  {!busy && (
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-muted-foreground hover:text-white"
                      data-testid="button-clear-file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                data-testid="input-file"
              />
            </div>

            {busy && (
              <div className="space-y-2">
                <Progress value={phase === "saving" ? 100 : progress} />
                <p className="text-xs text-muted-foreground">
                  {phase === "uploading" ? `Uploading… ${progress}%` : "Finishing up…"}
                </p>
              </div>
            )}

            <ImageUploader
              label="Thumbnail (optional)"
              variant="wide"
              value={thumbnailUrl}
              onChange={setThumbnailUrl}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Title</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-input border-border text-white" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="privacy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Privacy</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-input border-border text-white">
                        <SelectValue placeholder="Select privacy" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="public">Public - visible on feed and profile</SelectItem>
                      <SelectItem value="private">Private - only you can view</SelectItem>
                      <SelectItem value="password_protected">Password Protected</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className="bg-input border-border text-white min-h-[120px]"
                      placeholder="Tell us about the project..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="credits"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Credits</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className="bg-input border-border text-white min-h-[100px]"
                      placeholder="Director: Jane Doe&#10;DP: John Smith"
                    />
                  </FormControl>
                  <FormDescription>List the key crew members who worked on this piece.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {phase === "uploading" ? "Uploading…" : phase === "saving" ? "Saving…" : "Publish to Chroma"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
