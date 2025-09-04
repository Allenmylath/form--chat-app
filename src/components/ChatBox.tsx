"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Mic } from "lucide-react";
import { toast } from "sonner";

interface ChatBoxProps {
  pipecatClient: {
    client: any;
    isConnected: boolean;
    isConnecting: boolean;
    isBotReady: boolean;
    isBotSpeaking: boolean;
    isUserSpeaking: boolean;
    messages: Array<{
      id: string;
      type: 'user' | 'bot' | 'system';
      content: string;
      timestamp: Date;
    }>;
    error: string | null;
    sendMessage: (msgType: string, data: any) => void;
    sendRequest: (msgType: string, data: any) => Promise<any>;
    clearMessages: () => void;
  };
}

export default function ChatBox({ pipecatClient }: ChatBoxProps) {
  const [inputValue, setInputValue] = useState("");
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const {
    client,
    isConnected,
    isBotReady,
    isBotSpeaking,
    isUserSpeaking,
    messages,
    sendMessage,
    sendRequest,
    clearMessages,
  } = pipecatClient;

  // Auto-scroll to bottom for new messages if user is near bottom
  useEffect(() => {
    if (messages.length > 0 && isNearBottomRef.current) {
      scrollToBottom();
    }
  }, [messages]);

  // Handle scroll position detection
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      isNearBottomRef.current = isNearBottom;
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: smooth ? "smooth" : "instant",
      block: "end"
    });
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    if (!client || !isConnected) {
      toast.error("Not connected to voice assistant");
      return;
    }

    try {
      // Send a custom message to the bot
      sendMessage('user-message', { text: inputValue.trim() });
      setInputValue("");
      toast.success("Message sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    }
  };

  const handleSendRequest = async () => {
    if (!inputValue.trim()) return;
    if (!client || !isConnected) {
      toast.error("Not connected to voice assistant");
      return;
    }

    try {
      // Send a request and wait for response
      const response = await sendRequest('user-query', { query: inputValue.trim() });
      console.log('Response received:', response);
      setInputValue("");
      toast.success("Request sent and response received");
    } catch (err: any) {
      toast.error(err.message || "Failed to send request");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { [key: string]: typeof messages }, message) => {
    const dateKey = message.timestamp.toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {});

  const getMessageAvatar = (type: string) => {
    switch (type) {
      case 'user': return 'U';
      case 'bot': return 'A';
      case 'system': return 'S';
      default: return '?';
    }
  };

  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'user':
        return "bg-primary text-primary-foreground";
      case 'bot':
        return "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100";
      case 'system':
        return "bg-muted text-muted-foreground border border-border";
      default:
        return "bg-muted text-foreground";
    }
  };

  return (
    <Card className="h-full flex flex-col bg-card">
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Chat Assistant
            {isUserSpeaking && <Mic className="w-4 h-4 text-green-600 animate-pulse" />}
            {isBotSpeaking && <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse" />}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        <div className="flex-1 relative">
          <ScrollArea ref={scrollAreaRef} className="h-full px-6">
            <div className="space-y-4 py-2">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No messages yet</p>
                  <p className="text-sm text-muted-foreground">
                    {isConnected && isBotReady ? "Start speaking or type a message" : "Connect to start chatting"}
                  </p>
                </div>
              ) : (
                Object.entries(groupedMessages).map(([dateKey, dayMessages]) => (
                  <div key={dateKey}>
                    <div className="flex justify-center py-2">
                      <Badge variant="secondary" className="text-xs">
                        {formatDate(new Date(dateKey))}
                      </Badge>
                    </div>
                    {dayMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex items-start gap-3 ${
                          message.type === 'user' ? "flex-row-reverse" : ""
                        }`}
                      >
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarFallback className="text-xs">
                            {getMessageAvatar(message.type)}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 ${getMessageStyle(message.type)}`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs mt-1 opacity-70">
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
              {isBotSpeaking && (
                <div className="flex items-start gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="text-xs">A</AvatarFallback>
                  </Avatar>
                  <div className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100 rounded-lg px-3 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-current/50 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-current/50 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="w-2 h-2 bg-current/50 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>
        
        <div className="flex-shrink-0 border-t bg-background p-4">
          <div className="flex gap-2 items-center mb-2">
            {isUserSpeaking && (
              <Badge variant="secondary" className="text-xs gap-1 animate-pulse">
                <Mic className="w-3 h-3" />
                Speaking...
              </Badge>
            )}
            {isBotSpeaking && (
              <Badge variant="secondary" className="text-xs gap-1 animate-pulse">
                <div className="w-3 h-3 bg-current rounded-full" />
                Assistant speaking...
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={clearMessages}
              className="ml-auto text-xs"
            >
              Clear Messages
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isConnected && isBotReady ? "Type your message or speak..." : "Connect to start chatting..."}
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={1}
              disabled={!isConnected || !isBotReady}
              aria-label="Message input"
            />
            <div className="flex flex-col gap-1">
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || !isConnected || !isBotReady}
                size="sm"
                className="px-3"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleSendRequest}
                disabled={!inputValue.trim() || !isConnected || !isBotReady}
                size="sm"
                variant="outline"
                className="px-3"
                aria-label="Send request"
              >
                Req
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            {isConnected && isBotReady 
              ? "Press Enter to send message, use Req button for requests. Voice input is active."
              : "Connect to voice assistant to start chatting..."
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}