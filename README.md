# 🤖 Enhanced AI Chat Agent

### Method 1: One-Click Deployment

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/iamask/cloudflare-agent)

A powerful AI-powered chat agent built on Cloudflare's Agent platform, powered by [`agents`](https://www.npmjs.com/package/agents). This project provides a comprehensive foundation for creating interactive chat experiences with AI, complete with a modern UI and extensive tool integration capabilities.

## Core Features

- 💬 Interactive chat interface with AI
- 🛠️ **Extended tool system** with human-in-the-loop confirmation
- 📅 Advanced task scheduling (one-time, delayed, and recurring via cron)
- 🌓 Dark/Light theme support
- ⚡️ Real-time streaming responses
- 🔄 State management and chat history
- 🎨 Modern, responsive UI
- 🛑 Stop generation functionality
- 📝 Auto-resizing input with markdown support
- 🔧 **11+ built-in tools** for various use cases

## Available Tools

This project includes the following tools:

### 🌤️ Weather & Time

- **`getWeatherInformation`** - Get real-time weather data for any city
- **`getLocalTime`** - Get current local time for any location worldwide

### 📅 Task Management

- **`scheduleTask`** - Schedule tasks for later execution (one-time, delayed, or recurring)
- **`sendWebhook`** - Send messages to webhook endpoints (e.g., Google Chat)

### 🔍 Information & Search

- **`searchDocs`** - Search Cloudflare documentation using AutoRAG
- **`searchCountry`** - Get detailed country information using REST Countries API
- **`searchPokemon`** - Search Pokémon details by name or ID using PokéAPI

### 🎨 Content Generation

- **`generateImage`** - Generate images from text descriptions using Cloudflare Workers AI

### 🔧 Cloudflare Integration

- **`callDoWorker`** - Call other Cloudflare Workers via doWorker binding
- **`callgraphqlWorker`** - Execute GraphQL queries and operations
- **`addCloudflareCustomRule`** - Create custom security rules for Cloudflare

### 📋 Task Management

- **`getScheduledTasks`** - List all scheduled tasks
- **`cancelScheduledTask`** - Cancel a scheduled task by ID

## Prerequisites

- Cloudflare account
- OpenAI API key
- Optional: Google Chat webhook URL for webhook functionality

## Quick Start

1. Clone this repository:

```bash
git clone https://github.com/iamask/cloudflare-agent.git
cd cloudflare-agent
```

2. Install dependencies:

```bash
npm install
```

3. Set up your environment:

Create a `.dev.vars` file:

```env
OPENAI_API_KEY=your_openai_api_key
GOOGLE_CHAT_WEBHOOK_URL=your_webhook_url_optional
CLOUDFLARE_API_TOKEN=your_cloudflare_token_optional
CLOUDFLARE_ZONE_ID=your_zone_id_optional
CLOUDFLARE_RULESET_ID=your_ruleset_id_optional
```

4. Run locally:

```bash
npm start
```

5. Deploy:

```bash
npm run deploy
```

## Project Structure

```
├── src/
│   ├── app.tsx                    # Enhanced chat UI implementation
│   ├── server.ts                  # Chat agent logic
│   ├── tools.ts                   # Extended tool definitions (11+ tools)
│   ├── utils.ts                   # Helper functions
│   ├── styles.css                 # UI styling
│   └── components/
│       ├── textarea/              # Auto-resizing textarea component
│       ├── memoized-markdown.tsx  # Markdown rendering component
│       └── tool-invocation-card/  # Enhanced tool visualization
```

## Tool Usage Examples

### Weather Information

```
"Get the weather in Tokyo"
"Show me the current weather conditions in New York"
```

### Local Time

```
"What time is it in London?"
"Get the local time in Sydney"
```

### Country Information

```
"Tell me about Japan"
"Search for information about Brazil"
```

### Pokémon Details

```
"Get details for Pikachu"
"Search for Pokémon with ID 25"
```

### Image Generation

```
"Generate an image of a sunset over mountains"
"Create a picture of a futuristic city"
```

### Cloudflare Custom Rules

```
"Create a rule to block requests with user agent 'BadBot'"
"Add a rule to challenge requests with bot score less than 20 from outside India"
```

## Customization Guide

### Adding New Tools

Add new tools in `tools.ts` using the tool builder:

```typescript
// Example of a tool that requires confirmation
const searchDatabase = tool({
  description: "Search the database for user records",
  parameters: z.object({
    query: z.string(),
    limit: z.number().optional(),
  }),
  // No execute function = requires confirmation
});

// Example of an auto-executing tool
const getCurrentTime = tool({
  description: "Get current server time",
  parameters: z.object({}),
  execute: async () => new Date().toISOString(),
});
```

To handle tool confirmations, add execution functions to the `executions` object:

```typescript
export const executions = {
  searchDatabase: async ({
    query,
    limit,
  }: {
    query: string;
    limit?: number;
  }) => {
    // Implementation for when the tool is confirmed
    const results = await db.search(query, limit);
    return results;
  },
  // Add more execution handlers for other tools that require confirmation
};
```

Tools can be configured in two ways:

1. With an `execute` function for automatic execution
2. Without an `execute` function, requiring confirmation and using the `executions` object to handle the confirmed action

### Modifying the UI

The chat interface is built with React and can be customized in `app.tsx`:

- Modify the theme colors in `styles.css`
- Add new UI components in the chat container
- Customize message rendering and tool confirmation dialogs
- Add new controls to the header

## Example Use Cases

### 1. Customer Support Agent

Add tools for:

- Ticket creation/lookup
- Order status checking
- Product recommendations
- FAQ database search

### 2. Development Assistant

Integrate tools for:

- Code linting
- Git operations
- Documentation search
- Dependency checking

### 3. Data Analysis Assistant

Build tools for:

- Database querying
- Data visualization
- Statistical analysis
- Report generation

### 4. Personal Productivity Assistant

Implement tools for:

- Task scheduling with flexible timing options
- One-time, delayed, and recurring task management
- Task tracking with reminders
- Email drafting
- Note taking

### 5. Scheduling Assistant

Build tools for:

- One-time event scheduling using specific dates
- Delayed task execution (e.g., "remind me in 30 minutes")
- Recurring tasks using cron patterns
- Task payload management
- Flexible scheduling patterns

Each use case can be implemented by:

1. Adding relevant tools in `tools.ts`
2. Customizing the UI for specific interactions
3. Extending the agent's capabilities in `server.ts`
4. Adding any necessary external API integrations

## Learn More

- [`agents`](https://github.com/cloudflare/agents/blob/main/packages/agents/README.md)
- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## License

MIT
