# AI Code Review Assistant

A code review tool that uses AI to analyze your code and suggest improvements. Built entirely on Cloudflare's platform.

## What This Does

You paste code into a web interface, select the programming language, and get back a detailed analysis covering:
- Security vulnerabilities
- Performance issues  
- Code style problems
- Potential bugs
- Optimization suggestions

The AI remembers your previous conversations and provides increasingly personalized feedback.

## How It Works

### The User Experience
1. Open the web page
2. Paste your code in the text area
3. Select the programming language (JavaScript, Python, etc.)
4. Click "Review Code"
5. Get back categorized suggestions with explanations
6. Chat with the AI for follow-up questions

### The Technical Flow
1. **Frontend** (Cloudflare Pages) sends your code to the backend
2. **Backend** (Cloudflare Workers) receives the request
3. **Durable Object** manages your session and calls the AI
4. **Llama 3.3** (Cloudflare Workers AI) analyzes your code
5. **Database** (Cloudflare D1) stores the conversation
6. **Results** are sent back and displayed in the interface

## Architecture Overview

This uses Cloudflare's entire stack:

- **Pages**: Hosts the web interface
- **Workers**: Runs the API backend  
- **Workers AI**: Provides Llama 3.3 for code analysis
- **Durable Objects**: Manages user sessions and state
- **D1**: Stores conversation history and user data

## Setup Instructions

### Prerequisites
- Node.js installed on your computer
- A Cloudflare account (free tier works fine)

### Step 1: Install Tools
```bash
npm install -g wrangler
```

### Step 2: Create Cloudflare Account
1. Go to https://dash.cloudflare.com/sign-up
2. Create a free account
3. Run `wrangler login` and follow the prompts

### Step 3: Install Dependencies
```bash
cd AI-Assignment-Project
npm install
```

### Step 4: Create Database
```bash
wrangler d1 create code-review-db
```
This will output a database ID. Copy it.

### Step 5: Update Configuration
Open `wrangler.toml` and replace `your-database-id-here` with the actual database ID from step 4.

### Step 6: Set Up Database Tables
```bash
wrangler d1 migrations apply code-review-db
```

### Step 7: Deploy
```bash
wrangler deploy
```

This deploys the backend. You'll get a URL like `https://your-app.your-subdomain.workers.dev`

### Step 8: Deploy Frontend
```bash
wrangler pages deploy src/pages
```

This deploys the web interface. You'll get a URL like `https://your-app.pages.dev`

### Step 9: Connect Frontend to Backend
The frontend is already configured to connect to the deployed backend. If you need to change the backend URL, edit `src/pages/app.js` and update:
```javascript
this.apiBase = 'https://your-app.your-subdomain.workers.dev/api';
```

Then redeploy the frontend:
```bash
wrangler pages deploy src/pages --project-name=cf-ai-code-review-assistant
```

## Testing the Application

### Live Demo
**Frontend**: `https://76ef82a8.cf-ai-code-review-assistant.pages.dev`  
**Backend**: `https://cf-ai-code-review-assistant.sadiraju06.workers.dev`

### How to Test
1. Open the Frontend URL above
2. You'll see sample JavaScript code already loaded
3. Click "Review Code" to test the AI analysis
4. Try pasting your own code
5. Use the chat feature to ask follow-up questions

## How the AI Integration Works

The app uses Cloudflare's built-in Llama 3.3 model. No API keys needed - it's part of your Cloudflare account.

When you submit code, the system:
1. Loads your previous conversation history
2. Sends your code + conversation context to Llama 3.3
3. Gets back structured suggestions
4. Stores the conversation for future context

## Database Schema

The database stores:
- **user_sessions**: Basic session info
- **conversation_history**: All chat messages
- **code_reviews**: Review metadata
- **code_suggestions**: Individual AI suggestions
- **user_preferences**: User settings

## File Structure

```
src/
├── workers/
│   ├── api.ts              # Main API endpoints
│   └── review-agent.ts     # AI processing logic
├── pages/
│   ├── index.html          # Web interface
│   ├── styles.css          # Styling
│   └── app.js              # Frontend JavaScript
└── types/
    └── interfaces.ts       # TypeScript definitions
```

## API Endpoints

- `POST /api/review` - Submit code for analysis
- `POST /api/session` - Create new user session  
- `GET /api/session` - Get session info
- `GET /api/health` - Health check

## Troubleshooting

**"AI service unavailable"**: This usually means the Workers AI isn't enabled on your account. Check your Cloudflare dashboard.

**Database errors**: Make sure you ran the migrations and updated the database ID in wrangler.toml.

**Frontend not connecting**: Verify the API URL in app.js matches your deployed Workers URL.

## Development

To run locally:
```bash
wrangler dev
```

This starts a local development server at `http://localhost:8787`

## Deployment Checklist

- [ ] Cloudflare account created
- [ ] Wrangler CLI installed and logged in
- [ ] Dependencies installed (`npm install`)
- [ ] Database created (`wrangler d1 create code-review-db`)
- [ ] Database ID updated in wrangler.toml
- [ ] Migrations applied (`wrangler d1 migrations apply code-review-db`)
- [ ] Backend deployed (`wrangler deploy`)
- [ ] Frontend deployed (`wrangler pages deploy src/pages`)
- [ ] API URL updated in frontend code
- [ ] Frontend redeployed with correct API URL

## What Makes This Different

This isn't just a demo - it's a fully functional application that:
- Actually analyzes code using real AI
- Remembers conversation history
- Provides actionable suggestions
- Scales automatically on Cloudflare's network
- Costs almost nothing to run

The AI gets smarter over time as it learns your coding patterns and preferences.