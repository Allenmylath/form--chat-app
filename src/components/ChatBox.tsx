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
    appendToContext,
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
  }, [isConnected, isBotReady, registerFunctionCallHandler, clearMessages, setLogLevel]);

  const handleSendMessage = async () => {
    if (!input.trim() || !isConnected || !isBotReady || isBotSpeaking) return;

    const messageContent = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      // Send the message to the bot context
      await appendToContext({
        role: 'user',
        content: messageContent,
        run_immediately: true
      });

      toast.success('Message sent');
    } catch (err: any) {
      console.error('Failed to send message:', err);
      toast.error(err.message || 'Failed to send message');
      
      // Restore the input if sending failed
      setInput(messageContent);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMic = () => {
    if (!isConnected) {
      toast.error('Please connect to bot first');
      return;
    }
    
    try {
      enableMic(!isMicEnabled);
      toast.info(isMicEnabled ? 'Microphone disabled' : 'Microphone enabled');
    } catch (err: any) {
      toast.error('Failed to toggle microphone');
    }
  };

  const handleClearMessages = () => {
    try {
      clearMessages();
      toast.success('Chat cleared');
    } catch (err: any) {
      toast.error('Failed to clear messages');
    }
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

  const getMessageTypeLabel = (type: BotMessage['type']) => {
    switch (type) {
      case 'bot': return 'Assistant';
      case 'user': return 'You';
      case 'system': return 'System';
      default: return 'Message';
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
            {/* Mic Toggle */}
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
              {isBotSpeaking && (
                <Badge variant="secondary" className="text-blue-600 animate-pulse">
                  🗣️ Bot Speaking
                </Badge>
              )}
              {isUserSpeaking && (
                <Badge variant="secondary" className="text-green-600 animate-pulse">
                  🎤 Listening
                </Badge>
              )}
              {isConnected && isBotReady && (
                <Badge variant="default" className="text-green-600">
                  ✅ Ready
                </Badge>
              )}
              {isConnected && !isBotReady && (
                <Badge variant="outline" className="text-amber-600">
                  ⏳ Connecting
                </Badge>
              )}
              {!isConnected && (
                <Badge variant="outline" className="text-muted-foreground">
                  ⚡ Disconnected
                </Badge>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
            <div className="font-medium">Error:</div>
            <div className="mt-1">{error}</div>
          </div>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 p-4 min-h-0 flex flex-col">
        {/* Messages */}
        <ScrollArea className="flex-1 mb-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {isConnected ? (
                  isBotReady ? (
                    <>
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-base font-medium">Start a conversation</p>
                      <p className="text-sm mt-2">
                        You can speak directly using the microphone or type messages below
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p>Assistant is connecting...</p>
                    </>
                  )
                ) : (
                  <>
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-base font-medium">Connect to start chatting</p>
                    <p className="text-sm mt-2">
                      Use the Connect button to start your conversation
                    </p>
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
                  {message.type !== 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                      {getMessageIcon(message.type)}
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-3 ${
                      message.type === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : message.type === 'system'
                        ? 'bg-muted/50 text-muted-foreground border border-muted-foreground/20'
                        : 'bg-muted border'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium opacity-80">
                        {getMessageTypeLabel(message.type)}
                      </span>
                      <span className="text-xs opacity-60">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                  </div>

                  {message.type === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm">
                      {getMessageIcon(message.type)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Input Area */}
        <Separator className="mb-4" />
        <div className="space-y-3">
          <div className="flex gap-2">
            <Textarea
              placeholder={
                !isConnected
                  ? "Connect to start typing..." 
                  : !isBotReady
                  ? "Waiting for assistant to be ready..."
                  : isBotSpeaking 
                  ? "Bot is speaking... please wait" 
                  : "Type your message here..."
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
              className={`flex-1 min-h-[80px] resize-none ${
                isTextareaDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
            
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isTextareaDisabled || isLoading}
              size="sm"
              className="gap-2 h-fit self-end"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <CornerDownLeft className="w-4 h-4" />
              )}
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          </div>

          <div className="flex justify-between items-center text-xs">
            <div className="text-muted-foreground">
              {!isConnected ? (
                <span className="text-blue-600 font-medium">🔌 Connect to enable messaging</span>
              ) : !isBotReady ? (
                <span className="text-amber-600 font-medium">⏳ Waiting for assistant...</span>
              ) : isBotSpeaking ? (
                <span className="text-amber-600 font-medium">⚠️ Please wait for assistant to finish</span>
              ) : isUserSpeaking ? (
                <span className="text-green-600 font-medium">🎤 Voice input detected</span>
              ) : (
                <span>💬 Press Enter to send • Shift + Enter for new line</span>
              )}
            </div>

            <Button
              onClick={handleClearMessages}
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
