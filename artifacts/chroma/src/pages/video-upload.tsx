import { useCreateVideo } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const uploadSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  videoUrl: z.string().url("Must be a valid URL").optional(),
  thumbnailUrl: z.string().url("Must be a valid URL").optional(),
  privacy: z.enum(["public", "private", "password_protected"]).default("public"),
  credits: z.string().optional(),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

export function VideoUpload() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
      description: "",
      videoUrl: "",
      thumbnailUrl: "",
      privacy: "public",
      credits: "",
    },
  });

  const createMutation = useCreateVideo({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Video uploaded successfully" });
        setLocation(`/videos/${data.id}`);
      },
      onError: () => {
        toast({ title: "Failed to upload video", variant: "destructive" });
      }
    }
  });

  function onSubmit(data: UploadFormValues) {
    createMutation.mutate({ data });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-black text-white tracking-tight mb-8">Upload Video</h1>

      <div className="bg-card border border-border/50 rounded-xl p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              name="videoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Video URL</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" placeholder="Vimeo, YouTube, or direct MP4 link" className="bg-input border-border text-white" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="thumbnailUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Thumbnail URL</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" placeholder="https://" className="bg-input border-border text-white" />
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

            <Button type="submit" disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish to Chroma
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}