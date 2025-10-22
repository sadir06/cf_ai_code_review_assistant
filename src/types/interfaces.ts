// Core types for the Code Review Assistant

export interface CodeReviewRequest {
  code: string;
  language: string;
  userId: string;
  sessionId: string;
  context?: string;
}

export interface CodeReviewResponse {
  reviewId: string;
  suggestions: CodeSuggestion[];
  summary: string;
  confidence: number;
  timestamp: Date;
}

export interface CodeSuggestion {
  id: string;
  type: 'security' | 'performance' | 'style' | 'bug' | 'optimization';
  severity: 'low' | 'medium' | 'high' | 'critical';
  line?: number;
  column?: number;
  message: string;
  suggestion?: string;
  explanation: string;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  conversationHistory: ConversationMessage[];
  preferences: UserPreferences;
  createdAt: Date;
  lastActive: Date;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  codeContext?: string;
}

export interface UserPreferences {
  language: string;
  reviewStyle: 'detailed' | 'concise' | 'beginner-friendly';
  focusAreas: string[];
  notifications: boolean;
}

export interface ReviewAgentState {
  activeSessions: Map<string, UserSession>;
  reviewQueue: CodeReviewRequest[];
  processingReviews: Set<string>;
}

// Cloudflare Workers environment interface
export interface Env {
  REVIEW_AGENT: DurableObjectNamespace;
  DB: D1Database;
  AI: Ai;
}

// Durable Object class interface
export interface ReviewAgent {
  fetch(request: Request): Promise<Response>;
}
