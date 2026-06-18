import { useState } from "react";
import { useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { UserCard } from "@/components/user-card";
import { EmptyState } from "@/components/empty-state";
import { Loader2, Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available now" },
  { value: "soon", label: "Available soon" },
  { value: "unavailable", label: "Not available" },
];

export function Crew() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [profession, setProfession] = useState<string>("all");
  const [country, setCountry] = useState("");
  const debouncedCountry = useDebounce(country, 500);
  const [availability, setAvailability] = useState<string>("all");

  const hasFilters = profession !== "all" || country.trim() !== "" || availability !== "all" || search.trim() !== "";

  const queryParams = {
    search: debouncedSearch || undefined,
    profession: profession !== "all" ? profession : undefined,
    country: debouncedCountry || undefined,
  };

  const { data, isLoading } = useListUsers(
    queryParams,
    { query: { queryKey: getListUsersQueryKey(queryParams) } }
  );

  function clearFilters() {
    setSearch("");
    setProfession("all");
    setCountry("");
    setAvailability("all");
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Talent Directory</h1>
            <p className="text-muted-foreground mt-2 font-medium">Discover your next collaborator.</p>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-white/50 hover:text-white self-start md:self-auto gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Clear filters
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
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
            <SelectTrigger className="w-full sm:w-[200px] bg-card border-border/50" data-testid="select-profession">
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

          <Input
            placeholder="Country or city..."
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full sm:w-[180px] bg-card border-border/50"
            data-testid="input-country"
          />

          <Select value={availability} onValueChange={setAvailability}>
            <SelectTrigger className="w-full sm:w-[180px] bg-card border-border/50" data-testid="select-availability">
              <SelectValue placeholder="Availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any availability</SelectItem>
              {AVAILABILITY_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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
        <>
          <p className="text-white/30 text-sm mb-6">{data.total} member{data.total !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.users.map((user) => (
              <UserCard key={user.id} user={user} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="No crew members found"
          description="We couldn't find anyone matching your search criteria. Try broadening your filters."
        />
      )}
    </div>
  );
}
