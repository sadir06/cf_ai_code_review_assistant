-- Database schema for AI Code Review Assistant

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversation history table
CREATE TABLE IF NOT EXISTS conversation_history (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    code_context TEXT,
    FOREIGN KEY (session_id) REFERENCES user_sessions(session_id)
);

-- Code reviews table
CREATE TABLE IF NOT EXISTS code_reviews (
    review_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    language TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    review_summary TEXT,
    confidence_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES user_sessions(session_id)
);

-- Code suggestions table
CREATE TABLE IF NOT EXISTS code_suggestions (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('security', 'performance', 'style', 'bug', 'optimization')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    line_number INTEGER,
    column_number INTEGER,
    message TEXT NOT NULL,
    suggestion TEXT,
    explanation TEXT NOT NULL,
    FOREIGN KEY (review_id) REFERENCES code_reviews(review_id)
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    preferred_language TEXT DEFAULT 'typescript',
    review_style TEXT DEFAULT 'detailed' CHECK (review_style IN ('detailed', 'concise', 'beginner-friendly')),
    focus_areas TEXT DEFAULT 'security,performance', -- JSON array as text
    notifications_enabled BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_session ON conversation_history(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_timestamp ON conversation_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_reviews_session ON code_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_review ON code_suggestions(review_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_type ON code_suggestions(type);
CREATE INDEX IF NOT EXISTS idx_suggestions_severity ON code_suggestions(severity);
