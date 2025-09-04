"use client";

import FormArea from "@/components/FormArea";
import ChatBox from "@/components/ChatBox";
import { usePipecatClient } from "@/hooks/usePipecatClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, PhoneOff, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function Page() {
  const [endpoint, setEndpoint] = useState("https://manjujayamurali--pipecat-websocket-bot-create-server.modal.run");
  const [initialPrompt, setInitialPrompt] = useState("You are a helpful voice assistant.");
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);

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
    connectToBot,
    disconnect,
  } = pipecatClient;

  const handleConnect = async () => {
    if (!endpoint.trim()) {
      toast.error("Please enter an endpoint URL");
      return;
    }

    try {
      await connectToBot(endpoint.trim(), {
        initial_prompt: initialPrompt.trim() || "You are a helpful voice assistant.",
        llm_provider: "openai"
      });
      setShowConnectionDialog(false);
      toast.success("Connecting to voice assistant...");
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
    <div className="h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1 flex flex-col">
        {/* Header with connection button in top right */}
        <header className="text-center mb-8 flex-shrink-0 relative">
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
              <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="default" 
                    size="sm"
                    className="gap-2"
                    disabled={isConnecting}
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
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Connect to Pipecat Server</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="endpoint">Server Endpoint</Label>
                      <Input
                        id="endpoint"
                        type="text"
                        placeholder="/api/pipecat/start"
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="initialPrompt">Initial Prompt</Label>
                      <Textarea
                        id="initialPrompt"
                        placeholder="You are a helpful voice assistant."
                        value={initialPrompt}
                        onChange={(e) => setInitialPrompt(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        This prompt will initialize the bot's behavior for both form and chat
                      </p>
                    </div>
                    
                    <Button 
                      onClick={handleConnect} 
                      disabled={isConnecting || !endpoint.trim()}
                      className="w-full gap-2"
                    >
                      {isConnecting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Phone className="w-4 h-4" />
                          Connect to Assistant
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-2">
            Interactive Form & Chat
          </h1>
          <p className="text-muted-foreground mb-4">
            Complete the form and chat with our assistant
          </p>
        </header>

        {/* Main Content Grid - Always Visible */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-7xl mx-auto flex-1 min-h-0">
          <div className="lg:col-span-3 flex">
            <FormArea className="flex-1" pipecatClient={pipecatClient} />
          </div>
          
          <div className="lg:col-span-2 flex">
            <ChatBox pipecatClient={pipecatClient} />
          </div>
        </div>
      </div>
    </div>
  );
}