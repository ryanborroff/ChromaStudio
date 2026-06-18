import { useState } from "react";
import {
  useAdminListUsers, getAdminListUsersQueryKey,
  useAdminDeleteUser,
  useListVideos, getListVideosQueryKey,
  useAdminToggleFeatured,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/useAuth";
import { useLocation } from "wouter";
import { Loader2, Search, Trash2, Star, StarOff, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { queryClient } from "@/lib/queryClient";

export function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [userSearch, setUserSearch] = useState("");
  const debouncedSearch = useDebounce(userSearch, 400);

  const adminUsersParams = { search: debouncedSearch || undefined, limit: 50 };
  const { data: usersData, isLoading: usersLoading } = useAdminListUsers(
    adminUsersParams,
    { query: { enabled: !!user?.isAdmin, queryKey: getAdminListUsersQueryKey(adminUsersParams) } }
  );

  const videosParams = { sort: "newest" as const, limit: 50 };
  const { data: videosData, isLoading: videosLoading } = useListVideos(
    videosParams,
    { query: { enabled: !!user?.isAdmin, queryKey: getListVideosQueryKey(videosParams) } }
  );

  const deleteUserMutation = useAdminDeleteUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "User deleted" });
        queryClient.invalidateQueries();
      },
      onError: () => toast({ title: "Failed to delete user", variant: "destructive" }),
    },
  });

  const toggleFeaturedMutation = useAdminToggleFeatured({
    mutation: {
      onSuccess: () => {
        toast({ title: "Featured status updated" });
        queryClient.invalidateQueries();
      },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    },
  });

  if (!user?.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-xl text-center">
        <ShieldCheck className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-white mb-2">Admin access required</h1>
        <p className="text-white/40">You don't have permission to access this area.</p>
        <Button className="mt-6" onClick={() => setLocation("/feed")}>Back to feed</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="w-7 h-7 text-primary" />
        <h1 className="text-3xl font-black text-white tracking-tight">Admin Dashboard</h1>
      </div>

      {usersData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total Members", value: usersData.total },
            { label: "Total Videos", value: videosData?.total ?? "—" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border/50 rounded-xl p-5">
              <div className="text-3xl font-black text-white">{s.value}</div>
              <div className="text-xs text-white/40 uppercase tracking-wider mt-1 font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full justify-start bg-transparent border-b border-border/40 rounded-none h-auto p-0 mb-8 gap-8">
          {["users", "videos"].map(tab => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 py-3 text-base font-bold capitalize"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="users">
          <div className="mb-4 relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Search members..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="pl-9 bg-card border-border/50"
            />
          </div>

          {usersLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-5 py-3 text-white/40 font-semibold uppercase tracking-wider text-xs">Member</th>
                    <th className="text-left px-5 py-3 text-white/40 font-semibold uppercase tracking-wider text-xs hidden sm:table-cell">Profession</th>
                    <th className="text-left px-5 py-3 text-white/40 font-semibold uppercase tracking-wider text-xs hidden md:table-cell">Plan</th>
                    <th className="text-left px-5 py-3 text-white/40 font-semibold uppercase tracking-wider text-xs hidden lg:table-cell">Joined</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {usersData?.users.map(u => (
                    <tr key={u.id} className="border-b border-border/30 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={u.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs bg-secondary">{u.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-white font-medium">{u.name}</p>
                            <p className="text-white/40 text-xs">@{u.username}</p>
                          </div>
                          {u.isAdmin && <Badge variant="secondary" className="text-xs">Admin</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-white/60 hidden sm:table-cell">{u.profession}</td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <Badge variant={u.plan === "free" ? "outline" : "secondary"} className="text-xs capitalize">{u.plan}</Badge>
                      </td>
                      <td className="px-5 py-3 text-white/40 text-xs hidden lg:table-cell">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {u.id !== user.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            disabled={deleteUserMutation.isPending}
                            onClick={() => {
                              if (confirm(`Delete ${u.name}? This cannot be undone.`)) {
                                deleteUserMutation.mutate({ userId: u.id });
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="videos">
          {videosLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-5 py-3 text-white/40 font-semibold uppercase tracking-wider text-xs">Video</th>
                    <th className="text-left px-5 py-3 text-white/40 font-semibold uppercase tracking-wider text-xs hidden sm:table-cell">Author</th>
                    <th className="text-left px-5 py-3 text-white/40 font-semibold uppercase tracking-wider text-xs hidden md:table-cell">Views</th>
                    <th className="text-left px-5 py-3 text-white/40 font-semibold uppercase tracking-wider text-xs hidden lg:table-cell">Privacy</th>
                    <th className="px-5 py-3 text-right text-white/40 font-semibold uppercase tracking-wider text-xs">Featured</th>
                  </tr>
                </thead>
                <tbody>
                  {videosData?.videos.map(v => (
                    <tr key={v.id} className="border-b border-border/30 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {v.thumbnailUrl ? (
                            <img src={v.thumbnailUrl} alt="" className="w-12 h-8 object-cover rounded" />
                          ) : (
                            <div className="w-12 h-8 bg-secondary rounded" />
                          )}
                          <p className="text-white font-medium line-clamp-1 max-w-[180px]">{v.title}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-white/60 hidden sm:table-cell">{v.user?.name}</td>
                      <td className="px-5 py-3 text-white/60 hidden md:table-cell">{v.viewCount.toLocaleString()}</td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <Badge variant="outline" className="text-xs capitalize">{v.privacy}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={v.isFeatured ? "text-yellow-400 hover:text-yellow-300" : "text-white/30 hover:text-white"}
                          disabled={toggleFeaturedMutation.isPending}
                          onClick={() => toggleFeaturedMutation.mutate({ videoId: v.id, data: { featured: !v.isFeatured } })}
                        >
                          {v.isFeatured ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
