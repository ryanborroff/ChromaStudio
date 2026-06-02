import { useListConversations, getListConversationsQueryKey } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

export function Messages() {
  const { data, isLoading } = useListConversations({
    query: { queryKey: getListConversationsQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight">Messages</h1>
      </div>

      {data?.conversations && data.conversations.length > 0 ? (
        <div className="flex flex-col gap-2">
          {data.conversations.map((conv) => (
            <Link key={conv.userId} href={`/messages/${conv.userId}`} className="block group">
              <div className="p-4 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-colors flex items-center gap-4">
                <Avatar className="h-12 w-12 border border-border/50">
                  <AvatarImage src={conv.user.avatarUrl || undefined} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                    {conv.user.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-white truncate group-hover:text-primary transition-colors">{conv.user.name}</h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-white font-medium' : 'text-muted-foreground'}`}>
                    {conv.lastMessage}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                    {conv.unreadCount}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No messages yet"
          description="When you connect with other filmmakers, your conversations will appear here."
        />
      )}
    </div>
  );
}