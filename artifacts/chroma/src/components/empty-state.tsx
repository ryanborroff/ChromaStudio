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
  icon = <Film className="w-[26px] h-[26px]" />,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center py-12 px-8 text-center rounded-xl ${className}`}
      style={{ border: "0.5px solid #262624" }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: "rgba(245,158,11,0.12)" }}
      >
        <span style={{ color: "#fb923c", display: "flex" }}>{icon}</span>
      </div>
      <h3 className="text-[18px] font-medium mb-[6px]" style={{ color: "#f2f2f2" }}>
        {title}
      </h3>
      <p
        className="text-[14px] leading-[1.5] max-w-[340px] mx-auto mb-5"
        style={{ color: "#9a9a94" }}
      >
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
