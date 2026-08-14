import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

const TAGS = ["4K", "Staff Pick", "New Release", "Award Winner", "Trending", "Short Film"];

export function FilterStrip() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-between gap-3 mb-6">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {TAGS.map((tag) => {
          const isActive = active === tag;
          return (
            <button
              key={tag}
              onClick={() => setActive(isActive ? null : tag)}
              className="shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full transition-all"
              style={
                isActive
                  ? {
                      background: "linear-gradient(135deg, #f59e0b, #d97706)",
                      color: "#000",
                      border: "1px solid transparent",
                    }
                  : {
                      background: "#111116",
                      color: "#b5b5b0",
                      border: "1px solid #232329",
                    }
              }
              data-testid={`filter-pill-${tag.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <button
        className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full text-white/70 hover:text-white transition-colors"
        style={{ background: "#111116", border: "1px solid #232329" }}
        data-testid="btn-filter"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filter
      </button>
    </div>
  );
}
