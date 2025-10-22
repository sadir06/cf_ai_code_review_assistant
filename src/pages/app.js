// Helix - AI Code Review Assistant

class HelixApp {
    constructor() {
        this.currentStep = 'language';
        this.selectedLanguage = null;
        this.code = '';
        this.context = [];
        this.sessionId = null;
        this.userId = null;
        this.apiBase = 'https://cf-ai-code-review-assistant.sadiraju06.workers.dev/api';
        this.analysisResults = null;
        this.fixedCode = '';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.createSession();
    }

    async createSession() {
        try {
            const response = await fetch(`${this.apiBase}/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.sessionId = data.sessionId;
                this.userId = data.userId;
            }
        } catch (error) {
            console.error('Failed to create session:', error);
        }
    }

    setupEventListeners() {
        // Language selection
        document.querySelectorAll('.language-card').forEach(card => {
            card.addEventListener('click', () => this.selectLanguage(card));
        });

        // Code input
        document.getElementById('code-input').addEventListener('input', (e) => {
            this.code = e.target.value;
            this.updateLineCount();
            this.updatePreview();
            this.updateNextButton();
        });

        // Context options - allow multiple selections
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.addEventListener('click', () => this.toggleContextOption(btn));
        });

        document.getElementById('context-input').addEventListener('input', (e) => {
            this.updateCustomContext();
        });

        // Format code button
        document.getElementById('format-code').addEventListener('click', () => this.formatCode());

        // Navigation buttons
        document.getElementById('next-to-context').addEventListener('click', () => this.goToStep('context'));
        document.getElementById('back-to-language').addEventListener('click', () => this.goToStep('language'));
        document.getElementById('back-to-code').addEventListener('click', () => this.goToStep('code'));
        document.getElementById('start-analysis').addEventListener('click', () => this.startAnalysis());

        // Chat
        document.getElementById('send-message').addEventListener('click', () => this.sendMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Export results
        document.getElementById('export-results').addEventListener('click', () => this.exportResults());

        // Other actions
        document.getElementById('clear-code').addEventListener('click', () => this.clearCode());
        document.getElementById('new-analysis').addEventListener('click', () => this.resetApp());
    }

    selectLanguage(card) {
        // Remove previous selection
        document.querySelectorAll('.language-card').forEach(c => c.classList.remove('selected'));
        
        // Add selection to clicked card
        card.classList.add('selected');
        
        // Store selected language
        this.selectedLanguage = card.dataset.lang;
        
        // Update file name
        const fileNames = {
            javascript: 'main.js',
            typescript: 'main.ts',
            python: 'main.py',
            java: 'Main.java',
            cpp: 'main.cpp',
            go: 'main.go',
            rust: 'main.rs',
            php: 'index.php'
        };
        
        document.getElementById('file-name').textContent = fileNames[this.selectedLanguage] || 'main.js';
        
        // Go to next step with animation
        setTimeout(() => this.goToStep('code'), 500);
    }

    goToStep(step) {
        // Hide all steps with animation
        document.querySelectorAll('.step').forEach(s => {
            s.style.animation = 'slideOutLeft 0.3s ease-in-out forwards';
        });
        
        // Show target step after animation
        setTimeout(() => {
            document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
            const targetStep = document.getElementById(`step-${step}`);
            targetStep.style.display = 'block';
            targetStep.style.animation = 'slideInRight 0.6s ease-out forwards';
            
            this.currentStep = step;
            this.updateHeader();
        }, 300);
    }

    updateHeader() {
        const status = document.querySelector('.status span');
        const statusDot = document.querySelector('.status-dot');
        
        const statuses = {
            language: { text: 'Select Language', color: 'var(--info)' },
            code: { text: 'Enter Code', color: 'var(--warning)' },
            context: { text: 'Add Context', color: 'var(--warning)' },
            analysis: { text: 'Analyzing', color: 'var(--primary)' },
            results: { text: 'Review Complete', color: 'var(--success)' }
        };
        
        const current = statuses[this.currentStep];
        status.textContent = current.text;
        statusDot.style.background = current.color;
    }

    updateLineCount() {
        const lines = this.code.split('\n').length;
        document.getElementById('line-count').textContent = `${lines} lines`;
    }

    updatePreview() {
        const preview = document.getElementById('code-preview');
        if (this.code.trim()) {
            preview.textContent = this.code;
        } else {
            preview.textContent = '// Your code will appear here...';
        }
    }

    updateNextButton() {
        const nextBtn = document.getElementById('next-to-context');
        nextBtn.disabled = !this.code.trim();
    }

    toggleContextOption(btn) {
        btn.classList.toggle('selected');
        this.updateContextArray();
    }

    updateContextArray() {
        this.context = [];
        document.querySelectorAll('.option-btn.selected').forEach(btn => {
            this.context.push(btn.dataset.context);
        });
    }

    updateCustomContext() {
        const customContext = document.getElementById('context-input').value.trim();
        if (customContext) {
            this.context.push('custom');
        }
    }

    formatCode() {
        if (!this.code.trim()) return;
        
        // Simple formatting based on language
        let formatted = this.code;
        
        switch (this.selectedLanguage) {
            case 'javascript':
            case 'typescript':
                formatted = this.formatJavaScript(this.code);
                break;
            case 'python':
                formatted = this.formatPython(this.code);
                break;
            case 'cpp':
            case 'java':
                formatted = this.formatCppJava(this.code);
                break;
        }
        
        document.getElementById('code-input').value = formatted;
        this.code = formatted;
        this.updatePreview();
        
        // Show success animation
        const formatBtn = document.getElementById('format-code');
        formatBtn.style.background = 'var(--success)';
        formatBtn.textContent = '✓ Formatted';
        setTimeout(() => {
            formatBtn.style.background = '';
            formatBtn.textContent = 'Format';
        }, 2000);
    }

    formatJavaScript(code) {
        // Basic JavaScript formatting
        return code
            .replace(/\s*{\s*/g, ' {\n    ')
            .replace(/;\s*/g, ';\n')
            .replace(/\n\s*\n/g, '\n')
            .split('\n')
            .map(line => line.trim())
            .join('\n');
    }

    formatPython(code) {
        // Basic Python formatting
        return code
            .replace(/:\s*/g, ':\n    ')
            .split('\n')
            .map(line => line.trim())
            .join('\n');
    }

    formatCppJava(code) {
        // Basic C++/Java formatting
        return code
            .replace(/\s*{\s*/g, ' {\n    ')
            .replace(/;\s*/g, ';\n')
            .replace(/\n\s*\n/g, '\n')
            .split('\n')
            .map(line => line.trim())
            .join('\n');
    }

    async startAnalysis() {
        this.goToStep('analysis');
        
        // Update thinking status with realistic messages
        const statuses = [
            'Initializing AI analysis...',
            'Parsing code structure...',
            'Analyzing syntax and grammar...',
            'Checking for security vulnerabilities...',
            'Reviewing performance patterns...',
            'Identifying potential bugs...',
            'Evaluating code style...',
            'Generating optimization suggestions...',
            'Creating detailed report...',
            'Finalizing recommendations...'
        ];
        
        let statusIndex = 0;
        const statusInterval = setInterval(() => {
            document.getElementById('thinking-status').textContent = statuses[statusIndex];
            statusIndex = (statusIndex + 1) % statuses.length;
        }, 800);
        
        // Update progress with realistic increments
        const progressFill = document.getElementById('progress-fill');
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 8 + 2;
            if (progress > 95) progress = 95;
            progressFill.style.width = `${progress}%`;
        }, 600);
        
        try {
            // Call API with context
            const response = await fetch(`${this.apiBase}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: this.code,
                    language: this.selectedLanguage,
                    userId: this.userId,
                    sessionId: this.sessionId,
                    context: this.context.join(', ')
                })
            });
            
            if (response.ok) {
                this.analysisResults = await response.json();
                
                // Complete progress
                clearInterval(statusInterval);
                clearInterval(progressInterval);
                progressFill.style.width = '100%';
                document.getElementById('thinking-status').textContent = 'Analysis complete!';
                
                // Show results after delay
                setTimeout(() => this.showResults(), 1000);
            } else {
                throw new Error('Analysis failed');
            }
        } catch (error) {
            console.error('Analysis error:', error);
            clearInterval(statusInterval);
            clearInterval(progressInterval);
            document.getElementById('thinking-status').textContent = 'Analysis failed. Please try again.';
        }
    }

    showResults() {
        this.goToStep('results');
        this.displayResults();
        this.highlightCode();
    }

    displayResults() {
        const summary = document.getElementById('results-summary');
        const issuesList = document.getElementById('issues-list');
        
        if (!this.analysisResults || !this.analysisResults.suggestions.length) {
            summary.innerHTML = '<div class="summary-item low">No issues found!</div>';
            issuesList.innerHTML = '<div class="no-issues">🎉 Your code looks great!</div>';
            return;
        }
        
        // Create summary
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        this.analysisResults.suggestions.forEach(suggestion => {
            counts[suggestion.severity]++;
        });
        
        let summaryHtml = '';
        if (counts.critical > 0) summaryHtml += `<div class="summary-item critical">${counts.critical} Critical</div>`;
        if (counts.high > 0) summaryHtml += `<div class="summary-item high">${counts.high} High</div>`;
        if (counts.medium > 0) summaryHtml += `<div class="summary-item medium">${counts.medium} Medium</div>`;
        if (counts.low > 0) summaryHtml += `<div class="summary-item low">${counts.low} Low</div>`;
        
        summary.innerHTML = summaryHtml;
        
        // Create issues list with better formatting
        issuesList.innerHTML = '';
        this.analysisResults.suggestions.forEach((suggestion, index) => {
            const issueDiv = document.createElement('div');
            issueDiv.className = 'issue-item';
            issueDiv.dataset.severity = suggestion.severity;
            issueDiv.style.animationDelay = `${index * 0.1}s`;
            
            // Clean up the message and explanation
            const cleanMessage = this.cleanMessage(suggestion.message);
            const cleanExplanation = this.cleanExplanation(suggestion.explanation);
            
            issueDiv.innerHTML = `
                <div class="issue-header">
                    <span class="issue-type ${suggestion.type}">${suggestion.type}</span>
                    <span class="issue-severity ${suggestion.severity}">${suggestion.severity}</span>
                </div>
                <div class="issue-title">${cleanMessage}</div>
                <div class="issue-description">${cleanExplanation}</div>
                ${suggestion.line ? `<div class="issue-line">Line ${suggestion.line}</div>` : ''}
                ${suggestion.suggestion ? `<div class="issue-suggestion"><strong>Suggested Fix:</strong> ${suggestion.suggestion}</div>` : ''}
            `;
            
            issuesList.appendChild(issueDiv);
        });
        
        // Setup filter tabs
        this.setupFilterTabs();
    }

    cleanMessage(message) {
        // Remove markdown formatting and clean up the message
        return message
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/^#+\s*/, '')
            .trim();
    }

    cleanExplanation(explanation) {
        // Clean up the explanation and remove redundant text
        return explanation
            .replace(/This (security|performance|style|bug|optimization) issue has been identified as (low|medium|high|critical) priority\.\s*/gi, '')
            .replace(/(Security|Performance|Style|Bug|Optimization) issues should be addressed immediately to prevent potential vulnerabilities\./gi, '')
            .replace(/(Security|Performance|Style|Bug|Optimization) issues can impact user experience and should be optimized\./gi, '')
            .replace(/(Security|Performance|Style|Bug|Optimization) issues improve code readability and maintainability\./gi, '')
            .replace(/(Security|Performance|Style|Bug|Optimization) issues could cause runtime errors and should be fixed before deployment\./gi, '')
            .replace(/(Security|Performance|Style|Bug|Optimization) issues can improve code efficiency and maintainability\./gi, '')
            .trim();
    }

    setupFilterTabs() {
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Filter issues
                const filter = tab.dataset.filter;
                const issues = document.querySelectorAll('.issue-item');
                
                issues.forEach(issue => {
                    if (filter === 'all' || issue.dataset.severity === filter) {
                        issue.style.display = 'block';
                        issue.style.animation = 'slideInUp 0.3s ease-out forwards';
                    } else {
                        issue.style.display = 'none';
                    }
                });
            });
        });
    }

    highlightCode() {
        const codeBlock = document.getElementById('highlighted-code');
        
        // Add line numbers and highlight issues
        const lines = this.code.split('\n');
        const numberedLines = lines.map((line, index) => {
            const lineNumber = index + 1;
            const hasIssue = this.analysisResults.suggestions.some(s => s.line === lineNumber);
            const issueClass = hasIssue ? 'has-issue' : '';
            return `<div class="code-line ${issueClass}"><span class="line-number">${lineNumber}</span><span class="line-content">${line || ' '}</span></div>`;
        }).join('');
        
        codeBlock.innerHTML = numberedLines;
        
        // Generate fixed code
        this.generateFixedCode();
    }

    generateFixedCode() {
        // Generate a fixed version of the code based on suggestions
        let fixedCode = this.code;
        
        this.analysisResults.suggestions.forEach(suggestion => {
            if (suggestion.suggestion && suggestion.line) {
                // Apply fixes based on suggestions
                const lines = fixedCode.split('\n');
                const lineIndex = suggestion.line - 1;
                
                if (lineIndex >= 0 && lineIndex < lines.length) {
                    // Apply common fixes
                    if (suggestion.type === 'style' && suggestion.message.includes('typo')) {
                        lines[lineIndex] = lines[lineIndex].replace('inlud', 'include');
                        lines[lineIndex] = lines[lineIndex].replace('namespae', 'namespace');
                    }
                }
                
                fixedCode = lines.join('\n');
            }
        });
        
        this.fixedCode = fixedCode;
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message
        this.addChatMessage(message, 'user');
        input.value = '';
        
        // Add thinking message
        const thinkingId = this.addChatMessage('Thinking...', 'assistant');
        
        try {
            // Call chat API
            const response = await fetch(`${this.apiBase}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    userId: this.userId,
                    sessionId: this.sessionId,
                    context: this.analysisResults
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                document.getElementById(thinkingId).querySelector('.message-content').textContent = data.response;
            } else {
                throw new Error('Chat failed');
            }
        } catch (error) {
            document.getElementById(thinkingId).querySelector('.message-content').textContent = 'Sorry, I encountered an error. Please try again.';
        }
    }

    addChatMessage(content, role) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageId = 'msg-' + Date.now();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.id = messageId;
        messageDiv.style.animation = 'slideInUp 0.3s ease-out forwards';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${role === 'user' ? 'U' : 'H'}</div>
            <div class="message-content">${content}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return messageId;
    }

    exportResults() {
        if (!this.analysisResults) return;
        
        const exportData = {
            timestamp: new Date().toISOString(),
            language: this.selectedLanguage,
            code: this.code,
            fixedCode: this.fixedCode,
            issues: this.analysisResults.suggestions,
            summary: this.analysisResults.summary
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `helix-review-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show success animation
        const exportBtn = document.getElementById('export-results');
        exportBtn.style.background = 'var(--success)';
        exportBtn.textContent = '✓ Exported';
        setTimeout(() => {
            exportBtn.style.background = '';
            exportBtn.textContent = 'Export Results';
        }, 2000);
    }

    clearCode() {
        document.getElementById('code-input').value = '';
        this.code = '';
        this.updateLineCount();
        this.updatePreview();
        this.updateNextButton();
    }

    resetApp() {
        this.currentStep = 'language';
        this.selectedLanguage = null;
        this.code = '';
        this.context = [];
        this.analysisResults = null;
        this.fixedCode = '';
        
        // Reset UI
        document.querySelectorAll('.language-card').forEach(c => c.classList.remove('selected'));
        document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('context-input').value = '';
        document.getElementById('chat-messages').innerHTML = '';
        
        this.goToStep('language');
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutLeft {
        to { transform: translateX(-100%); opacity: 0; }
    }
    
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .issue-item {
        animation: slideInUp 0.5s ease-out forwards;
        opacity: 0;
        transform: translateY(20px);
    }
    
    .issue-suggestion {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.2);
        border-radius: var(--radius-sm);
        padding: 1rem;
        margin-top: 0.75rem;
        font-size: 0.875rem;
    }
`;
document.head.appendChild(style);

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HelixApp();
});