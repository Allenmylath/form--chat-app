"use client";

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CornerDownLeft, 
  MessageSquare, 
  Mic, 
  MicOff
} from 'lucide-react';
import { toast } from 'sonner';

interface ChatBoxProps {
  pipecatClient: any;
  className?: string;
}

interface BotMessage {
  id: string;
  type: 'bot' | 'user' | 'system';
  content: string;
  timestamp: Date;
}

export default function ChatBox({ pipecatClient, className = "" }: ChatBoxProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isBotReady,
    isBotSpeaking,
    isUserSpeaking,
    messages,
    error,
    sendMessage,
    clearMessages,
    
    // Device methods and state
    enableMic,
    isMicEnabled,
    
    // Advanced methods
    registerFunctionCallHandler,
    setLogLevel,
  } = pipecatClient;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Register function handlers when connected
  useEffect(() => {
    if (isConnected && isBotReady) {
      // Register example function call handlers
      registerFunctionCallHandler('clear_chat', async (params) => {
        console.log('Function call: clear_chat', params);
        clearMessages();
        toast.success('Chat cleared');
        return { success: true };
      });

      // Set log level for debugging
      setLogLevel(3); // INFO level
    }
  }, [isConnected, isBotReady]);

  const handleSendMessage = async () => {
    if (!input.trim() || !isConnected || isBotSpeaking) return;

    const message = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      sendMessage('user_message', { content: message });
      toast.success('Message sent');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMic = () => {
    if (!isConnected) {
      toast.error('Please connect to bot first');
      return;
    }
    enableMic(!isMicEnabled);
    toast.info(isMicEnabled ? 'Microphone disabled' : 'Microphone enabled');
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageIcon = (type: BotMessage['type']) => {
    switch (type) {
      case 'bot': return '🤖';
      case 'user': return '👤';
      case 'system': return '⚙️';
      default: return '💬';
    }
  };

  // Check if textarea should be disabled
  const isTextareaDisabled = !isConnected || !isBotReady || isLoading || isBotSpeaking;

  return (
    <Card className={`flex flex-col h-full ${className}`}>
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Voice Chat Assistant
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Mic Toggle - Always visible now */}
            <Button
              variant={isMicEnabled ? "default" : "outline"}
              size="sm"
              onClick={toggleMic}
              disabled={!isConnected || !isBotReady}
              className="gap-2"
            >
              {isMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              {isMicEnabled ? 'Mic On' : 'Mic Off'}
            </Button>

            {/* Status Indicators */}
            <div className="flex items-center gap-1">
              {isBotSpeaking && <Badge variant="secondary" className="text-blue-600">🗣️ Bot Speaking</Badge>}
              {isUserSpeaking && <Badge variant="secondary" className="text-green-600">🎤 You Speaking</Badge>}
              {!isConnected && <Badge variant="outline" className="text-muted-foreground">⚡ Ready to Connect</Badge>}
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            Error: {error}
          </div>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 p-4 min-h-0 flex flex-col">
        {/* Messages */}
        <ScrollArea className="flex-1 mb-4">
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {isConnected ? (
                  isBotReady ? (
                    <>
                      <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Start a conversation with your voice assistant</p>
                      <p className="text-xs mt-1">You can speak directly or type messages below</p>
                    </>
                  ) : (
                    <p>Waiting for assistant to be ready...</p>
                  )
                ) : (
                  <>
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Connect to start chatting with your assistant</p>
                    <p className="text-xs mt-1">Use the Connect button in the top-right corner</p>
                  </>
                )}
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      message.type === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : message.type === 'system'
                        ? 'bg-muted text-muted-foreground text-xs'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>{getMessageIcon(message.type)}</span>
                      <span className="text-xs opacity-70">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Input Area - Always visible now */}
        <Separator className="mb-4" />
        <div className="space-y-3">
          <div className="flex gap-2">
            <Textarea
              placeholder={
                !isConnected
                  ? "Connect to bot to start typing..." 
                  : isBotSpeaking 
                  ? "Bot is speaking... please wait" 
                  : isBotReady 
                  ? "Type your message here..." 
                  : "Waiting for assistant..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isTextareaDisabled}
              className={`flex-1 min-h-[100px] resize-none ${
                isTextareaDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
            
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isTextareaDisabled}
              size="sm"
              className="gap-2 h-fit self-end"
            >
              <CornerDownLeft className="w-4 h-4" />
              Enter
            </Button>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              {!isConnected ? (
                <span className="text-blue-600">🔌 Connect to bot to enable all features</span>
              ) : isBotSpeaking ? (
                <span className="text-amber-600">⚠️ Typing disabled while bot is speaking</span>
              ) : (
                <span>💬 Press Enter to send • Shift + Enter for new line</span>
              )}
            </div>

            <Button
              onClick={clearMessages}
              disabled={messages.length === 0}
              variant="outline"
              size="sm"
            >
              Clear Chat
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}