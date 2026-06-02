import { useParams } from "wouter";
import { useGetProject, getGetProjectQueryKey, useApplyToProject } from "@workspace/api-client-react";
import { Loader2, MapPin, Clock, DollarSign, Users, Briefcase, Calendar } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useState } from "react";
import { Show } from "@clerk/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Avatar, AvatarImage, AvatarFallback } from "@radix-ui/react-avatar";

export function ProjectDetail() {
  const params = useParams();
  const projectId = Number(params.id);
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  const { data: project, isLoading, error } = useGetProject(projectId, {
    query: {
      enabled: !isNaN(projectId),
      queryKey: getGetProjectQueryKey(projectId)
    }
  });

  const applyMutation = useApplyToProject({
    mutation: {
      onSuccess: () => {
        setOpen(false);
        setMessage("");
        toast({ title: "Application submitted successfully" });
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      },
      onError: () => {
        toast({ title: "Failed to submit application", variant: "destructive" });
      }
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <EmptyState
          title="Project not found"
          description="This project may have been removed or you don't have permission to view it."
        />
      </div>
    );
  }

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    applyMutation.mutate({ data: { projectId, message } });
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
        <div className="p-8 md:p-10 border-b border-border/40">
          <div className="flex flex-wrap gap-3 mb-6">
            {project.rolesNeeded?.map((role, i) => (
              <Badge key={i} className="bg-primary/20 text-primary hover:bg-primary/30 border-0 px-3 py-1 text-sm font-medium">
                {role}
              </Badge>
            ))}
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-6 leading-tight">
            {project.title}
          </h1>
          
          <div className="flex flex-wrap gap-y-4 gap-x-8 text-sm font-medium text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Posted {format(new Date(project.createdAt), "MMMM d, yyyy")}
            </div>
            {project.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                {project.location}
              </div>
            )}
            {project.duration && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                {project.duration}
              </div>
            )}
            {project.budget && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                {project.budget}
              </div>
            )}
            {project.applicationCount !== undefined && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {project.applicationCount} Applicants
              </div>
            )}
          </div>
        </div>

        <div className="p-8 md:p-10 bg-background/50">
          <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-p:text-muted-foreground prose-headings:text-white">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Project Details
            </h3>
            <div className="whitespace-pre-wrap text-foreground/90 font-medium">
              {project.description}
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              {project.user && (
                <>
                  <Avatar className="h-12 w-12 border border-border/50">
                    <AvatarImage src={project.user.avatarUrl || undefined} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">
                      {project.user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Posted by</p>
                    <p className="font-bold text-white">{project.user.name}</p>
                  </div>
                </>
              )}
            </div>
            
            <Show when="signed-in">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full sm:w-auto px-10 h-14 text-lg font-bold">
                    Apply Now
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border/50 sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Apply for {project.title}</DialogTitle>
                    <DialogDescription className="text-muted-foreground font-medium">
                      Introduce yourself and explain why you're a good fit for this project.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleApply} className="space-y-6 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white">Application Message</label>
                      <Textarea 
                        placeholder="Hi, I'm a cinematographer based in..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[150px] bg-input border-border/50 resize-none text-white"
                      />
                    </div>
                    <Button type="submit" className="w-full h-12 font-bold" disabled={!message.trim() || applyMutation.isPending}>
                      {applyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Send Application
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}