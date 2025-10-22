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
    const systemPrompt = `You are an expert code reviewer. Analyze the provided ${request.language} code and provide comprehensive feedback including:
1. Security vulnerabilities
2. Performance issues
3. Code style and best practices
4. Potential bugs
5. Optimization opportunities

Provide specific, actionable suggestions with line numbers where applicable.

${conversationHistory.length > 0 ? `Previous conversation context:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Use this context to provide more personalized and relevant feedback.` : ''}`;

    const userPrompt = `Please review this ${request.language} code:

\`\`\`${request.language}
${request.code}
\`\`\`

${request.context ? `Context: ${request.context}` : ''}

Provide a detailed review with specific suggestions.`;

    try {
      // Call Llama 3.3 on Workers AI
      const aiResponse = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.3
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
    
    // Split response into sections by headers or numbered items
    const sections = aiResponse.split(/\n(?=#{1,6}\s|\d+\.\s|\*\s|\-\s|###|##|#)/);
    
    sections.forEach((section, index) => {
      if (section.trim().length < 20) return; // Skip empty or very short sections
      
      // Extract line numbers more accurately
      const lineMatches = section.match(/line\s+(\d+)/gi);
      const lineNumbers = lineMatches ? lineMatches.map(match => parseInt(match.split(' ')[1])) : [];
      
      // Determine suggestion type and severity based on content analysis
      const { type, severity } = this.analyzeSectionType(section);
      
      // Extract clean issue description
      const issueDescription = this.extractIssueDescription(section);
      
      // Extract suggested fix
      const suggestedFix = this.extractSuggestedFix(section);
      
      // Create suggestion for each line number found, or one general suggestion
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
      } else {
        // General suggestion without specific line
        suggestions.push({
          id: crypto.randomUUID(),
          type,
          severity,
          message: issueDescription,
          suggestion: suggestedFix,
          explanation: this.generateCleanExplanation(type, severity, issueDescription, null, suggestedFix)
        });
      }
    });

    // If no suggestions were parsed, create a meaningful general suggestion
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
}
