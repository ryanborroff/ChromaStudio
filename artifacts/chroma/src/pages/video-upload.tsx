import { useState, useRef } from "react";
import {
  useCreateVideo,
  useCreateVideoUploadUrl,
  useUpdateVideo,
  useConfirmVideoUpload,
} from "@workspace/api-client-react";
import MuxUploader, {
  type MuxUploaderRefAttributes,
} from "@mux/mux-uploader-react";
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
import { DOWNLOAD_FORMATS } from "@/lib/downloadFormats";

const VIDEO_TAGS = [
  "Documentary",
  "Narrative",
  "Experimental",
  "Commercial",
  "Music Video",
] as const;

const uploadSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  privacy: z
    .enum(["public", "private", "password_protected"])
    .default("public"),
  credits: z.string().optional(),
  tags: z.array(z.string()).default([]),
  downloadFormats: z.array(z.string()).default(["1080p", "720p"]),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

function uploadViaPost(
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
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}

function uploadViaPut(
  uploadURL: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadURL, true);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export function VideoUpload() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const muxUploaderRef = useRef<MuxUploaderRefAttributes | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [pendingUpload, setPendingUpload] = useState<{
    uploadURL: string;
    uid: string;
    uploadMethod: "put" | "post";
    streamProvider: string | null;
    fileName: string;
    fileSize: number;
    videoId: number;
    retryCount: number;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("chroma.pendingUpload");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
      description: "",
      privacy: "public",
      credits: "",
      tags: [],
      downloadFormats: ["1080p", "720p"],
    },
  });

  const uploadUrlMutation = useCreateVideoUploadUrl();
  const createMutation = useCreateVideo();
  const updateMutation = useUpdateVideo();
  const confirmUploadMutation = useConfirmVideoUpload();

  const busy = phase !== "idle";

  function pickFile(f: File | null) {
    if (f && !f.type.startsWith("video/")) {
      toast({ title: "Please choose a video file", variant: "destructive" });
      return;
    }
    setFile(f);
    if (
      f &&
      pendingUpload &&
      (pendingUpload.fileName !== f.name || pendingUpload.fileSize !== f.size)
    ) {
      setPendingUpload(null);
      localStorage.removeItem("chroma.pendingUpload");
    }
    if (f && !form.getValues("title")) {
      form.setValue("title", f.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function onSubmit(data: UploadFormValues) {
    if (!file) {
      toast({ title: "Choose a video file to upload", variant: "destructive" });
      return;
    }
    let activeVideoId: number | null = pendingUpload?.videoId ?? null;
    try {
      setPhase("uploading");
      setProgress(0);
      const canResume =
        pendingUpload?.fileName === file.name &&
        pendingUpload.fileSize === file.size;
      const ticket = canResume
        ? pendingUpload
        : await uploadUrlMutation.mutateAsync();
      const normalizedTicket = {
        ...ticket,
        uploadMethod: ticket.uploadMethod ?? "put",
        streamProvider: ticket.streamProvider ?? null,
      };
      const isObjectStorage = !normalizedTicket.streamProvider;
      let videoId = canResume ? pendingUpload.videoId : 0;
      const retryCount = canResume ? pendingUpload.retryCount + 1 : 0;

      if (!canResume) {
        const video = await createMutation.mutateAsync({
          data: {
            ...data,
            fileSizeBytes: file.size,
            ...(isObjectStorage
              ? { videoUrl: `/api/storage${ticket.uid}` }
              : { streamUid: ticket.uid }),
            ...(thumbnailUrl ? { thumbnailUrl } : {}),
          },
        });
        videoId = video.id;
      }
      activeVideoId = videoId;

      const savedTicket = {
        ...normalizedTicket,
        fileName: file.name,
        fileSize: file.size,
        videoId,
        retryCount,
      };
      setPendingUpload(savedTicket);
      localStorage.setItem("chroma.pendingUpload", JSON.stringify(savedTicket));

      let lastPersistedProgress = -10;
      const persistProgress = (pct: number) => {
        setProgress(pct);
        if (pct === 100 || pct - lastPersistedProgress >= 10) {
          lastPersistedProgress = pct;
          void updateMutation.mutateAsync({
            id: videoId,
            data: { uploadProgressPercent: pct, uploadError: null, retryCount },
          });
        }
      };

      if (normalizedTicket.streamProvider === "mux") {
        await new Promise<void>((resolve, reject) => {
          const uploader = muxUploaderRef.current;
          if (!uploader) {
            reject(new Error("Mux uploader is unavailable"));
            return;
          }
          uploader.setAttribute("endpoint", normalizedTicket.uploadURL);
          const onSuccess = () => {
            uploader.removeEventListener("success", onSuccess);
            uploader.removeEventListener("uploaderror", onError);
            resolve();
          };
          const onError = (event: Event) => {
            uploader.removeEventListener("success", onSuccess);
            uploader.removeEventListener("uploaderror", onError);
            const detail = (event as CustomEvent<{ message?: string }>).detail;
            reject(new Error(detail?.message ?? "Mux upload failed"));
          };
          const onProgress = (event: Event) => {
            persistProgress((event as CustomEvent<number>).detail);
          };
          uploader.addEventListener("success", onSuccess);
          uploader.addEventListener("uploaderror", onError);
          uploader.addEventListener("progress", onProgress);
          uploader.dispatchEvent(
            new CustomEvent("file-ready", {
              detail: file,
              bubbles: true,
              composed: true,
            }),
          );
        });
      } else if (normalizedTicket.uploadMethod === "put") {
        await uploadViaPut(normalizedTicket.uploadURL, file, persistProgress);
      } else {
        await uploadViaPost(normalizedTicket.uploadURL, file, persistProgress);
      }

      setPhase("saving");
      // For object-storage uploads the server validates the upload before
      // marking streamStatus "ready" via a trusted endpoint. For streaming
      // providers, the status is set by an incoming webhook — we only update
      // the progress fields here.
      if (isObjectStorage) {
        await confirmUploadMutation.mutateAsync({ id: videoId });
      }
      await updateMutation.mutateAsync({
        id: videoId,
        data: {
          uploadProgressPercent: 100,
          uploadError: null,
          retryCount,
        },
      });
      localStorage.removeItem("chroma.pendingUpload");
      setPendingUpload(null);
      toast({
        title: isObjectStorage
          ? "Video uploaded"
          : "Video uploaded — now processing",
      });
      setLocation(`/videos/${videoId}`);
    } catch (err) {
      if (activeVideoId) {
        const nextRetryCount = (pendingUpload?.retryCount ?? 0) + 1;
        if (pendingUpload) {
          const nextPendingUpload = {
            ...pendingUpload,
            retryCount: nextRetryCount,
          };
          setPendingUpload(nextPendingUpload);
          localStorage.setItem(
            "chroma.pendingUpload",
            JSON.stringify(nextPendingUpload),
          );
        }
        void updateMutation.mutateAsync({
          id: activeVideoId,
          data: {
            uploadError:
              err instanceof Error ? err.message : "Please try again",
            retryCount: nextRetryCount,
          },
        });
      }
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
      <h1 className="text-3xl font-black text-white tracking-tight mb-8">
        Upload Video
      </h1>

      <div className="bg-card border border-border/50 rounded-xl p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="text-white text-sm font-medium mb-2 block">
                Video file
              </label>
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
                  <span className="font-medium">
                    Drag &amp; drop or click to choose a video
                  </span>
                  <span className="text-xs">MP4, MOV, WebM and more</span>
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-input px-4 py-3">
                  <Film className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">
                      {file.name}
                    </p>
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
              <div className="space-y-3 rounded-xl border border-border/40 bg-card/30 p-5 text-center">
                <h3 className="text-lg font-semibold text-white">You're in</h3>
                <p className="text-sm text-muted-foreground">
                  Your video's uploading — we'll let you know the second it's ready.
                </p>
                <div className="space-y-2 pt-1">
                  <Progress value={phase === "saving" ? 100 : progress} />
                  <p className="text-xs text-muted-foreground">
                    {phase === "uploading"
                      ? `${progress}% uploaded`
                      : "Finishing up…"}
                  </p>
                </div>
              </div>
            )}

            {pendingUpload && !busy && (
              <p className="text-xs text-amber-300/80">
                An interrupted upload for{" "}
                <span className="font-medium">{pendingUpload.fileName}</span> is
                available to resume when you select that file again.
              </p>
            )}

            <MuxUploader
              ref={muxUploaderRef}
              noDrop
              noProgress
              noStatus
              noRetry
              style={{ display: "none" }}
              onProgress={(event) =>
                setProgress((event as CustomEvent<number>).detail)
              }
            />

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
                    <Input
                      {...field}
                      className="bg-input border-border text-white"
                    />
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
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-input border-border text-white">
                        <SelectValue placeholder="Select privacy" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="public">
                        Public - visible on feed and profile
                      </SelectItem>
                      <SelectItem value="private">
                        Private - only you can view
                      </SelectItem>
                      <SelectItem value="password_protected">
                        Password Protected
                      </SelectItem>
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
                  <FormDescription>
                    List the key crew members who worked on this piece.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Genre tags</FormLabel>
                  <FormDescription>Select all that apply.</FormDescription>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {VIDEO_TAGS.map((tag) => {
                      const checked = field.value?.includes(tag) ?? false;
                      return (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => {
                            const set = new Set(field.value ?? []);
                            if (set.has(tag)) set.delete(tag);
                            else set.add(tag);
                            field.onChange(
                              VIDEO_TAGS.filter((t) => set.has(t)),
                            );
                          }}
                          className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                            checked
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-input text-muted-foreground hover:border-primary/50 hover:text-white"
                          }`}
                          aria-pressed={checked}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="downloadFormats"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Download formats</FormLabel>
                  <FormDescription>
                    Choose which resolutions viewers can download. Leave all off
                    to disable downloads.
                  </FormDescription>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                    {DOWNLOAD_FORMATS.map((fmt) => {
                      const checked = field.value?.includes(fmt.value) ?? false;
                      return (
                        <button
                          type="button"
                          key={fmt.value}
                          onClick={() => {
                            const set = new Set(field.value ?? []);
                            if (set.has(fmt.value)) set.delete(fmt.value);
                            else set.add(fmt.value);
                            field.onChange(
                              DOWNLOAD_FORMATS.filter((f) =>
                                set.has(f.value),
                              ).map((f) => f.value),
                            );
                          }}
                          className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
                            checked
                              ? "border-primary bg-primary/10"
                              : "border-border bg-input hover:border-primary/50"
                          }`}
                          data-testid={`toggle-format-${fmt.value}`}
                          aria-pressed={checked}
                        >
                          <span className="text-sm font-semibold text-white">
                            {fmt.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {fmt.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {phase === "uploading"
                ? "Uploading…"
                : phase === "saving"
                  ? "Saving…"
                  : "Publish to ChromaStudio"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
