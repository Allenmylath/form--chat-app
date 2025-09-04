"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { PipecatClient, RTVIEvent } from '@pipecat-ai/client-js';
import { 
  WebSocketTransport, 
  ProtobufFrameSerializer,
  TwilioSerializer 
} from '@pipecat-ai/websocket-transport';

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

interface WebSocketTransportOptions {
  serializer?: 'protobuf' | 'twilio';
  recorderSampleRate?: number;
  playerSampleRate?: number;
}

interface UsePipecatClientOptions {
  enableMic?: boolean;
  enableCam?: boolean;
  enableScreenShare?: boolean;
  transportOptions?: WebSocketTransportOptions;
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
  connect: (connectParams?: { wsUrl: string }) => Promise<any>;
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
  clearError: () => void;
}

export const usePipecatClient = (options: UsePipecatClientOptions = {}): UsePipecatClientReturn => {
  const {
    enableMic: initialEnableMic = true,
    enableCam: initialEnableCam = false,
    enableScreenShare: initialEnableScreenShare = false,
    transportOptions = {}
  } = options;

  const {
    serializer = 'protobuf',
    recorderSampleRate = 16000,
    playerSampleRate = 24000,
  } = transportOptions;

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

  // Refs for cleanup
  const audioContextRef = useRef<AudioContext | null>(null);

  const addMessage = useCallback((message: Omit<BotMessage, 'id' | 'timestamp'>) => {
    const newMessage: BotMessage = {
      ...message,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Enhanced error handler
  const handleError = useCallback((error: any, context?: string) => {
    console.error(`Error ${context ? `in ${context}` : ''}:`, error);
    
    let errorMessage = 'An unexpected error occurred';
    
    if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.data?.message) {
      errorMessage = error.data.message;
    }

    if (context) {
      errorMessage = `${context}: ${errorMessage}`;
    }

    setError(errorMessage);
    
    addMessage({
      type: 'system',
      content: `Error: ${errorMessage}`,
    });

    // Auto-clear error after 10 seconds
    setTimeout(() => {
      setError(null);
    }, 10000);
  }, [addMessage]);

  // Create WebSocket transport with dynamic wsUrl
  const createTransport = useCallback((wsUrl?: string) => {
    try {
      const serializerInstance = serializer === 'twilio' 
        ? new TwilioSerializer() 
        : new ProtobufFrameSerializer();

      return new WebSocketTransport({
        wsUrl, // This will be set when we have the actual URL
        serializer: serializerInstance,
        recorderSampleRate,
        playerSampleRate,
      });
    } catch (err) {
      console.error('Failed to create WebSocket transport:', err);
      throw new Error('Failed to initialize WebSocket transport');
    }
  }, [serializer, recorderSampleRate, playerSampleRate]);

  // Handle bot audio track
  const handleBotAudio = useCallback((track: MediaStreamTrack, participant: any) => {
    if (participant?.local || track.kind !== "audio") return;

    console.log('Bot audio track received:', track);
    
    try {
      // Create audio context if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      
      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(console.error);
      }

      // Create audio element and play
      const audioElement = document.createElement("audio");
      audioElement.srcObject = new MediaStream([track]);
      audioElement.autoplay = true;
      audioElement.playsInline = true;
      
      audioElement.play().catch(console.error);

      // Cleanup when track ends
      track.addEventListener('ended', () => {
        if (audioElement.srcObject) {
          const stream = audioElement.srcObject as MediaStream;
          stream.getTracks().forEach(t => t.stop());
          audioElement.srcObject = null;
        }
      });

    } catch (err) {
      console.error('Error handling bot audio:', err);
    }
  }, []);

  // Handle screen share track
  const handleScreenTrack = useCallback((track: MediaStreamTrack, participant: any) => {
    console.log('Screen share track received:', track);
  }, []);

  const initializeClient = useCallback((wsUrl?: string) => {
    console.log('Initializing Pipecat client with WebSocket transport...');
    
    try {
      const transport = createTransport(wsUrl);
      
      const newClient = new PipecatClient({
        transport,
        enableMic: isMicEnabled,
        enableCam: isCamEnabled,
        enableScreenShare: initialEnableScreenShare,
        callbacks: {
          onConnected: () => {
            console.log('WebSocket client connected');
            setIsConnected(true);
            setIsConnecting(false);
            setError(null);
            addMessage({
              type: 'system',
              content: 'Connected to voice assistant via WebSocket',
            });
          },
          
          onDisconnected: () => {
            console.log('WebSocket client disconnected');
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
          
          onTransportStateChanged: (state: string) => {
            console.log('WebSocket transport state changed:', state);
            
            switch (state) {
              case 'connecting':
                setIsConnecting(true);
                break;
              case 'connected':
                setIsConnected(true);
                setIsConnecting(false);
                break;
              case 'disconnecting':
                setIsConnecting(false);
                break;
              case 'disconnected':
              case 'failed':
                setIsConnected(false);
                setIsConnecting(false);
                setIsBotReady(false);
                break;
            }
          },
          
          onBotReady: (botReadyData: any) => {
            console.log('Bot is ready:', botReadyData);
            setIsBotReady(true);
            addMessage({
              type: 'system',
              content: `Voice assistant is ready (RTVI ${botReadyData?.version || 'unknown'})`,
            });
          },
          
          onBotConnected: () => {
            console.log('Bot connected to WebSocket');
            addMessage({
              type: 'system',
              content: 'Voice assistant connected',
            });
          },
          
          onBotDisconnected: (participant: any) => {
            console.log('Bot disconnected from WebSocket');
            setIsBotReady(false);
            setIsBotSpeaking(false);
            addMessage({
              type: 'system',
              content: 'Voice assistant disconnected',
            });
          },
          
          onUserTranscript: (data: any) => {
            console.log('User transcript:', data);
            if (data?.text && data.text.trim() && data.final) {
              addMessage({
                type: 'user',
                content: data.text.trim(),
              });
            }
          },
          
          onBotTranscript: (data: any) => {
            console.log('Bot transcript:', data);
            if (data?.text && data.text.trim()) {
              addMessage({
                type: 'bot',
                content: data.text.trim(),
              });
            }
          },
          
          onBotLlmText: (data: any) => {
            console.log('Bot LLM text:', data);
            if (data?.text && data.text.trim()) {
              addMessage({
                type: 'bot',
                content: data.text.trim(),
              });
            }
          },

          onBotTtsText: (data: any) => {
            console.log('Bot TTS text:', data);
            if (data?.text && data.text.trim()) {
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
            console.error('RTVI client error:', error);
            const isFatal = error?.data?.fatal || false;
            const errorMsg = error?.data?.message || error?.message || 'Connection error occurred';
            
            handleError(errorMsg, 'Client Error');
            
            if (isFatal) {
              setIsConnecting(false);
              setIsConnected(false);
              setIsBotReady(false);
            }
          },
          
          onMessageError: (error: any) => {
            console.error('Message error:', error);
            handleError(error?.message || 'Message processing failed', 'Message Error');
          },
          
          onDeviceError: (deviceError: any) => {
            console.error('Device error:', deviceError);
            const devices = deviceError?.devices || [];
            const errorType = deviceError?.type || 'unknown';
            handleError(`Device error (${errorType}): ${devices.join(', ')}`, 'Device Error');
          },
          
          onTrackStarted: handleBotAudio,
          onScreenTrackStarted: handleScreenTrack,
          
          onTrackStopped: (track: MediaStreamTrack, participant: any) => {
            console.log('Track stopped:', track.kind);
          },
          
          onScreenTrackStopped: (track: MediaStreamTrack, participant: any) => {
            console.log('Screen track stopped');
          },

          // Device update callbacks
          onMicUpdated: (mic: MediaDeviceInfo) => {
            console.log('Mic updated:', mic.label);
            setSelectedMic(mic);
          },
          
          onCamUpdated: (cam: MediaDeviceInfo) => {
            console.log('Cam updated:', cam.label);
            setSelectedCam(cam);
          },
          
          onSpeakerUpdated: (speaker: MediaDeviceInfo) => {
            console.log('Speaker updated:', speaker.label);
            setSelectedSpeaker(speaker);
          },
        },
      });

      return newClient;
    } catch (err) {
      console.error('Failed to initialize client:', err);
      handleError(err, 'Client Initialization');
      throw err;
    }
  }, [
    createTransport, 
    isMicEnabled, 
    isCamEnabled, 
    initialEnableScreenShare, 
    addMessage, 
    handleError, 
    handleBotAudio, 
    handleScreenTrack
  ]);

  // Connection methods
  const startBot = useCallback(async (endpoint: string, requestData?: any, headers?: any) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      setError(null);
      console.log('Starting bot with endpoint:', endpoint);
      
      const result = await client.startBot({
        endpoint,
        requestData,
        headers,
        timeout: 10000,
      });
      
      console.log('Bot started successfully:', result);
      return result;
    } catch (err: any) {
      console.error('Failed to start bot:', err);
      handleError(err, 'Start Bot');
      throw err;
    }
  }, [client, handleError]);

  const connect = useCallback(async (connectParams?: { wsUrl: string }) => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    if (!connectParams?.wsUrl) {
      throw new Error('WebSocket URL is required for connection');
    }

    try {
      setIsConnecting(true);
      setError(null);
      console.log('Connecting to WebSocket:', connectParams.wsUrl);
      
      const result = await client.connect(connectParams);
      
      console.log('Connected successfully:', result);
      return result;
    } catch (err: any) {
      console.error('Failed to connect:', err);
      handleError(err, 'Connect');
      setIsConnecting(false);
      throw err;
    }
  }, [client, handleError]);

  // This is the key method that follows the documentation pattern
  const startBotAndConnect = useCallback(async (endpoint: string, requestData?: any) => {
    console.log('Starting bot and connecting...', { endpoint, requestData });
    
    try {
      setIsConnecting(true);
      setError(null);

      // Clean up existing client
      if (client) {
        await client.disconnect().catch(console.error);
      }

      // Initialize new client (without wsUrl yet)
      const newClient = initializeClient();
      setClient(newClient);

      // Use startBotAndConnect which calls the endpoint and gets wsUrl back
      const result = await newClient.startBotAndConnect({
        endpoint, // This should be your /connect endpoint
        requestData: requestData || {}
      });

      console.log('Bot started and connected successfully:', result);
      
    } catch (err: any) {
      console.error('Failed to start bot and connect:', err);
      handleError(err, 'Start Bot And Connect');
      setIsConnecting(false);
    }
  }, [client, initializeClient, handleError]);

  const disconnect = useCallback(async () => {
    console.log('Disconnecting from bot...');
    
    if (client) {
      try {
        await client.disconnect();
      } catch (err) {
        console.error('Error during disconnect:', err);
      }
    }

    // Clean up audio context
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      } catch (err) {
        console.error('Error closing audio context:', err);
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
      handleError(err, 'Disconnect Bot');
    }
  }, [client, handleError]);

  // Messaging methods
  const sendMessage = useCallback((msgType: string, data?: any) => {
    if (!client || !isConnected) {
      console.warn('Cannot send message: client not connected');
      handleError('Not connected to bot', 'Send Message');
      return;
    }

    try {
      client.sendClientMessage(msgType, data);
      console.log('Message sent:', msgType, data);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      handleError(err, 'Send Message');
    }
  }, [client, isConnected, handleError]);

  const sendRequest = useCallback(async (msgType: string, data?: any, timeout?: number): Promise<any> => {
    if (!client || !isConnected) {
      const error = new Error('Not connected to bot');
      handleError(error, 'Send Request');
      throw error;
    }

    try {
      const response = await client.sendClientRequest(msgType, data, timeout || 10000);
      console.log('Request sent and response received:', msgType, data, 'Response:', response);
      return response;
    } catch (err: any) {
      console.error('Failed to send request:', err);
      handleError(err, 'Send Request');
      throw err;
    }
  }, [client, isConnected, handleError]);

  const appendToContext = useCallback(async (context: LLMContextMessage): Promise<boolean> => {
    if (!client || !isConnected) {
      console.warn('Cannot append to context: client not connected');
      handleError('Not connected to bot', 'Append Context');
      return false;
    }

    try {
      if (client.appendToContext) {
        await client.appendToContext(context);
        console.log('Context appended:', context);
        return true;
      } else {
        // Fallback: send as a message
        client.sendClientMessage('context', { context });
        console.log('Context sent as message:', context);
        return true;
      }
    } catch (err: any) {
      console.error('Failed to append context:', err);
      handleError(err, 'Append Context');
      return false;
    }
  }, [client, isConnected, handleError]);

  // Device methods with enhanced error handling
  const initDevices = useCallback(async () => {
    if (!client) {
      throw new Error('Client not initialized');
    }

    try {
      await client.initDevices();
      console.log('Devices initialized');
    } catch (err: any) {
      console.error('Failed to initialize devices:', err);
      handleError(err, 'Initialize Devices');
      throw err;
    }
  }, [client, handleError]);

  const getAllMics = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    if (!client) {
      return [];
    }

    try {
      const mics = await client.getAllMics();
      console.log('Available microphones:', mics.length);
      return mics;
    } catch (err: any) {
      console.error('Failed to get microphones:', err);
      handleError(err, 'Get Microphones');
      return [];
    }
  }, [client, handleError]);

  const getAllCams = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    if (!client) {
      return [];
    }

    try {
      const cams = await client.getAllCams();
      console.log('Available cameras:', cams.length);
      return cams;
    } catch (err: any) {
      console.error('Failed to get cameras:', err);
      handleError(err, 'Get Cameras');
      return [];
    }
  }, [client, handleError]);

  const getAllSpeakers = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    if (!client) {
      return [];
    }

    try {
      const speakers = await client.getAllSpeakers();
      console.log('Available speakers:', speakers.length);
      return speakers;
    } catch (err: any) {
      console.error('Failed to get speakers:', err);
      handleError(err, 'Get Speakers');
      return [];
    }
  }, [client, handleError]);

  const updateMic = useCallback((micId: string) => {
    if (!client) {
      console.warn('Cannot update mic: client not available');
      return;
    }

    try {
      client.updateMic(micId);
      const updatedMic = (client as any).selectedMic;
      setSelectedMic(updatedMic || null);
      console.log('Microphone updated:', micId);
    } catch (err: any) {
      console.error('Failed to update microphone:', err);
      handleError(err, 'Update Microphone');
    }
  }, [client, handleError]);

  const updateCam = useCallback((camId: string) => {
    if (!client) {
      console.warn('Cannot update cam: client not available');
      return;
    }

    try {
      client.updateCam(camId);
      const updatedCam = (client as any).selectedCam;
      setSelectedCam(updatedCam || null);
      console.log('Camera updated:', camId);
    } catch (err: any) {
      console.error('Failed to update camera:', err);
      handleError(err, 'Update Camera');
    }
  }, [client, handleError]);

  const updateSpeaker = useCallback((speakerId: string) => {
    if (!client) {
      console.warn('Cannot update speaker: client not available');
      return;
    }

    try {
      client.updateSpeaker(speakerId);
      const updatedSpeaker = (client as any).selectedSpeaker;
      setSelectedSpeaker(updatedSpeaker || null);
      console.log('Speaker updated:', speakerId);
    } catch (err: any) {
      console.error('Failed to update speaker:', err);
      handleError(err, 'Update Speaker');
    }
  }, [client, handleError]);

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
      handleError(err, `${enable ? 'Enable' : 'Disable'} Microphone`);
    }
  }, [client, handleError]);

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
      handleError(err, `${enable ? 'Enable' : 'Disable'} Camera`);
    }
  }, [client, handleError]);

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
      handleError(err, `${enable ? 'Enable' : 'Disable'} Screen Share`);
    }
  }, [client, handleError]);

  // Advanced methods
  const tracks = useCallback(() => {
    if (!client) {
      return null;
    }

    try {
      return client.tracks();
    } catch (err: any) {
      console.error('Failed to get tracks:', err);
      handleError(err, 'Get Tracks');
      return null;
    }
  }, [client, handleError]);

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
      handleError(err, 'Register Function Handler');
    }
  }, [client, handleError]);

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
      handleError(err, 'Set Log Level');
    }
  }, [client, handleError]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Update device states when client changes
  useEffect(() => {
    if (client && isConnected) {
      try {
        const clientAny = client as any;
        setSelectedMic(clientAny.selectedMic || null);
        setSelectedCam(clientAny.selectedCam || null);
        setSelectedSpeaker(clientAny.selectedSpeaker || null);
        setIsMicEnabled(clientAny.isMicEnabled || false);
        setIsCamEnabled(clientAny.isCamEnabled || false);
        setIsSharingScreen(clientAny.isSharingScreen || false);
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
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
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
    clearError,
  };
};
