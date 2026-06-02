import { useState } from "react";
import { useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { UserCard } from "@/components/user-card";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";

const PROFESSIONS = [
  "Director",
  "Cinematographer",
  "Editor",
  "Producer",
  "Writer",
  "Composer",
  "Sound Designer",
  "Colourist",
  "Production Designer",
  "Student",
  "Other"
];

export function Crew() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [profession, setProfession] = useState<string>("all");

  const queryParams = {
    search: debouncedSearch || undefined,
    profession: profession !== "all" ? profession : undefined
  };

  const { data, isLoading } = useListUsers(
    queryParams,
    { query: { queryKey: getListUsersQueryKey(queryParams) } }
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Crew Directory</h1>
          <p className="text-muted-foreground mt-2 font-medium">Find the right talent for your next production.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or skills..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/50"
              data-testid="input-search-crew"
            />
          </div>
          <Select value={profession} onValueChange={setProfession}>
            <SelectTrigger className="w-full sm:w-[220px] bg-card border-border/50" data-testid="select-profession">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <SelectValue placeholder="All Professions" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Professions</SelectItem>
              {PROFESSIONS.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data?.users && data.users.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.users.map((user) => (
            <UserCard key={user.id} user={user} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No crew members found"
          description="We couldn't find anyone matching your search criteria. Try broadening your filters."
        />
      )}
    </div>
  );
}