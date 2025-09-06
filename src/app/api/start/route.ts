import { NextRequest, NextResponse } from 'next/server'

interface ConnectRequestBody {
  initial_prompt?: string
  user_id?: string
  [key: string]: any
}

interface PipecatServerResponse {
  ws_url?: string
  wsUrl?: string
  websocket_url?: string
}

const PIPECAT_SERVER_URL = 'https://manjujayamurali--skills-assessment-quiz-bot-fastapi-app.modal.run/connect'
const FALLBACK_WS_URL = 'wss://manjujayamurali--skills-assessment-quiz-bot-fastapi-app.modal.run/ws'

export async function POST(request: NextRequest) {
  try {
    console.log('Pipecat WebSocket connection request received')
    
    let body: ConnectRequestBody = {}
    
    try {
      const contentType = request.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        body = await request.json()
      }
    } catch (parseError) {
      console.warn('Failed to parse request body, using empty object:', parseError)
    }

    console.log('Request body:', body)

    try {
      const response = await fetch(PIPECAT_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      if (!response.ok) {
        console.error(`Pipecat server responded with status: ${response.status}`)
        throw new Error(`HTTP ${response.status}`)
      }

      const data: PipecatServerResponse = await response.json()
      console.log('Pipecat server response:', data)
      
      // Extract WebSocket URL from various possible response formats
      const wsUrl = data.ws_url || data.wsUrl || data.websocket_url
      
      if (wsUrl) {
        console.log('Successfully obtained WebSocket URL:', wsUrl)
        return NextResponse.json({ wsUrl })
      } else {
        console.warn('No WebSocket URL found in server response, using fallback')
        return NextResponse.json({ wsUrl: FALLBACK_WS_URL })
      }
    } catch (fetchError) {
      console.error('Failed to connect to Pipecat server:', fetchError)
      console.log('Using fallback WebSocket URL')
      
      return NextResponse.json({ 
        wsUrl: FALLBACK_WS_URL,
        fallback: true,
        error: fetchError instanceof Error ? fetchError.message : 'Unknown error'
      })
    }
  } catch (error) {
    console.error('Unexpected error in POST handler:', error)
    
    return NextResponse.json(
      { 
        wsUrl: FALLBACK_WS_URL,
        fallback: true,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    console.log('Health check request received')
    
    return NextResponse.json({ 
      wsUrl: FALLBACK_WS_URL,
      status: 'healthy',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in GET handler:', error)
    
    return NextResponse.json(
      { 
        wsUrl: FALLBACK_WS_URL,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}