import { useParams, Link } from "wouter";
import { useGetConversation, getGetConversationQueryKey, useSendMessage } from "@workspace/api-client-react";
import { Loader2, Send, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { useAuth } from "@/lib/useAuth";
import { queryClient } from "@/lib/queryClient";

export function MessageThread() {
  const params = useParams();
  const userId = Number(params.userId);
  const { user: currentUser } = useAuth();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversation, isLoading } = useGetConversation(userId, {
    query: {
      enabled: !isNaN(userId),
      queryKey: getGetConversationQueryKey(userId),
      refetchInterval: 5000 // Poll for new messages
    }
  });

  const sendMutation = useSendMessage({
    mutation: {
      onSuccess: () => {
        setMessage("");
        queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(userId) });
      }
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  if (isLoading && !conversation) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMutation.mutate({ data: { recipientId: userId, body: message } });
  };

  const otherUser = conversation?.user;
  const messages = conversation?.messages || []; // Assuming the API returns full messages list here

  return (
    <div className="container mx-auto max-w-4xl h-[calc(100vh-4rem)] flex flex-col py-4 px-4 sm:px-6">
      <div className="flex-1 bg-card border border-border/50 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="h-16 border-b border-border/40 flex items-center px-4 shrink-0 bg-background/50">
          <Button variant="ghost" size="icon" asChild className="mr-2">
            <Link href="/messages">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          {otherUser && (
            <Link href={`/profile/${otherUser.username}`} className="flex items-center gap-3 group">
              <Avatar className="h-10 w-10 border border-border/50">
                <AvatarImage src={otherUser.avatarUrl || undefined} />
                <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
                  {otherUser.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-white group-hover:text-primary transition-colors leading-tight">{otherUser.name}</p>
                <p className="text-xs text-primary font-medium">{otherUser.profession}</p>
              </div>
            </Link>
          )}
        </div>

        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length > 0 ? (
            messages.map((msg: any) => {
              // Note: using string comparison if IDs are different types, but assuming numbers here
              const isMine = msg.senderId === currentUser?.id;
              
              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                      isMine 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                        : 'bg-secondary text-secondary-foreground rounded-tl-sm'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap text-sm font-medium">{msg.body}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium mt-1 mx-1">
                    {format(new Date(msg.createdAt), "h:mm a")}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <p className="font-medium">No messages yet</p>
              <p className="text-sm">Start the conversation</p>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border/40 bg-background/50">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input 
              placeholder="Write a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-input border-border/50 text-white h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary"
            />
            <Button type="submit" size="icon" className="h-12 w-12 rounded-xl shrink-0" disabled={!message.trim() || sendMutation.isPending}>
              {sendMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}