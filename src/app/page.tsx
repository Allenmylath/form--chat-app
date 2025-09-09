"use client";

import FormArea from "@/components/FormArea";
import ChatBox from "@/components/ChatBox";
import { usePipecatClient } from "@/hooks/usePipecatClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneOff, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function Page() {
  const pipecatClient = usePipecatClient({
    enableMic: true,
    enableCam: false,
    enableScreenShare: false,
  });

  const {
    isConnected,
    isConnecting,
    isBotReady,
    error,
    startBotAndConnect,
    disconnect,
  } = pipecatClient;

  const handleConnect = async () => {
    try {
      // This should be your server endpoint that returns { wsUrl: "ws://..." }
      // NOT the WebSocket URL directly
      await startBotAndConnect("/api/start", {
        // Optional: any data you want to pass to your server
        initial_prompt: "You are a helpful assistant",
        user_id: "user-123"
      });
      toast.success("Connected to voice assistant!");
    } catch (err: any) {
      toast.error(err.message || "Failed to connect");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast.info("Disconnected from voice assistant");
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect");
    }
  };

  const getConnectionStatusColor = () => {
    if (error) return "text-destructive";
    if (isBotReady) return "text-green-600";
    if (isConnected) return "text-blue-600";
    if (isConnecting) return "text-yellow-600";
    return "text-muted-foreground";
  };

  const getConnectionStatusText = () => {
    if (error) return `Error: ${error}`;
    if (isBotReady) return "Voice assistant ready";
    if (isConnected) return "Connected, waiting for bot...";
    if (isConnecting) return "Connecting...";
    return "Disconnected";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header with connection button in top right */}
        <header className="text-center mb-8 relative">
          {/* Connect Button - Top Right */}
          <div className="absolute top-0 right-0">
            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {error && <AlertCircle className="w-4 h-4 text-destructive" />}
                  {isBotReady && <CheckCircle className="w-4 h-4 text-green-600" />}
                  <Badge variant="secondary" className={getConnectionStatusColor()}>
                    {getConnectionStatusText()}
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDisconnect}
                  className="gap-1"
                >
                  <PhoneOff className="w-4 h-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button 
                variant="default" 
                size="sm"
                className="gap-2"
                disabled={isConnecting}
                onClick={handleConnect}
              >
                {isConnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4" />
                    Connect
                  </>
                )}
              </Button>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Interactive Form & Chat
            </h1>
            <p className="text-muted-foreground">
              Complete the form and chat with our assistant
            </p>
          </div>
        </header>

        {/* Main Content Grid - Natural Height */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-6 max-w-7xl mx-auto">
          <div>
            <FormArea pipecatClient={pipecatClient} />
          </div>
          
          <div>
            <ChatBox pipecatClient={pipecatClient} />
          </div>
        </div>
      </div>
    </div>
  );
}