import { useCreateProject } from "@workspace/api-client-react";
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
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const projectSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  location: z.string().optional(),
  budget: z.string().optional(),
  duration: z.string().optional(),
  rolesNeeded: z.string().min(2, "Roles needed are required"),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export function ProjectNew() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      budget: "",
      duration: "",
      rolesNeeded: "",
    },
  });

  const createMutation = useCreateProject({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Project posted successfully" });
        setLocation(`/projects/${data.id}`);
      },
      onError: () => {
        toast({ title: "Failed to post project", variant: "destructive" });
      }
    }
  });

  function onSubmit(data: ProjectFormValues) {
    const rolesArray = data.rolesNeeded.split(",").map(role => role.trim()).filter(Boolean);
    createMutation.mutate({
      data: {
        ...data,
        rolesNeeded: rolesArray,
      }
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-black text-white tracking-tight mb-8">Post a Project</h1>

      <div className="bg-card border border-border/50 rounded-xl p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Project Title</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-input border-border text-white" />
                  </FormControl>
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
                      placeholder="Describe the project, scope, and requirements..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Location</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. London, Remote" className="bg-input border-border text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Budget / Rate</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. $500/day, Negotiable" className="bg-input border-border text-white" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Duration / Dates</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. 3 days in October" className="bg-input border-border text-white" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rolesNeeded"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Roles Needed (Comma separated)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Cinematographer, Gaffer, Sound Mixer" className="bg-input border-border text-white" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={createMutation.isPending} className="w-full">
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post Project
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}