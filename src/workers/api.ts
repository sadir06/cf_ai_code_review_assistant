import { Env, CodeReviewRequest, CodeReviewResponse } from '../types/interfaces';
import { ReviewAgent } from './review-agent';

// Export the Durable Object class
export { ReviewAgent };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      switch (path) {
        case '/api/review':
          return handleCodeReview(request, env, corsHeaders);
        
        case '/api/session':
          return handleSession(request, env, corsHeaders);
        
        case '/api/chat':
          return handleChat(request, env, corsHeaders);
        
        case '/api/health':
          return new Response(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        
        default:
          return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      console.error('API Error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
};

async function handleCodeReview(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const reviewRequest: CodeReviewRequest = await request.json();
    
    // Validate request
    if (!reviewRequest.code || !reviewRequest.language || !reviewRequest.userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get or create Durable Object for this user session
    const durableObjectId = env.REVIEW_AGENT.idFromName(reviewRequest.sessionId);
    const reviewAgent = env.REVIEW_AGENT.get(durableObjectId);

    // Forward the review request to the Durable Object
    const response = await reviewAgent.fetch(new Request('http://internal/review', {
      method: 'POST',
      body: JSON.stringify(reviewRequest),
      headers: { 'Content-Type': 'application/json' }
    }));

    const reviewResponse: CodeReviewResponse = await response.json();

    return new Response(JSON.stringify(reviewResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Code review error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process code review' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleSession(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  if (request.method === 'POST') {
    // Create new session
    const sessionId = crypto.randomUUID();
    const userId = crypto.randomUUID(); // In real app, this would come from auth
    
    // Initialize session in D1
    await env.DB.prepare(
      'INSERT INTO user_sessions (session_id, user_id, created_at, last_active) VALUES (?, ?, ?, ?)'
    ).bind(sessionId, userId, new Date().toISOString(), new Date().toISOString()).run();

    return new Response(JSON.stringify({ sessionId, userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get session history from D1
    const session = await env.DB.prepare(
      'SELECT * FROM user_sessions WHERE session_id = ?'
    ).bind(sessionId).first();

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(session), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}

async function handleChat(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const chatRequest = await request.json();
    
    // Validate request
    if (!chatRequest.message || !chatRequest.userId || !chatRequest.sessionId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get or create Durable Object for this user session
    const durableObjectId = env.REVIEW_AGENT.idFromName(chatRequest.sessionId);
    const reviewAgent = env.REVIEW_AGENT.get(durableObjectId);

    // Forward the chat request to the Durable Object
    const response = await reviewAgent.fetch(new Request('http://internal/chat', {
      method: 'POST',
      body: JSON.stringify(chatRequest),
      headers: { 'Content-Type': 'application/json' }
    }));

    const chatResponse = await response.json();

    return new Response(JSON.stringify(chatResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat message' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
