import { useParams, Link } from "wouter";
import { useGetConversation, getGetConversationQueryKey, useSendMessage } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Loader2, Send, ArrowLeft, Paperclip, X, FileText, Download } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { useAuth } from "@/lib/useAuth";
import { queryClient } from "@/lib/queryClient";

function formatBytes(bytes?: number | null) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function MessageAttachment({ msg }: { msg: any }) {
  if (!msg.attachmentUrl) return null;
  const isImage = (msg.attachmentType ?? "").startsWith("image/");

  if (isImage) {
    return (
      <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="block mt-1">
        <img
          src={msg.attachmentUrl}
          alt={msg.attachmentName ?? "attachment"}
          className="max-w-[240px] max-h-[240px] rounded-xl object-cover border border-border/40"
        />
      </a>
    );
  }

  return (
    <a
      href={msg.attachmentUrl}
      target="_blank"
      rel="noreferrer"
      download={msg.attachmentName ?? undefined}
      className="mt-1 flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 px-3 py-2 hover:bg-background/70 transition-colors max-w-[260px]"
    >
      <FileText className="w-6 h-6 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{msg.attachmentName ?? "File"}</p>
        {msg.attachmentSize ? (
          <p className="text-[11px] text-muted-foreground">{formatBytes(msg.attachmentSize)}</p>
        ) : null}
      </div>
      <Download className="w-4 h-4 shrink-0 text-muted-foreground" />
    </a>
  );
}

export function MessageThread() {
  const params = useParams();
  const userId = Number(params.userId);
  const { user: currentUser } = useAuth();
  const [message, setMessage] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { uploadFile, isUploading } = useUpload({ uploadPath: "/uploads/request-file-url" });

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
        setPendingFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !pendingFile) return;
    if (sendMutation.isPending || isUploading) return;

    let attachment: {
      attachmentUrl: string;
      attachmentName: string;
      attachmentType: string;
      attachmentSize: number;
    } | undefined;

    if (pendingFile) {
      const result = await uploadFile(pendingFile);
      if (!result) return;
      attachment = {
        attachmentUrl: `/api/storage${result.objectPath}`,
        attachmentName: pendingFile.name,
        attachmentType: pendingFile.type || "application/octet-stream",
        attachmentSize: pendingFile.size,
      };
    }

    sendMutation.mutate({ userId, data: { body: message, ...attachment } });
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
  };

  const busy = sendMutation.isPending || isUploading;

  const messages = conversation?.messages || [];

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
          <p className="font-bold text-white leading-tight">Conversation</p>
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
                    {msg.body ? (
                      <p className="leading-relaxed whitespace-pre-wrap text-sm font-medium">{msg.body}</p>
                    ) : null}
                    <MessageAttachment msg={msg} />
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
          {pendingFile && (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-2">
              <FileText className="w-5 h-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{pendingFile.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatBytes(pendingFile.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  setPendingFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFilePick}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-xl shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              aria-label="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Input 
              placeholder="Write a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-input border-border/50 text-white h-12 rounded-xl focus-visible:ring-1 focus-visible:ring-primary"
            />
            <Button type="submit" size="icon" className="h-12 w-12 rounded-xl shrink-0" disabled={(!message.trim() && !pendingFile) || busy}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}