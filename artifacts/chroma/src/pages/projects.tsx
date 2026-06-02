import { useState } from "react";
import { useListProjects, getListProjectsQueryKey } from "@workspace/api-client-react";
import { ProjectCard } from "@/components/project-card";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Search, Briefcase, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { Link } from "wouter";

export function Projects() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const queryParams = {
    search: debouncedSearch || undefined,
  };

  const { data, isLoading } = useListProjects(
    queryParams,
    { query: { queryKey: getListProjectsQueryKey(queryParams) } }
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Project Board</h1>
          <p className="text-muted-foreground mt-2 font-medium">Discover opportunities and crew up your productions.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search projects..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/50"
              data-testid="input-search-projects"
            />
          </div>
          <Button asChild className="font-semibold" data-testid="btn-new-project">
            <Link href="/projects/new">
              <Plus className="w-4 h-4 mr-2" />
              Post Project
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data?.projects && data.projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Briefcase className="w-10 h-10" />}
          title="No projects found"
          description="There are currently no projects matching your search. Be the first to post an opportunity."
        />
      )}
    </div>
  );
}