// src/app/api/start/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Extract any data you want to pass to your Pipecat server
    const { initial_prompt, user_id, ...otherData } = body;
    
    console.log('Starting bot with data:', { initial_prompt, user_id, otherData });
    
    // Call your Modal Pipecat server's /connect endpoint
    const pipecatServerUrl = 'https://manjujayamurali--pipecat-websocket-bot-create-server.modal.run';
    
    try {
      // Call your Pipecat server to get the WebSocket URL
      const response = await fetch(`${pipecatServerUrl}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initial_prompt: initial_prompt || 'You are a helpful assistant for forms and chat',
          user_id: user_id || `user-${Date.now()}`,
          ...otherData,
        }),
      });

      if (!response.ok) {
        throw new Error(`Pipecat server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Your server returns 'wsUrl' field as per the corrected implementation
      if (!data.wsUrl) {
        throw new Error('Pipecat server did not return a WebSocket URL');
      }

      console.log('Bot started successfully, WebSocket URL:', data.wsUrl);
      
      // Return the WebSocket URL (the client expects 'wsUrl' field)
      return NextResponse.json({
        wsUrl: data.wsUrl,
        success: true,
        message: 'Bot started successfully',
      });
      
    } catch (serverError: any) {
      console.error('Error calling Pipecat server:', serverError);
      
      // Fallback: return the direct WebSocket URL
      const fallbackWsUrl = 'wss://manjujayamurali--pipecat-websocket-bot-create-server.modal.run/ws';
      
      console.log('Using fallback WebSocket URL:', fallbackWsUrl);
      
      return NextResponse.json({
        wsUrl: fallbackWsUrl,
        fallback: true,
        message: 'Using fallback WebSocket URL due to server error',
        error: serverError.message,
      });
    }
    
  } catch (error: any) {
    console.error('Error in /api/start:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to start bot', 
        message: error.message || 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Also support GET for simple cases
export async function GET() {
  return NextResponse.json({
    wsUrl: 'wss://manjujayamurali--pipecat-websocket-bot-fastapi-app.modal.run/ws',
    message: 'Direct WebSocket URL for basic connection'
  });
}
