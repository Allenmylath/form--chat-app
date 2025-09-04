"use client";

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Send, 
  MessageSquare, 
  EyeOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  MonitorOff,
  Settings,
  Volume2,
  Headphones
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
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  
  // Device lists
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [availableCams, setAvailableCams] = useState<MediaDeviceInfo[]>([]);
  const [availableSpeakers, setAvailableSpeakers] = useState<MediaDeviceInfo[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isBotReady,
    isBotSpeaking,
    isUserSpeaking,
    messages,
    error,
    sendMessage,
    sendRequest,
    appendToContext,
    clearMessages,
    
    // Device methods and state
    initDevices,
    getAllMics,
    getAllCams,
    getAllSpeakers,
    updateMic,
    updateCam,
    updateSpeaker,
    enableMic,
    enableCam,
    enableScreenShare,
    selectedMic,
    selectedCam,
    selectedSpeaker,
    isMicEnabled,
    isCamEnabled,
    isSharingScreen,
    
    // Advanced methods
    registerFunctionCallHandler,
    setLogLevel,
  } = pipecatClient;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize devices and register function handlers when connected
  useEffect(() => {
    if (isConnected && isBotReady) {
      handleInitDevices();
      
      // Register example function call handlers
      registerFunctionCallHandler('get_user_info', async (params) => {
        console.log('Function call: get_user_info', params);
        return { user_id: '123', name: 'User', status: 'active' };
      });

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

  const handleInitDevices = async () => {
    try {
      await initDevices();
      const [mics, cams, speakers] = await Promise.all([
        getAllMics(),
        getAllCams(),
        getAllSpeakers()
      ]);
      setAvailableMics(mics);
      setAvailableCams(cams);
      setAvailableSpeakers(speakers);
    } catch (err: any) {
      console.error('Failed to initialize devices:', err);
      toast.error('Failed to initialize devices');
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !isConnected) return;

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

  const handleSendRequest = async () => {
    if (!input.trim() || !isConnected) return;

    const message = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendRequest('user_request', { content: message }, 15000);
      console.log('Bot response:', response);
      toast.success('Request sent and response received');
    } catch (err: any) {
      toast.error(err.message || 'Request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppendContext = async () => {
    if (!input.trim() || !isConnected) return;

    const context = input.trim();
    setInput('');

    try {
      const success = await appendToContext({
        role: 'user',
        content: context,
        run_immediately: false
      });
      
      if (success) {
        toast.success('Context added silently');
      } else {
        toast.error('Failed to add context');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add context');
    }
  };

  const toggleMic = () => {
    enableMic(!isMicEnabled);
    toast.info(isMicEnabled ? 'Microphone disabled' : 'Microphone enabled');
  };

  const toggleCam = () => {
    enableCam(!isCamEnabled);
    toast.info(isCamEnabled ? 'Camera disabled' : 'Camera enabled');
  };

  const toggleScreenShare = () => {
    enableScreenShare(!isSharingScreen);
    toast.info(isSharingScreen ? 'Screen share stopped' : 'Screen share started');
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

  return (
    <Card className={`flex flex-col h-full ${className}`}>
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Voice Chat Assistant
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Device Controls */}
            {isConnected && (
              <div className="flex items-center gap-1">
                <Button
                  variant={isMicEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleMic}
                  disabled={!isBotReady}
                >
                  {isMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </Button>
                
                <Button
                  variant={isCamEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleCam}
                  disabled={!isBotReady}
                >
                  {isCamEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </Button>
                
                <Button
                  variant={isSharingScreen ? "default" : "outline"}
                  size="sm"
                  onClick={toggleScreenShare}
                  disabled={!isBotReady}
                >
                  {isSharingScreen ? <Monitor className="w-4 h-4" /> : <MonitorOff className="w-4 h-4" />}
                </Button>

                <Dialog open={showDeviceSettings} onOpenChange={setShowDeviceSettings}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Device Settings</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                      {/* Microphone Selection */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Mic className="w-4 h-4" />
                          Microphone
                        </Label>
                        <Select 
                          value={selectedMic?.deviceId || ""} 
                          onValueChange={updateMic}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select microphone" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMics.map((mic) => (
                              <SelectItem key={mic.deviceId} value={mic.deviceId}>
                                {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Camera Selection */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Video className="w-4 h-4" />
                          Camera
                        </Label>
                        <Select 
                          value={selectedCam?.deviceId || ""} 
                          onValueChange={updateCam}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select camera" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCams.map((cam) => (
                              <SelectItem key={cam.deviceId} value={cam.deviceId}>
                                {cam.label || `Camera ${cam.deviceId.slice(0, 8)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Speaker Selection */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Headphones className="w-4 h-4" />
                          Speaker
                        </Label>
                        <Select 
                          value={selectedSpeaker?.deviceId || ""} 
                          onValueChange={updateSpeaker}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select speaker" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSpeakers.map((speaker) => (
                              <SelectItem key={speaker.deviceId} value={speaker.deviceId}>
                                {speaker.label || `Speaker ${speaker.deviceId.slice(0, 8)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button onClick={handleInitDevices} className="w-full">
                        Refresh Devices
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Status Indicators */}
            <div className="flex items-center gap-1">
              {isBotSpeaking && <Badge variant="secondary" className="text-blue-600">🗣️ Bot Speaking</Badge>}
              {isUserSpeaking && <Badge variant="secondary" className="text-green-600">🎤 You Speaking</Badge>}
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
                  <p>Connect to start chatting with your assistant</p>
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
                    <p className="text-sm">{message.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Input Area */}
        {isConnected && (
          <>
            <Separator className="mb-4" />
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder={isBotReady ? "Type a message or speak directly..." : "Waiting for assistant..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={!isBotReady || isLoading}
                  className="flex-1"
                />
                
                <Button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || !isBotReady || isLoading}
                  size="sm"
                  className="gap-1"
                >
                  <Send className="w-4 h-4" />
                  Send
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSendRequest}
                  disabled={!input.trim() || !isBotReady || isLoading}
                  variant="outline"
                  size="sm"
                  className="gap-1"
                >
                  <MessageSquare className="w-4 h-4" />
                  Request
                </Button>
                
                <Button
                  onClick={handleAppendContext}
                  disabled={!input.trim() || !isBotReady}
                  variant="outline"
                  size="sm"
                  className="gap-1"
                >
                  <EyeOff className="w-4 h-4" />
                  Hidden Context
                </Button>

                <Button
                  onClick={clearMessages}
                  disabled={messages.length === 0}
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                >
                  Clear Chat
                </Button>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                💬 Send = Regular message • 📝 Request = Expect response • 👁️‍🗨️ Context = Silent background info
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}