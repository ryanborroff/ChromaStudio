import { Link } from "wouter";
import { format } from "date-fns";
import { MapPin, Clock, DollarSign, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@workspace/api-client-react";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`} className="block group" data-testid={`project-card-${project.id}`}>
      <div className="rounded-xl bg-card border border-border/50 p-6 hover:border-primary/50 transition-colors h-full flex flex-col">
        <div className="flex justify-between items-start gap-4 mb-4">
          <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors line-clamp-2" data-testid={`project-title-${project.id}`}>
            {project.title}
          </h3>
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap" data-testid={`project-date-${project.id}`}>
            {format(new Date(project.createdAt), "MMM d")}
          </span>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-3 mb-6" data-testid={`project-desc-${project.id}`}>
          {project.description}
        </p>
        
        <div className="flex flex-wrap gap-2 mb-6">
          {project.rolesNeeded?.slice(0, 3).map((role, i) => (
            <Badge key={i} variant="secondary" className="bg-secondary/50 text-secondary-foreground" data-testid={`project-role-${project.id}-${i}`}>
              {role}
            </Badge>
          ))}
          {project.rolesNeeded && project.rolesNeeded.length > 3 && (
            <Badge variant="secondary" className="bg-secondary/50 text-secondary-foreground" data-testid={`project-role-more-${project.id}`}>
              +{project.rolesNeeded.length - 3} more
            </Badge>
          )}
        </div>
        
        <div className="mt-auto pt-4 border-t border-border/40 grid grid-cols-2 gap-y-3 gap-x-4 text-xs font-medium text-muted-foreground">
          {project.location && (
            <div className="flex items-center gap-1.5" data-testid={`project-location-${project.id}`}>
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span className="truncate">{project.location}</span>
            </div>
          )}
          {project.duration && (
            <div className="flex items-center gap-1.5" data-testid={`project-duration-${project.id}`}>
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="truncate">{project.duration}</span>
            </div>
          )}
          {project.budget && (
            <div className="flex items-center gap-1.5" data-testid={`project-budget-${project.id}`}>
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              <span className="truncate">{project.budget}</span>
            </div>
          )}
          {project.applicationCount !== undefined && (
            <div className="flex items-center gap-1.5" data-testid={`project-apps-${project.id}`}>
              <Users className="w-3.5 h-3.5 text-primary" />
              <span>{project.applicationCount} applicants</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}