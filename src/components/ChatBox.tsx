"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
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
  MicOff,
  Terminal,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { RTVIEvent } from "@pipecat-ai/client-js";

interface ChatBoxProps {
  pipecatClient: any;
  className?: string;
}

interface BotMessage {
  id: string;
  type: 'bot' | 'user' | 'system';
  content: string;
  timestamp: Date;
  source?: 'typed' | 'spoken';
  isFinal?: boolean;
}

interface ServerMessage {
  id: string;
  timestamp: Date;
  type: string;
  event?: string;
  data: any;
  raw: any;
}

export default function ChatBox({ pipecatClient, className = "" }: ChatBoxProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [serverMessages, setServerMessages] = useState<ServerMessage[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  // Track active interim transcripts by user_id
  const [activeTranscripts, setActiveTranscripts] = useState<Map<string, string>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isBotReady,
    isBotSpeaking,
    isUserSpeaking,
    error,
    appendToContext,
    
    // Device methods and state
    enableMic,
    isMicEnabled,
    
    // Advanced methods
    registerFunctionCallHandler,
    setLogLevel,
  } = pipecatClient;

  // Enhanced server message logger - ONLY for ServerMessage events
  const logServerMessage = useCallback((message: any, eventType: string) => {
    // Only log if it's a ServerMessage event
    if (eventType !== 'ServerMessage') return;

    const serverMessage: ServerMessage = {
      id: `server-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      type: 'SERVER_MESSAGE',
      event: message?.type || message?.event || 'server_message',
      data: message,
      raw: message
    };

    setServerMessages(prev => [...prev, serverMessage]);

    // Enhanced console logging with structured format
    const logStyle = {
      timestamp: new Date().toISOString(),
      context: 'RTVI_SERVER_MESSAGE',
      event: message?.type || message?.event || 'server_message',
      message: message
    };

    console.group(`🌐 ${logStyle.context} - ${logStyle.event}`);
    console.log(`⏰ Timestamp: ${logStyle.timestamp}`);
    console.log(`📝 Event Type: ${logStyle.event}`);
    console.log(`📦 Full Message:`, message);
    
    // Log specific important fields if they exist
    if (message?.text) {
      console.log(`💬 Text Content: "${message.text}"`);
    }
    if (message?.final !== undefined) {
      console.log(`✅ Is Final: ${message.final}`);
    }
    if (message?.user_id) {
      console.log(`👤 User ID: ${message.user_id}`);
    }
    if (message?.participant) {
      console.log(`👥 Participant:`, message.participant);
    }
    if (message?.data) {
      console.log(`📊 Data:`, message.data);
    }
    if (message?.error) {
      console.error(`❌ Error:`, message.error);
    }
    
    console.groupEnd();
  }, []);

  // Clear messages function
  const clearMessages = useCallback(() => {
    setMessages([]);
    setActiveTranscripts(new Map());
  }, []);

  // Clear server console
  const clearServerMessages = useCallback(() => {
    setServerMessages([]);
    console.clear();
    console.log('🧹 Server message console cleared');
  }, []);

  // FIXED: Comprehensive event monitoring using the correct approach
  useEffect(() => {
    const actualClient = pipecatClient.client;
    
    if (!actualClient || typeof actualClient.on !== 'function') {
      console.warn("❌ PipecatClient not available or doesn't have .on() method");
      return;
    }

    console.log("🔌 Setting up ServerMessage event listener only...");

    // ONLY monitor ServerMessage events
    const handleServerMessage = (data: any) => {
      logServerMessage(data, "ServerMessage");
      console.log("📨 RTVI ServerMessage event received:", data);
    };

    // Register only the ServerMessage event listener
    actualClient.on(RTVIEvent.ServerMessage, handleServerMessage);

    // Still need other essential events for chat functionality
    const handleUserTranscript = (data: any) => {
      const transcriptText = data?.text || "";
      const isFinal = data?.final ?? false;
      const userId = data?.user_id || "default";
      const timestamp = data?.timestamp || Date.now();
      
      if (transcriptText && transcriptText.trim()) {
        if (isFinal) {
          console.log("✅ Adding final user transcript:", transcriptText);
          
          // Remove from active transcripts
          setActiveTranscripts(prev => {
            const newMap = new Map(prev);
            newMap.delete(userId);
            return newMap;
          });
          
          // Add final message to main chat
          const finalMessage: BotMessage = {
            id: `user-final-${userId}-${timestamp}`,
            type: 'user',
            content: transcriptText.trim(),
            timestamp: new Date(timestamp),
            source: 'spoken',
            isFinal: true
          };
          setMessages(prev => [...prev, finalMessage]);
          
        } else {
          console.log("⏳ Updating interim user transcript:", transcriptText);
          
          // Update active interim transcript
          setActiveTranscripts(prev => {
            const newMap = new Map(prev);
            newMap.set(userId, transcriptText.trim());
            return newMap;
          });
        }
      }
    };

    const handleBotTranscript = (data: any) => {
      const transcriptText = data?.text || "";
      
      // Only add if there's actual text content
      if (transcriptText && transcriptText.trim()) {
        console.log("✅ Adding bot transcript:", transcriptText);
        const message: BotMessage = {
          id: `bot-transcript-${Date.now()}-${Math.random()}`,
          type: 'bot',
          content: transcriptText.trim(),
          timestamp: new Date(),
          source: 'spoken'
        };
        
        setMessages(prev => [...prev, message]);
      }
    };

    // Keep essential chat functionality events (but don't log them to console)
    actualClient.on(RTVIEvent.UserTranscript, handleUserTranscript);
    actualClient.on(RTVIEvent.BotTranscript, handleBotTranscript);

    console.log(`✅ Monitoring ONLY RTVIEvent.ServerMessage events in console`);

    // Cleanup event listeners
    return () => {
      console.log("🧹 Cleaning up ServerMessage event listener...");
      if (typeof actualClient.off === 'function') {
        actualClient.off(RTVIEvent.ServerMessage, handleServerMessage);
        actualClient.off(RTVIEvent.UserTranscript, handleUserTranscript);
        actualClient.off(RTVIEvent.BotTranscript, handleBotTranscript);
      }
    };
  }, [pipecatClient.client, logServerMessage]);

  // Auto-scroll to bottom with better reliability
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        // Use instant scroll for immediate feedback
        messagesEndRef.current.scrollIntoView({ 
          behavior: 'instant',
          block: 'end',
          inline: 'nearest'
        });
      }
    };

    // Immediate scroll without delay for better UX
    scrollToBottom();
  }, [messages, activeTranscripts]);

  // Scroll console when server messages change
  useEffect(() => {
    if (showConsole && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ 
        behavior: 'instant',
        block: 'end',
        inline: 'nearest'
      });
    }
  }, [serverMessages, showConsole]);

  // Register function handlers when connected
  useEffect(() => {
    if (isConnected && isBotReady) {
      // Register example function call handlers
      registerFunctionCallHandler('clear_chat', async (params:any) => {
        console.log('Function call: clear_chat', params);
        logServerMessage({ type: 'function_call', name: 'clear_chat', params }, 'FUNCTION_CALL');
        clearMessages();
        toast.success('Chat cleared');
        return { success: true };
      });

      // Set log level for debugging
      setLogLevel(3); // INFO level
      console.log("🔧 Function handlers registered and log level set");
    }
  }, [isConnected, isBotReady, registerFunctionCallHandler, clearMessages, setLogLevel, logServerMessage]);

  // Fire-and-forget message sending without loading state
  const handleSendMessage = async () => {
    if (!input.trim() || !isConnected || !isBotReady) return;

    const messageContent = input.trim();
    setInput(''); // Clear input immediately

    // Add user typed message immediately to UI
    const userMessage: BotMessage = {
      id: `user-typed-${Date.now()}`,
      type: 'user',
      content: messageContent,
      timestamp: new Date(),
      source: 'typed'
    };
    setMessages(prev => [...prev, userMessage]);

    // Log the outgoing message
    logServerMessage({
      type: 'outgoing_user_message',
      content: messageContent,
      source: 'typed',
      timestamp: new Date().toISOString()
    }, 'OUTGOING_MESSAGE');

    try {
      // Fire-and-forget: Don't await, no loading state
      appendToContext({
        role: 'user',
        content: messageContent,
        run_immediately: true
      }).catch((err: any) => {
        // Only handle actual errors (network failures, etc.)
        console.error('Failed to send message:', err);
        logServerMessage({ error: err, context: 'send_message_failed' }, 'ERROR');
        toast.error('Failed to send message to bot');
        
        // Optionally show error message in chat
        const errorMessage: BotMessage = {
          id: `error-${Date.now()}`,
          type: 'system',
          content: 'Failed to send message. Please try again.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      });

      console.log('📤 Message sent to bot:', messageContent);
      
    } catch (err: any) {
      console.error('Unexpected error sending message:', err);
      logServerMessage({ error: err, context: 'unexpected_send_error' }, 'ERROR');
      toast.error('Unexpected error occurred');
    }
  };

  const toggleMic = () => {
    if (!isConnected) {
      toast.error('Please connect to bot first');
      return;
    }
    
    try {
      enableMic(!isMicEnabled);
      logServerMessage({
        type: 'mic_toggle',
        enabled: !isMicEnabled,
        timestamp: new Date().toISOString()
      }, 'USER_ACTION');
      toast.info(isMicEnabled ? 'Microphone disabled' : 'Microphone enabled');
    } catch (err: any) {
      logServerMessage({ error: err, context: 'mic_toggle_failed' }, 'ERROR');
      toast.error('Failed to toggle microphone');
    }
  };

  const handleClearMessages = () => {
    try {
      clearMessages();
      logServerMessage({
        type: 'chat_cleared',
        timestamp: new Date().toISOString()
      }, 'USER_ACTION');
      toast.success('Chat cleared');
    } catch (err: any) {
      toast.error('Failed to clear messages');
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getMessageIcon = (type: BotMessage['type'], source?: string) => {
    switch (type) {
      case 'bot': return '🤖';
      case 'user': return source === 'spoken' ? '🎤' : '👤';
      case 'system': return '⚙️';
      default: return '💬';
    }
  };

  const getMessageTypeLabel = (type: BotMessage['type'], source?: string) => {
    switch (type) {
      case 'bot': return 'Assistant';
      case 'user': return source === 'spoken' ? 'You (Spoken)' : 'You (Typed)';
      case 'system': return 'System';
      default: return 'Message';
    }
  };

  const getServerMessageTypeColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      'SERVER_MESSAGE': 'text-purple-600',
      'OUTGOING_MESSAGE': 'text-teal-600',
      'USER_ACTION': 'text-amber-600',
      'FUNCTION_CALL': 'text-indigo-600',
      'ERROR': 'text-red-600'
    };
    
    return colorMap[type] || 'text-gray-600';
  };

  // Simplified textarea disabled logic - no loading state blocking
  const isTextareaDisabled = !isConnected || !isBotReady;

  // Convert active transcripts to display format
  const activeTranscriptEntries = Array.from(activeTranscripts.entries());

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Main Chat Card */}
      <Card className="flex flex-col h-full">
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Voice Chat Assistant
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {/* Console Toggle */}
              <Button
                variant={showConsole ? "default" : "outline"}
                size="sm"
                onClick={() => setShowConsole(!showConsole)}
                className="gap-2"
              >
                {showConsole ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Console
              </Button>

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
          {/* Messages - Fixed height with scroll */}
          <div className="flex-1 mb-4 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4">
                {messages.length === 0 && activeTranscriptEntries.length === 0 ? (
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
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.type === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.type !== 'user' && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
                            {getMessageIcon(message.type, message.source)}
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
                              {getMessageTypeLabel(message.type, message.source)}
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
                            {getMessageIcon(message.type, message.source)}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Active Interim Transcripts */}
                    {activeTranscriptEntries.map(([userId, text]) => (
                      <div key={`interim-${userId}`} className="flex gap-3 justify-end">
                        <div className="max-w-[75%] rounded-lg px-4 py-3 bg-primary/70 text-primary-foreground border-2 border-primary/30 border-dashed">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium opacity-80">
                              You (Speaking...)
                            </span>
                            <div className="flex gap-1">
                              <div className="w-1 h-1 bg-primary-foreground/60 rounded-full animate-pulse"></div>
                              <div className="w-1 h-1 bg-primary-foreground/60 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                              <div className="w-1 h-1 bg-primary-foreground/60 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed italic">
                            {text}
                          </p>
                        </div>
                        
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/70 border-2 border-primary/30 border-dashed flex items-center justify-center text-primary-foreground text-sm">
                          🎤
                        </div>
                      </div>
                    ))}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Input Area */}
          <Separator className="mb-4" />
          <div className="space-y-3 flex-shrink-0">
            <div className="flex gap-2">
              <Textarea
                placeholder={
                  !isConnected
                    ? "Connect to start typing..." 
                    : !isBotReady
                    ? "Waiting for assistant to be ready..."
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
                className={`flex-1 min-h-[80px] max-h-[120px] resize-none ${
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
                Send
              </Button>
            </div>

            <div className="flex justify-between items-center text-xs">
              <div className="text-muted-foreground">
                {!isConnected ? (
                  <span className="text-blue-600 font-medium">🔌 Connect to enable messaging</span>
                ) : !isBotReady ? (
                  <span className="text-amber-600 font-medium">⏳ Waiting for assistant...</span>
                ) : isUserSpeaking ? (
                  <span className="text-green-600 font-medium">🎤 Voice input detected</span>
                ) : activeTranscriptEntries.length > 0 ? (
                  <span className="text-green-600 font-medium">💬 Processing speech...</span>
                ) : (
                  <span>💬 Press Enter to send • Shift + Enter for new line</span>
                )}
              </div>

              <Button
                onClick={handleClearMessages}
                disabled={messages.length === 0 && activeTranscriptEntries.length === 0}
                variant="outline"
                size="sm"
              >
                Clear Chat
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server Console Card */}
      {showConsole && (
        <Card className="h-[400px] flex flex-col mt-4">
          <CardHeader className="flex-shrink-0 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                RTVI ServerMessage Events Only
                <Badge variant="outline" className="ml-2">
                  {serverMessages.length} events
                </Badge>
              </CardTitle>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={clearServerMessages}
                  disabled={serverMessages.length === 0}
                  variant="outline"
                  size="sm"
                >
                  Clear Console
                </Button>
                
                <Button
                  onClick={() => setShowConsole(false)}
                  variant="outline"
                  size="sm"
                >
                  <EyeOff className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <Separator />
          
          <CardContent className="flex-1 p-4 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-4">
                {serverMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-base font-medium">No ServerMessage events yet</p>
                    <p className="text-sm mt-2">
                      Only RTVIEvent.ServerMessage events will appear here
                    </p>
                  </div>
                ) : (
                  <>
                    {serverMessages.map((serverMessage) => (
                      <div
                        key={serverMessage.id}
                        className="border rounded-lg p-3 bg-muted/30 font-mono text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className="text-xs text-purple-600"
                            >
                              SERVER_MESSAGE
                            </Badge>
                            {serverMessage.event && (
                              <Badge variant="secondary" className="text-xs">
                                {serverMessage.event}
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground">
                            {formatTimestamp(serverMessage.timestamp)}
                          </span>
                        </div>
                        
                        <div className="bg-black/10 rounded p-2 overflow-x-auto">
                          <pre className="text-xs whitespace-pre-wrap">
                            {JSON.stringify(serverMessage.raw, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                <div ref={consoleEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}