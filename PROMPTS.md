# AI Prompts Used in Development

This document contains the prompts I used while working with an AI assistant to build this Cloudflare AI application.

```
I'm applying for Cloudflare's Software Engineering Internship and need to build an AI-powered application. Looking at their requirements:

1. LLM integration (they recommend Llama 3.3 on Workers AI)
2. Workflow/coordination (Workflows, Workers or Durable Objects)
3. User input via chat or voice (Pages or Realtime)
4. Memory or state

I've decided to build a Smart Code Review Assistant - it solves a real problem developers face and showcases all their platform capabilities. I already have the repo set up on GitHub Desktop.

Here's my plan:
1. Pick the best idea and we'll work on it together
2. Create a technical implementation plan for all 4 components
3. Choose the right coding language and deployment strategy
4. I'll handle the GitHub setup and final submission
5. We'll document everything as we go
6. I'll manage the overall project direction

Let's start building this.
```

```
I need to verify our memory implementation is actually working correctly. Looking at the code, I want to make sure we're not just storing conversation history but actively using it to improve AI responses.

Also, I need to understand the deployment process better:
- Is the SQL schema automatically deployed through Cloudflare?
- Do I need to create a new Cloudflare account or can I use my existing one?
- Some of the npm installs failed - what's the proper setup process?

I also want you to rewrite the README.md file. Make it much clearer about how everything works and how it's implemented. It should sound like it was written by a developer who actually understands the architecture, not like AI-generated content.

And can you explain why project_summary.md and prompts.md exist? Do we actually need both?
```

```
I'm trying to set up the workers.dev subdomain but I'm not seeing the exact "Workers and Pages" option in my Cloudflare dashboard. I see "Workers for Platforms" but that requires payment.

Can you explain in detail how to create the workers.dev subdomain? I want to understand the complete process and what I might be missing in the dashboard interface.
```

```
Perfect, I've given Wrangler access to my Cloudflare account. What's the next step in the deployment process?
```

```
I deployed the application and tested it, but I'm getting errors when I try to use it:

Failed to load resource: the server responded with a status of 405
Failed to create session
Review error: SyntaxError: Failed to execute 'json' on 'Response': Unexpected end of JSON input

The backend seems to be responding to direct API calls, but the frontend can't connect properly. Let me analyze what's happening and make sure we're following all the Cloudflare assignment requirements correctly.

I need you to verify:
1. Are we meeting all the assignment requirements?
2. Is the deployment actually working as expected?
3. Can other developers follow our README instructions and get the same results?
4. Are the instructions accurate for someone else to reproduce this?

I want this to be production-ready, not just a demo. The application should be fully functional with proper error handling.
```

```
The current implementation has several critical issues that need immediate attention. The frontend design is completely inadequate and needs a complete redesign using modern UI principles. I need you to implement a professional, dark-themed interface with proper typography, spacing, and visual hierarchy.

More importantly, the AI code analysis is producing useless generic responses instead of actionable insights. The current output shows meaningless line numbers without explaining what's wrong or how to fix it. I need you to completely rewrite the AI response parsing to extract meaningful issues, provide specific explanations, and include suggested fixes.

Implement a comprehensive solution that includes:
1. Complete frontend redesign with modern CSS and responsive layout
2. Intelligent AI response parsing that extracts real issues and solutions
3. Proper error categorization and severity levels
4. Clear, actionable feedback for developers

This needs to be production-quality, not a basic demo.
```

