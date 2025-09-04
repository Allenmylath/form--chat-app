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

interface LLMContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: any;
  run_immediately?: boolean;
}

interface FunctionCallParams {
  functionName: string;
  arguments: Record<string, unknown>;
}

type FunctionCallCallback = (fn: FunctionCallParams) => Promise<any | void>;

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
  
  // Connection methods
  startBot: (endpoint: string, requestData?: any, headers?: any) => Promise<any>;
  connect: (connectParams?: any) => Promise<any>;
  startBotAndConnect: (endpoint: string, requestData?: any) => Promise<void>;
  disconnect: () => Promise<void>;
  disconnectBot: () => void;
  
  // Messaging methods
  sendMessage: (msgType: string, data?: any) => void;
  sendRequest: (msgType: string, data?: any, timeout?: number) => Promise<any>;
  appendToContext: (context: LLMContextMessage) => Promise<boolean>;
  
  // Device methods
  initDevices: () => Promise<void>;
  getAllMics: () => Promise<MediaDeviceInfo[]>;
  getAllCams: () => Promise<MediaDeviceInfo[]>;
  getAllSpeakers: () => Promise<MediaDeviceInfo[]>;
  updateMic: (micId: string) => void;
  updateCam: (camId: string) => void;
  updateSpeaker: (speakerId: string) => void;
  enableMic: (enable: boolean) => void;
  enableCam: (enable: boolean) => void;
  enableScreenShare: (enable: boolean) => void;
  
  // Device state
  selectedMic: MediaDeviceInfo | null;
  selectedCam: MediaDeviceInfo | null;
  selectedSpeaker: MediaDeviceInfo | null;
  isMicEnabled: boolean;
  isCamEnabled: boolean;
  isSharingScreen: boolean;
  
  // Advanced methods
  tracks: () => any;
  registerFunctionCallHandler: (functionName: string, callback: FunctionCallCallback) => void;
  setLogLevel: (level: number) => void;
  
  // Utility methods
  clearMessages: () => void;
}

export const usePipecatClient = (options: UsePipecatClientOptions = {}): UsePipecatClientReturn => {
  const {
    enableMic: initialEnableMic = true,
    enableCam: initialEnableCam = false,
    enableScreenShare: initialEnableScreenShare = false,
  } = options;

  const [client, setClient] = useState<PipecatClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBotReady, setIsBotReady] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Device states
  const [selectedMic, setSelectedMic] = useState<MediaDeviceInfo | null>(null);
  const [selectedCam, setSelectedCam] = useState<MediaDeviceInfo | null>(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState<MediaDeviceInfo | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(initialEnableMic);
  const [isCamEnabled, setIsCamEnabled] = useState(initialEnableCam);
  const [isSharingScreen, setIsSharingScreen] = useState(false);

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
      enableMic: isMicEnabled,
      enableCam: isCamEnabled,
      enableScreenShare: initialEnableScreenShare,
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
  }, [isMicEnabled, isCamEnabled, initialEnableScreenShare, addMessage, handleBotAudio]);

  // Connection methods
  const startBot = useCallback(async (endpoint: string, requestData?: any, headers?: any) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      setError(null);
      const result = await client.startBot({
        endpoint,
        requestData,
        headers,
      });
      console.log('Bot started:', result);
      return result;
    } catch (err: any) {
      console.error('Failed to start bot:', err);
      setError(err.message || 'Failed to start bot');
      throw err;
    }
  }, [client]);

  const connect = useCallback(async (connectParams?: any) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      setIsConnecting(true);
      setError(null);
      const result = await client.connect(connectParams);
      console.log('Connected:', result);
      return result;
    } catch (err: any) {
      console.error('Failed to connect:', err);
      setError(err.message || 'Failed to connect');
      setIsConnecting(false);
      throw err;
    }
  }, [client]);

  const startBotAndConnect = useCallback(async (endpoint: string, requestData?: any) => {
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

  const disconnectBot = useCallback(() => {
    if (!client) {
      console.warn('Cannot disconnect bot: client not available');
      return;
    }

    try {
      client.disconnectBot();
      console.log('Bot disconnected');
    } catch (err: any) {
      console.error('Failed to disconnect bot:', err);
      setError(err.message || 'Failed to disconnect bot');
    }
  }, [client]);

  // Messaging methods
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

  const sendRequest = useCallback(async (msgType: string, data?: any, timeout?: number): Promise<any> => {
    if (!client || !isConnected) {
      console.warn('Cannot send request: client not connected');
      setError('Not connected to bot');
      throw new Error('Not connected to bot');
    }

    try {
      const response = await client.sendClientRequest(msgType, data, timeout);
      console.log('Request sent:', msgType, data, 'Response:', response);
      return response;
    } catch (err: any) {
      console.error('Failed to send request:', err);
      setError(err.message || 'Failed to send request');
      throw err;
    }
  }, [client, isConnected]);

  const appendToContext = useCallback(async (context: LLMContextMessage): Promise<boolean> => {
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

  // Device methods
  const initDevices = useCallback(async () => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      await client.initDevices();
      console.log('Devices initialized');
    } catch (err: any) {
      console.error('Failed to initialize devices:', err);
      setError(err.message || 'Failed to initialize devices');
      throw err;
    }
  }, [client]);

  const getAllMics = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    if (!client) {
      return [];
    }

    try {
      const mics = await client.getAllMics();
      console.log('Available microphones:', mics);
      return mics;
    } catch (err: any) {
      console.error('Failed to get microphones:', err);
      return [];
    }
  }, [client]);

  const getAllCams = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    if (!client) {
      return [];
    }

    try {
      const cams = await client.getAllCams();
      console.log('Available cameras:', cams);
      return cams;
    } catch (err: any) {
      console.error('Failed to get cameras:', err);
      return [];
    }
  }, [client]);

  const getAllSpeakers = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    if (!client) {
      return [];
    }

    try {
      const speakers = await client.getAllSpeakers();
      console.log('Available speakers:', speakers);
      return speakers;
    } catch (err: any) {
      console.error('Failed to get speakers:', err);
      return [];
    }
  }, [client]);

  const updateMic = useCallback((micId: string) => {
    if (!client) {
      console.warn('Cannot update mic: client not available');
      return;
    }

    try {
      client.updateMic(micId);
      setSelectedMic(client.selectedMic as MediaDeviceInfo || null);
      console.log('Microphone updated:', micId);
    } catch (err: any) {
      console.error('Failed to update microphone:', err);
      setError(err.message || 'Failed to update microphone');
    }
  }, [client]);

  const updateCam = useCallback((camId: string) => {
    if (!client) {
      console.warn('Cannot update cam: client not available');
      return;
    }

    try {
      client.updateCam(camId);
      setSelectedCam(client.selectedCam as MediaDeviceInfo || null);
      console.log('Camera updated:', camId);
    } catch (err: any) {
      console.error('Failed to update camera:', err);
      setError(err.message || 'Failed to update camera');
    }
  }, [client]);

  const updateSpeaker = useCallback((speakerId: string) => {
    if (!client) {
      console.warn('Cannot update speaker: client not available');
      return;
    }

    try {
      client.updateSpeaker(speakerId);
      setSelectedSpeaker(client.selectedSpeaker as MediaDeviceInfo || null);
      console.log('Speaker updated:', speakerId);
    } catch (err: any) {
      console.error('Failed to update speaker:', err);
      setError(err.message || 'Failed to update speaker');
    }
  }, [client]);

  const enableMic = useCallback((enable: boolean) => {
    if (!client) {
      console.warn('Cannot enable/disable mic: client not available');
      return;
    }

    try {
      client.enableMic(enable);
      setIsMicEnabled(enable);
      console.log('Microphone', enable ? 'enabled' : 'disabled');
    } catch (err: any) {
      console.error('Failed to enable/disable microphone:', err);
      setError(err.message || 'Failed to enable/disable microphone');
    }
  }, [client]);

  const enableCam = useCallback((enable: boolean) => {
    if (!client) {
      console.warn('Cannot enable/disable cam: client not available');
      return;
    }

    try {
      client.enableCam(enable);
      setIsCamEnabled(enable);
      console.log('Camera', enable ? 'enabled' : 'disabled');
    } catch (err: any) {
      console.error('Failed to enable/disable camera:', err);
      setError(err.message || 'Failed to enable/disable camera');
    }
  }, [client]);

  const enableScreenShare = useCallback((enable: boolean) => {
    if (!client) {
      console.warn('Cannot enable/disable screen share: client not available');
      return;
    }

    try {
      client.enableScreenShare(enable);
      setIsSharingScreen(enable);
      console.log('Screen share', enable ? 'enabled' : 'disabled');
    } catch (err: any) {
      console.error('Failed to enable/disable screen share:', err);
      setError(err.message || 'Failed to enable/disable screen share');
    }
  }, [client]);

  // Advanced methods
  const tracks = useCallback(() => {
    if (!client) {
      return null;
    }

    try {
      return client.tracks();
    } catch (err: any) {
      console.error('Failed to get tracks:', err);
      return null;
    }
  }, [client]);

  const registerFunctionCallHandler = useCallback((functionName: string, callback: FunctionCallCallback) => {
    if (!client) {
      console.warn('Cannot register function call handler: client not available');
      return;
    }

    try {
      client.registerFunctionCallHandler(functionName, callback);
      console.log('Function call handler registered:', functionName);
    } catch (err: any) {
      console.error('Failed to register function call handler:', err);
      setError(err.message || 'Failed to register function call handler');
    }
  }, [client]);

  const setLogLevel = useCallback((level: number) => {
    if (!client) {
      console.warn('Cannot set log level: client not available');
      return;
    }

    try {
      client.setLogLevel(level);
      console.log('Log level set to:', level);
    } catch (err: any) {
      console.error('Failed to set log level:', err);
    }
  }, [client]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Update device states when client changes
  useEffect(() => {
    if (client) {
      try {
        setSelectedMic(client.selectedMic as MediaDeviceInfo || null);
        setSelectedCam(client.selectedCam as MediaDeviceInfo || null);
        setSelectedSpeaker(client.selectedSpeaker as MediaDeviceInfo || null);
        setIsMicEnabled(client.isMicEnabled || false);
        setIsCamEnabled(client.isCamEnabled || false);
        setIsSharingScreen(client.isSharingScreen || false);
      } catch (err) {
        console.log('Client device properties not yet available');
      }
    }
  }, [client, isConnected]);

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
    
    // Connection methods
    startBot,
    connect,
    startBotAndConnect,
    disconnect,
    disconnectBot,
    
    // Messaging methods
    sendMessage,
    sendRequest,
    appendToContext,
    
    // Device methods
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
    
    // Device state
    selectedMic,
    selectedCam,
    selectedSpeaker,
    isMicEnabled,
    isCamEnabled,
    isSharingScreen,
    
    // Advanced methods
    tracks,
    registerFunctionCallHandler,
    setLogLevel,
    
    // Utility methods
    clearMessages,
  };
};