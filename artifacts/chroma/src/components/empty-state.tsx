import { Film } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ 
  icon = <Film className="w-12 h-12" />, 
  title, 
  description, 
  action,
  className = ""
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-border/50 bg-card/30 ${className}`}>
      <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}