import { Env, CodeReviewRequest, CodeReviewResponse, CodeSuggestion, UserSession, ConversationMessage } from '../types/interfaces';

export class ReviewAgent {
  private state: DurableObjectState;
  private env: Env;
  private sessionData: UserSession | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/review':
          return this.handleCodeReview(request);
        case '/session':
          return this.handleSessionManagement(request);
        case '/conversation':
          return this.handleConversation(request);
        case '/chat':
          return this.handleChat(request);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('ReviewAgent error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleCodeReview(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const reviewRequest: CodeReviewRequest = await request.json();
    
    // Load session data
    await this.loadSessionData(reviewRequest.sessionId);

    // Generate review using AI
    const reviewResponse = await this.generateCodeReview(reviewRequest);

    // Store conversation message
    await this.storeConversationMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: `Code review request for ${reviewRequest.language} code`,
      timestamp: new Date(),
      codeContext: reviewRequest.code
    });

    await this.storeConversationMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: reviewResponse.summary,
      timestamp: new Date()
    });

    return new Response(JSON.stringify(reviewResponse), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async generateCodeReview(request: CodeReviewRequest): Promise<CodeReviewResponse> {
    const reviewId = crypto.randomUUID();
    
    // Load conversation history for context
    const conversationHistory = await this.loadConversationHistory(request.sessionId);
    
    // Prepare the AI prompt for code review with conversation context
    const systemPrompt = `You are a code reviewer. Analyze the ${request.language} code and identify ONLY the actual issues.

${request.context ? `Focus areas: ${request.context}` : ''}

IMPORTANT RULES:
- List ONLY real issues, not general advice
- For each issue, provide: line number, issue type, brief description, and specific fix
- Use this EXACT format for each issue:
  Line X: [TYPE] [DESCRIPTION] | Fix: [SPECIFIC_FIX]
- Issue types: SECURITY, BUG, PERFORMANCE, STYLE, OPTIMIZATION
- Be concise - no explanations or extra text
- Don't repeat the same issue multiple times

Example format:
Line 3: BUG Missing semicolon | Fix: Add semicolon after statement
Line 5: SECURITY Uninitialized variable | Fix: Initialize variable before use`;

    const userPrompt = `Review this ${request.language} code:

${request.code}`;

    try {
      // Call Llama 3.3 on Workers AI
      const aiResponse = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 800,
        temperature: 0.1
      });

      // Parse the AI response and extract suggestions
      const suggestions = this.parseAIResponse(aiResponse.response, request.code);
      
      return {
        reviewId,
        suggestions,
        summary: this.extractSummary(aiResponse.response),
        confidence: 0.85, // AI confidence score
        timestamp: new Date()
      };

    } catch (error) {
      console.error('AI review generation failed:', error);
      
      // Fallback response
      return {
        reviewId,
        suggestions: [{
          id: crypto.randomUUID(),
          type: 'bug',
          severity: 'medium',
          message: 'Unable to generate AI review at this time',
          explanation: 'The AI service is temporarily unavailable. Please try again later.'
        }],
        summary: 'AI review service is temporarily unavailable.',
        confidence: 0.0,
        timestamp: new Date()
      };
    }
  }

  private parseAIResponse(aiResponse: string, code: string): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    const lines = code.split('\n');
    
    // Parse the new clean format: "Line X: [TYPE] [DESCRIPTION] | Fix: [SPECIFIC_FIX]"
    const issuePattern = /Line\s+(\d+):\s+(\w+)\s+(.+?)\s+\|\s+Fix:\s+(.+)/gi;
    let match;
    
    while ((match = issuePattern.exec(aiResponse)) !== null) {
      const lineNumber = parseInt(match[1]);
      const type = match[2].toLowerCase();
      const description = match[3].trim();
      const fix = match[4].trim();
      
      if (lineNumber > 0 && lineNumber <= lines.length) {
        const codeLine = lines[lineNumber - 1];
        
        // Determine severity based on type
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
        if (type === 'security' || type === 'bug') {
          severity = 'high';
        } else if (type === 'style') {
          severity = 'low';
        } else if (type === 'performance' || type === 'optimization') {
          severity = 'medium';
        }
        
        suggestions.push({
          id: crypto.randomUUID(),
          type: type as 'security' | 'performance' | 'style' | 'bug' | 'optimization',
          severity,
          line: lineNumber,
          message: description,
          suggestion: fix,
          explanation: `${description} Found in: "${codeLine.trim()}". Suggested fix: ${fix}`
        });
      }
    }
    
    // If no suggestions were parsed with the new format, try fallback parsing
    if (suggestions.length === 0) {
      // Fallback to old parsing method for backward compatibility
      const sections = aiResponse.split(/\n(?=#{1,6}\s|\d+\.\s|\*\s|\-\s|###|##|#)/);
      
      sections.forEach((section, index) => {
        if (section.trim().length < 20) return;
        
        const lineMatches = section.match(/line\s+(\d+)/gi);
        const lineNumbers = lineMatches ? lineMatches.map(match => parseInt(match.split(' ')[1])) : [];
        
        const { type, severity } = this.analyzeSectionType(section);
        const issueDescription = this.extractIssueDescription(section);
        const suggestedFix = this.extractSuggestedFix(section);
        
        if (lineNumbers.length > 0) {
          lineNumbers.forEach(lineNumber => {
            if (lineNumber > 0 && lineNumber <= lines.length) {
              const codeLine = lines[lineNumber - 1];
              suggestions.push({
                id: crypto.randomUUID(),
                type,
                severity,
                line: lineNumber,
                message: issueDescription,
                suggestion: suggestedFix,
                explanation: this.generateCleanExplanation(type, severity, issueDescription, codeLine, suggestedFix)
              });
            }
          });
        }
      });
    }

    // If still no suggestions, create a general one
    if (suggestions.length === 0) {
      suggestions.push({
        id: crypto.randomUUID(),
        type: 'style',
        severity: 'low',
        message: 'Code review completed',
        explanation: 'The AI has analyzed your code. While no specific issues were detected, consider reviewing the code for best practices and potential improvements.'
      });
    }

    return suggestions;
  }

  private analyzeSectionType(section: string): { type: 'security' | 'performance' | 'style' | 'bug' | 'optimization', severity: 'low' | 'medium' | 'high' | 'critical' } {
    const lowerSection = section.toLowerCase();
    
    // Security analysis
    if (lowerSection.includes('security') || lowerSection.includes('vulnerability') || 
        lowerSection.includes('injection') || lowerSection.includes('xss') || 
        lowerSection.includes('csrf') || lowerSection.includes('authentication')) {
      return {
        type: 'security',
        severity: lowerSection.includes('critical') || lowerSection.includes('severe') ? 'critical' : 'high'
      };
    }
    
    // Bug analysis
    if (lowerSection.includes('bug') || lowerSection.includes('error') || 
        lowerSection.includes('undefined') || lowerSection.includes('null') ||
        lowerSection.includes('exception') || lowerSection.includes('crash') ||
        lowerSection.includes('unterminated') || lowerSection.includes('missing')) {
      return {
        type: 'bug',
        severity: lowerSection.includes('critical') || lowerSection.includes('severe') ? 'critical' : 'high'
      };
    }
    
    // Performance analysis
    if (lowerSection.includes('performance') || lowerSection.includes('slow') || 
        lowerSection.includes('inefficient') || lowerSection.includes('optimize') ||
        lowerSection.includes('bottleneck') || lowerSection.includes('memory')) {
      return {
        type: 'performance',
        severity: 'medium'
      };
    }
    
    // Optimization analysis
    if (lowerSection.includes('optimization') || lowerSection.includes('improve') || 
        lowerSection.includes('better') || lowerSection.includes('refactor')) {
      return {
        type: 'optimization',
        severity: 'medium'
      };
    }
    
    // Style analysis (default)
    return {
      type: 'style',
      severity: 'low'
    };
  }

  private extractIssueDescription(section: string): string {
    // Remove markdown formatting
    let description = section
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/^#+\s*/, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/^\*\s*/, '')
      .replace(/^-\s*/, '');
    
    // Extract the main issue description
    const lines = description.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      // Take the first meaningful line
      description = lines[0].trim();
      
      // Clean up common prefixes
      description = description.replace(/^(Issue|Problem|Concern|Suggestion|Error|Bug)[:\s]+/i, '');
    }
    
    // Limit length
    if (description.length > 120) {
      description = description.substring(0, 120) + '...';
    }
    
    return description;
  }

  private extractSuggestedFix(section: string): string | null {
    // Look for suggested fixes
    const fixPatterns = [
      /(?:fix|solution|suggestion|recommendation)[:\s]+(.+?)(?:\n|$)/i,
      /(?:should|could|consider)[:\s]+(.+?)(?:\n|$)/i,
      /(?:use|try|replace)[:\s]+(.+?)(?:\n|$)/i
    ];
    
    for (const pattern of fixPatterns) {
      const match = section.match(pattern);
      if (match && match[1].trim().length > 5) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  private generateCleanExplanation(type: string, severity: string, issue: string, codeLine: string | null, fix: string | null): string {
    let explanation = issue;
    
    if (codeLine) {
      explanation += ` Found in: "${codeLine.trim()}".`;
    }
    
    if (fix) {
      explanation += ` Suggested fix: ${fix}`;
    }
    
    // Add specific guidance based on type
    switch (type) {
      case 'security':
        explanation += ' This security issue should be addressed immediately.';
        break;
      case 'performance':
        explanation += ' This performance issue may impact user experience.';
        break;
      case 'bug':
        explanation += ' This bug could cause runtime errors.';
        break;
      case 'style':
        explanation += ' This style issue affects code readability.';
        break;
      case 'optimization':
        explanation += ' This optimization can improve code efficiency.';
        break;
    }
    
    return explanation;
  }

  private extractSummary(aiResponse: string): string {
    // Extract the first paragraph or first few sentences as summary
    const sentences = aiResponse.split(/[.!?]+/);
    return sentences.slice(0, 2).join('. ').trim() + '.';
  }

  private async loadSessionData(sessionId: string): Promise<void> {
    try {
      const session = await this.env.DB.prepare(
        'SELECT * FROM user_sessions WHERE session_id = ?'
      ).bind(sessionId).first();

      if (session) {
        this.sessionData = {
          sessionId: session.session_id,
          userId: session.user_id,
          conversationHistory: [], // Would load from conversation_history table
          preferences: {
            language: 'typescript',
            reviewStyle: 'detailed',
            focusAreas: ['security', 'performance'],
            notifications: true
          },
          createdAt: new Date(session.created_at),
          lastActive: new Date(session.last_active)
        };
      }
    } catch (error) {
      console.error('Failed to load session data:', error);
    }
  }

  private async loadConversationHistory(sessionId: string): Promise<ConversationMessage[]> {
    try {
      const history = await this.env.DB.prepare(
        'SELECT * FROM conversation_history WHERE session_id = ? ORDER BY timestamp DESC LIMIT 10'
      ).bind(sessionId).all();

      return history.results.map((row: any) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        timestamp: new Date(row.timestamp),
        codeContext: row.code_context
      }));
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      return [];
    }
  }

  private async storeConversationMessage(message: ConversationMessage): Promise<void> {
    try {
      await this.env.DB.prepare(
        'INSERT INTO conversation_history (id, session_id, role, content, timestamp, code_context) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        message.id,
        this.sessionData?.sessionId,
        message.role,
        message.content,
        message.timestamp.toISOString(),
        message.codeContext || null
      ).run();
    } catch (error) {
      console.error('Failed to store conversation message:', error);
    }
  }

  private async handleSessionManagement(request: Request): Promise<Response> {
    // Handle session-related operations
    return new Response(JSON.stringify({ message: 'Session management endpoint' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleConversation(request: Request): Promise<Response> {
    // Handle conversation history retrieval
    return new Response(JSON.stringify({ message: 'Conversation endpoint' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleChat(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const chatRequest = await request.json();
      
      // Load session data
      await this.loadSessionData(chatRequest.sessionId);

      // Store user message
      await this.storeConversationMessage({
        id: crypto.randomUUID(),
        sessionId: chatRequest.sessionId,
        userId: chatRequest.userId,
        role: 'user',
        content: chatRequest.message,
        timestamp: new Date()
      });

      // Generate AI response
      const aiResponse = await this.generateChatResponse(chatRequest);

      // Store AI response
      await this.storeConversationMessage({
        id: crypto.randomUUID(),
        sessionId: chatRequest.sessionId,
        userId: chatRequest.userId,
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      });

      return new Response(JSON.stringify({ response: aiResponse }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Chat handler error:', error);
      return new Response(JSON.stringify({ error: 'Failed to process chat message' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async generateChatResponse(chatRequest: any): Promise<string> {
    try {
      // Load conversation history for context
      const conversationHistory = await this.loadConversationHistory(chatRequest.sessionId);
      
      // Create context-aware prompt
      const systemPrompt = `You are Helix, an AI code review assistant. You have just analyzed the user's code and found several issues. The user is now asking follow-up questions about the analysis.

Previous analysis context: ${JSON.stringify(chatRequest.context || {})}

Conversation history:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

User's current question: ${chatRequest.message}

Please provide a helpful, detailed response about the code analysis. Be specific about the issues found and provide actionable advice.`;

      const response = await this.env.AI.run('@cf/meta/llama-3.3-70b-instruct', {
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: chatRequest.message
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      return response.response || 'I apologize, but I encountered an issue generating a response. Please try again.';

    } catch (error) {
      console.error('AI chat generation error:', error);
      return 'I apologize, but I encountered an issue generating a response. Please try again.';
    }
  }
}
