"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { PipecatClient, RTVIEvent } from '@pipecat-ai/client-js';
import { DailyTransport } from '@pipecat-ai/daily-transport';

interface BotMessage {
  id: string;
  type: 'bot' | 'user' | 'system';
  content: string;
  timestamp: Date;
}

interface UsePipecatClientOptions {
  enableMic?: boolean;
  enableCam?: boolean;
  enableScreenShare?: boolean;
}

interface UsePipecatClientReturn {
  client: PipecatClient | null;
  isConnected: boolean;
  isConnecting: boolean;
  isBotReady: boolean;
  isBotSpeaking: boolean;
  isUserSpeaking: boolean;
  messages: BotMessage[];
  error: string | null;
  connectToBot: (endpoint: string, requestData?: any) => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (msgType: string, data?: any) => void;
  sendRequest: (msgType: string, data?: any) => Promise<any>;
  appendToContext: (context: any) => Promise<boolean>;
  clearMessages: () => void;
}

export const usePipecatClient = (options: UsePipecatClientOptions = {}): UsePipecatClientReturn => {
  const {
    enableMic = true,
    enableCam = false,
    enableScreenShare = false,
  } = options;

  const [client, setClient] = useState<PipecatClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBotReady, setIsBotReady] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element for bot playback
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.autoplay = true;
    return () => {
      if (audioRef.current) {
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const addMessage = useCallback((message: Omit<BotMessage, 'id' | 'timestamp'>) => {
    const newMessage: BotMessage = {
      ...message,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  // Handle incoming audio from the bot
  const handleBotAudio = useCallback((track: MediaStreamTrack, participant: any) => {
    if (participant.local || track.kind !== "audio") return;

    console.log('Bot audio track received');
    if (audioRef.current) {
      const audioElement = document.createElement("audio");
      audioElement.srcObject = new MediaStream([track]);
      audioElement.autoplay = true;
      audioElement.play().catch(console.error);
    }
  }, []);

  const initializeClient = useCallback(() => {
    console.log('Initializing Pipecat client...');
    
    const newClient = new PipecatClient({
      transport: new DailyTransport(),
      enableMic,
      enableCam,
      enableScreenShare,
      callbacks: {
        onConnected: () => {
          console.log('Client connected');
          setIsConnected(true);
          setIsConnecting(false);
          setError(null);
          addMessage({
            type: 'system',
            content: 'Connected to voice assistant',
          });
        },
        onDisconnected: () => {
          console.log('Client disconnected');
          setIsConnected(false);
          setIsConnecting(false);
          setIsBotReady(false);
          setIsBotSpeaking(false);
          setIsUserSpeaking(false);
          addMessage({
            type: 'system',
            content: 'Disconnected from voice assistant',
          });
        },
        onBotReady: (botReadyData: any) => {
          console.log('Bot is ready', botReadyData);
          setIsBotReady(true);
          addMessage({
            type: 'system',
            content: 'Voice assistant is ready to chat',
          });
        },
        onBotConnected: () => {
          console.log('Bot connected');
          addMessage({
            type: 'system',
            content: 'Voice assistant connected',
          });
        },
        onBotDisconnected: () => {
          console.log('Bot disconnected');
          setIsBotReady(false);
          setIsBotSpeaking(false);
          addMessage({
            type: 'system',
            content: 'Voice assistant disconnected',
          });
        },
        onServerMessage: (message: any) => {
          console.log('Server message:', message);
          if (message && message.content) {
            addMessage({
              type: 'bot',
              content: message.content,
            });
          }
        },
        onUserTranscript: (data: any) => {
          console.log('User transcript:', data);
          if (data.text && data.text.trim() && data.final) {
            addMessage({
              type: 'user',
              content: data.text.trim(),
            });
          }
        },
        onBotTranscript: (data: any) => {
          console.log('Bot transcript:', data);
          if (data.text && data.text.trim()) {
            addMessage({
              type: 'bot',
              content: data.text.trim(),
            });
          }
        },
        onBotLlmText: (data: any) => {
          console.log('Bot LLM text:', data);
          if (data.text && data.text.trim()) {
            addMessage({
              type: 'bot',
              content: data.text.trim(),
            });
          }
        },
        onBotStartedSpeaking: () => {
          console.log('Bot started speaking');
          setIsBotSpeaking(true);
        },
        onBotStoppedSpeaking: () => {
          console.log('Bot stopped speaking');
          setIsBotSpeaking(false);
        },
        onUserStartedSpeaking: () => {
          console.log('User started speaking');
          setIsUserSpeaking(true);
        },
        onUserStoppedSpeaking: () => {
          console.log('User stopped speaking');
          setIsUserSpeaking(false);
        },
        onError: (error: any) => {
          console.error('Client error:', error);
          setError(error.data?.message || error.message || 'An error occurred');
          setIsConnecting(false);
          addMessage({
            type: 'system',
            content: `Error: ${error.data?.message || error.message || 'Connection failed'}`,
          });
        },
        onMessageError: (error: any) => {
          console.error('Message error:', error);
          setError(error.message || 'Message error occurred');
          addMessage({
            type: 'system',
            content: `Message error: ${error.message || 'Failed to send message'}`,
          });
        },
        onTransportStateChanged: (state: string) => {
          console.log('Transport state changed:', state);
          if (state === 'connected') {
            setIsConnected(true);
          } else if (state === 'disconnected' || state === 'failed') {
            setIsConnected(false);
            setIsBotReady(false);
          }
        },
        onTrackStarted: handleBotAudio,
      },
    });

    return newClient;
  }, [enableMic, enableCam, enableScreenShare, addMessage, handleBotAudio]);

  const connectToBot = useCallback(async (endpoint: string, requestData?: any) => {
    console.log('Connecting to bot...', { endpoint, requestData });
    
    try {
      setIsConnecting(true);
      setError(null);

      // Clean up existing client
      if (client) {
        await client.disconnect();
      }

      const newClient = initializeClient();
      setClient(newClient);

      // Start bot and connect
      await newClient.startBotAndConnect({
        endpoint,
        requestData: requestData || {
          initial_prompt: "You are a helpful voice assistant.",
          llm_provider: "openai"
        }
      });

    } catch (err: any) {
      console.error('Failed to connect to bot:', err);
      setError(err.message || 'Failed to connect to bot');
      setIsConnecting(false);
      addMessage({
        type: 'system',
        content: `Connection failed: ${err.message || 'Unknown error'}`,
      });
    }
  }, [client, initializeClient, addMessage]);

  const disconnect = useCallback(async () => {
    console.log('Disconnecting from bot...');
    
    if (client) {
      try {
        await client.disconnect();
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
    }

    setClient(null);
    setIsConnected(false);
    setIsConnecting(false);
    setIsBotReady(false);
    setIsBotSpeaking(false);
    setIsUserSpeaking(false);
    setError(null);
  }, [client]);

  const sendMessage = useCallback((msgType: string, data?: any) => {
    if (!client || !isConnected) {
      console.warn('Cannot send message: client not connected');
      setError('Not connected to bot');
      return;
    }

    try {
      client.sendClientMessage(msgType, data);
      console.log('Message sent:', msgType, data);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError(err.message || 'Failed to send message');
    }
  }, [client, isConnected]);

  const sendRequest = useCallback(async (msgType: string, data?: any): Promise<any> => {
    if (!client || !isConnected) {
      console.warn('Cannot send request: client not connected');
      setError('Not connected to bot');
      throw new Error('Not connected to bot');
    }

    try {
      const response = await client.sendClientRequest(msgType, data);
      console.log('Request sent:', msgType, data, 'Response:', response);
      return response;
    } catch (err: any) {
      console.error('Failed to send request:', err);
      setError(err.message || 'Failed to send request');
      throw err;
    }
  }, [client, isConnected]);

  const appendToContext = useCallback(async (context: any): Promise<boolean> => {
    if (!client || !isConnected) {
      console.warn('Cannot append to context: client not connected');
      setError('Not connected to bot');
      return false;
    }

    try {
      // Use the client's appendToContext method if available
      if (client.appendToContext) {
        await client.appendToContext(context);
        console.log('Context appended:', context);
        return true;
      } else {
        // Fallback: send as a context message if appendToContext is not available
        client.sendClientMessage('context', { context });
        console.log('Context sent as message:', context);
        return true;
      }
    } catch (err: any) {
      console.error('Failed to append context:', err);
      setError(err.message || 'Failed to append context');
      return false;
    }
  }, [client, isConnected]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (client) {
        client.disconnect().catch(console.error);
      }
      if (audioRef.current) {
        audioRef.current.src = '';
      }
    };
  }, [client]);

  return {
    client,
    isConnected,
    isConnecting,
    isBotReady,
    isBotSpeaking,
    isUserSpeaking,
    messages,
    error,
    connectToBot,
    disconnect,
    sendMessage,
    sendRequest,
    appendToContext,
    clearMessages,
  };
};