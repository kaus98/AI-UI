# AI-UI (ag-aiEndpoints)

A comprehensive, local-first AI chat interface and OpenAI-compatible API gateway for Large Language Models (LLMs). This project provides a unified interface for multiple AI endpoints, supporting various authentication methods, streaming responses, web search capabilities, and both server-based and static deployments.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technologies](#technologies)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Deployment Options](#deployment-options)
- [API Reference](#api-reference)
- [Web Search System](#web-search-system)
- [Tools and Capabilities](#tools-and-capabilities)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

AI-UI is a flexible chat interface that connects to multiple AI service providers through a single, unified interface. It supports both a server-based backend for local development and a static site deployment for cloud hosting. The system is designed to be local-first, storing configurations and chat history locally while providing seamless integration with various AI providers.

### Key Capabilities

- **Multi-Endpoint Support**: Connect to multiple AI providers simultaneously
- **Unified API**: Single API endpoint for all configured services
- **Flexible Authentication**: Support for API keys and OAuth 2.0 client credentials
- **Streaming Responses**: Real-time streaming of AI responses
- **Web Search Integration**: Built-in web search with multiple engines
- **Image Upload Support**: Vision capabilities for compatible models
- **Model Caching**: Efficient caching of model lists
- **Cost Tracking**: Token cost calculation and tracking
- **Chat Management**: Full chat history with folders, tags, and organization
- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile devices

## Features

### Core Features

- **Multi-Endpoint Management**
  - Add, edit, and delete AI service endpoints
  - Switch between endpoints seamlessly
  - Endpoint-specific configuration (models, system prompts, costs)
  - OAuth 2.0 client credentials flow support

- **Chat Interface**
  - Real-time streaming responses
  - Markdown rendering with syntax highlighting
  - Code block display with copy functionality
  - Image attachment support for vision models
  - Chat history persistence
  - Folder organization (General, Work, Personal, Archive)
  - Chat tagging and search
  - Pin important chats
  - Branch chat conversations
  - Incognito mode for unsaved chats
  - Auto-generated chat titles
  - Dark/Light theme toggle

- **Model Management**
  - Automatic model discovery from endpoints
  - Model caching for faster loading
  - Force refresh model lists
  - Vision capability detection
  - Default model per endpoint
  - Model selection dropdown

- **Tools Integration**
  - Web search across multiple engines
  - URL content fetching
  - Wikipedia search and summarization
  - Tool enable/disable per chat
  - Automatic tool calling by AI models

- **Search System**
  - Multiple search engines (Bing, DuckDuckGo, Yahoo)
  - Automatic engine selection based on performance
  - Selenium fallback for JavaScript-heavy pages
  - Intelligent wait detection
  - Request jitter for human-like behavior
  - User agent rotation
  - Performance tracking and scoring
  - Comprehensive logging

### Advanced Features

- **Unified API Gateway**
  - Single API key for all endpoints
  - OpenAI-compatible endpoints
  - Request routing based on model selection
  - Streaming and non-streaming modes
  - Tool calling support

- **Cloudflare Worker Integration**
  - Edge deployment option
  - CORS proxy for static sites
  - Request forwarding
  - Environment-based configuration

- **Authentication**
  - API key authentication
  - OAuth 2.0 client credentials flow
  - Token caching and refresh
  - Secure credential storage
  - Per-endpoint authentication

- **Cost Management**
  - Input/output cost per 1M tokens
  - Cost tracking per endpoint
  - Configurable pricing models
  - Usage statistics

- **Accessibility**
  - ARIA labels and roles
  - Keyboard navigation
  - Screen reader support
  - Skip to content links
  - Focus management
  - Semantic HTML

## Technologies

### Backend

- **Node.js**: JavaScript runtime for server-side logic
- **Express.js**: Web framework for API routing and middleware
- **CORS**: Cross-Origin Resource Sharing support
- **Selenium WebDriver**: Browser automation for web scraping
- **Cloudflare Workers**: Edge computing platform (optional)

### Frontend

- **Vanilla JavaScript**: No framework dependencies
- **Marked.js**: Markdown parsing and rendering
- **Highlight.js**: Code syntax highlighting
- **EasyMDE**: Markdown editor (optional)
- **Font Awesome**: Icon library

### Utilities

- **Crypto**: Cryptographic functions for secure key generation
- **File System**: Local file storage for configuration and history
- **Fetch API**: HTTP client for API requests
- **EventSource**: Server-Sent Events for streaming

### Development Tools

- **npm**: Package manager
- **Wrangler**: Cloudflare Workers CLI
- **Git**: Version control

## Project Structure

```
AI-UI/
├── cloudflare-worker/          # Cloudflare Worker deployment
│   ├── index.js               # Worker entry point
│   └── wrangler.toml          # Worker configuration
│
├── data/                       # Local data storage
│   ├── chats.json             # Chat history
│   └── models.json            # Cached model lists
│
├── docs/                       # Static site deployment
│   ├── 404.html               # Custom 404 page
│   ├── .nojekyll              # GitHub Pages bypass
│   ├── README.md              # Static site documentation
│   ├── SEARCH_CHANGES.md      # Search system changelog
│   ├── SEARCH_QUICK_REFERENCE.md  # Search quick reference
│   ├── SEARCH_SYSTEM.md       # Search system documentation
│   ├── app.js                 # Frontend application logic
│   ├── index.html             # Main HTML page
│   └── styles.css             # Stylesheet
│
├── logs/                       # Application logs
│
├── public/                     # Public static files (server mode)
│   ├── app.js                 # Frontend application logic
│   ├── favicon.png            # Site favicon
│   ├── index.html             # Main HTML page
│   └── styles.css             # Stylesheet
│
├── routes/                     # API route handlers
│   ├── api.js                 # Main API endpoints
│   └── unified.js             # Unified API gateway
│
├── scripts/                    # Utility scripts
│   └── generate_models_md.js  # Model documentation generator
│
├── tests/                      # Test suite
│   ├── compare-engines.js     # Search engine comparison
│   ├── search.test.js          # Search system tests
│   ├── test-google.js         # Google search tests
│   ├── test-logging.js        # Logging tests
│   ├── test-selenium.js       # Selenium tests
│   └── test-yahoo.js          # Yahoo search tests
│
├── utils/                      # Utility modules
│   ├── helpers.js             # Configuration and data helpers
│   ├── logger.js              # Logging utilities
│   ├── search.js              # Search system entry point
│   ├── search/                # Search engine implementations
│   │   ├── bing.js           # Bing search
│   │   ├── duckduckgo.js     # DuckDuckGo search
│   │   ├── google.js         # Google search
│   │   ├── helpers.js        # Search helper functions
│   │   ├── index.js          # Search engine registry
│   │   ├── logger.js         # Search-specific logging
│   │   ├── selenium.js       # Selenium web scraping
│   │   └── yahoo.js          # Yahoo search
│   └── tools.js               # Tool execution logic
│
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
├── .github/                    # GitHub configuration
│   └── workflows/
│       └── deploy.yml         # Deployment workflow
├── .vscode/                    # VS Code configuration
├── LICENSE                     # License file
├── README.md                   # Main documentation
├── blog.md                     # Blog content
├── config.json                 # Application configuration
├── package.json                # Project dependencies
├── server.js                   # Main server entry point
└── validate_system.js          # System validation script
```

### Directory Descriptions

#### cloudflare-worker/
Contains the Cloudflare Worker implementation for edge deployment. This allows the application to run on Cloudflare's global network, providing low-latency responses and CORS proxying capabilities.

#### data/
Local storage directory for application data. Contains chat history and cached model lists. This directory is created automatically on first run.

#### docs/
Static site version of the application, suitable for deployment on GitHub Pages or any static hosting service. Contains all HTML, CSS, and JavaScript needed to run the application entirely in the browser.

#### logs/
Application log files for debugging and monitoring. Logs are organized by date and include request logs, client logs, and server logs.

#### public/
Public static files served by the Node.js server. This is the server-based version of the application, which provides API endpoints and backend functionality.

#### routes/
API route handlers that define the application's REST API. Includes the main API endpoints and the unified API gateway for external clients.

#### scripts/
Utility scripts for various tasks, such as generating documentation or performing maintenance operations.

#### tests/
Test suite for validating application functionality. Includes tests for the search system, logging, and individual search engines.

#### utils/
Utility modules that provide shared functionality across the application. Includes configuration management, logging, search system, and tool execution.

## Installation

### Prerequisites

Before installing AI-UI, ensure you have the following software installed on your system:

#### Required Software

- **Node.js**: Version 14.0.0 or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`
  - Recommended: Use LTS (Long Term Support) version for stability

- **npm**: Comes bundled with Node.js
  - Verify installation: `npm --version`
  - Update to latest: `npm install -g npm@latest`

- **Git**: Version control system (optional but recommended)
  - Download from [git-scm.com](https://git-scm.com/)
  - Verify installation: `git --version`

#### Optional Software

- **Python**: Required for Selenium web scraping (if using search features)
  - Version 3.7 or higher
  - Download from [python.org](https://python.org/)
  - Verify installation: `python --version`

- **Chrome Browser**: Required for Selenium WebDriver
  - Download from [chrome.com](https://www.google.com/chrome/)
  - Used for web scraping and search functionality

### Step-by-Step Installation

#### Step 1: Obtain the Project

**Option A: Clone via Git (Recommended)**
```bash
# Clone the repository
git clone <repository-url>
cd AI-UI
```

**Option B: Download ZIP**
1. Download the project as a ZIP file from the repository
2. Extract the ZIP file to your desired location
3. Open a terminal/command prompt in the extracted directory

#### Step 2: Install Node.js Dependencies

```bash
# Install all required packages
npm install
```

This will install the following dependencies:
- `express` - Web framework
- `cors` - CORS middleware
- `selenium-webdriver` - Browser automation
- `serve-favicon` - Favicon serving

**Troubleshooting Installation Issues:**

If you encounter errors during installation:
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and package-lock.json, then retry
- Use a different npm registry: `npm install --registry=https://registry.npmjs.org/`
- Check your internet connection
- Ensure you have write permissions in the directory

#### Step 3: Verify Installation

```bash
# Run the test suite to verify everything is working
npm test
```

If tests pass, your installation is successful. If tests fail:
- Check that all dependencies are installed
- Ensure Node.js version is 14 or higher
- Review error messages in the terminal
- Check the logs directory for detailed error information

#### Step 4: Configure Environment Variables (Optional)

Create a `.env` file in the project root directory:

```bash
# Copy the example file
cp .env.example .env
```

Edit the `.env` file with your preferred settings:

```env
# Server Configuration
PORT=3001

# Default OpenAI Configuration (optional)
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1

# TLS Configuration
# Set to 'false' to enforce TLS certificate verification
ALLOW_INSECURE_TLS=true

# Proxy Configuration (optional)
# Used for CORS proxying or Cloudflare Workers
CLOUDFLARE_PROXY_BASE_URL=
PROXY_BASE_URL=
```

**Environment Variable Descriptions:**

- `PORT`: Port number for the server (default: 3001)
- `OPENAI_API_KEY`: Default OpenAI API key (optional, can be configured in UI)
- `OPENAI_BASE_URL`: Default OpenAI API endpoint (optional)
- `ALLOW_INSECURE_TLS`: Allow self-signed certificates (default: true)
- `CLOUDFLARE_PROXY_BASE_URL`: Cloudflare Worker URL for proxying
- `PROXY_BASE_URL`: Generic proxy URL for requests

#### Step 5: Initialize Directories

The application will automatically create necessary directories on first run:
- `data/` - Stores chat history and cached models
- `logs/` - Stores application logs

You can manually create them if needed:
```bash
mkdir data
mkdir logs
```

#### Step 6: Start the Server

```bash
# Start the server in normal mode
npm start

# Or start in development mode with auto-reload
npm run dev

# Or start in debug mode
npm run debug
```

**Expected Output:**
```
Server running at http://localhost:3001
WARNING: TLS certificate verification is disabled for outbound HTTPS. Set ALLOW_INSECURE_TLS=false to enable it.
```

#### Step 7: Access the Application

1. Open your web browser
2. Navigate to: `http://localhost:3001`
3. You should see the AI-UI interface

**If the page doesn't load:**
- Check that the server is running (look for "Server running" message)
- Verify the port is correct (default: 3001)
- Check if another application is using port 3001
- Try a different port: `PORT=3002 npm start`
- Check your firewall settings

### Post-Installation Setup

#### Step 1: Configure Your First Endpoint

1. Click the **Settings** button (gear icon) in the top-right corner
2. Click **+ Add Endpoint** in the Endpoints section
3. Fill in the endpoint details:

**For OpenAI:**
- **Name**: OpenAI
- **Base URL**: https://api.openai.com/v1
- **Auth Type**: API Key
- **API Key**: Your OpenAI API key (sk-...)
- **Default Model**: gpt-4o-mini (or your preferred model)

**For Groq:**
- **Name**: Groq
- **Base URL**: https://api.groq.com/openai/v1
- **Auth Type**: API Key
- **API Key**: Your Groq API key
- **Default Model**: llama3-70b-8192

**For Local Models (Ollama):**
- **Name**: Ollama
- **Base URL**: http://localhost:11434
- **Auth Type**: API Key (leave blank)
- **Default Model**: llama2

4. Click **Save**

#### Step 2: Select and Refresh Models

1. Select your newly added endpoint from the dropdown in the header
2. Click the **Refresh Models** button (circular arrow icon)
3. Wait for the model list to populate
4. Select your preferred model from the model dropdown

#### Step 3: Test the Configuration

1. Type a simple message in the chat input
2. Click the send button (or press Enter)
3. You should see a streaming response from the AI

If you encounter errors:
- Check the browser console for error messages
- Review the logs in the `logs/` directory
- Verify your API key is correct
- Ensure the endpoint URL is accessible
- Check your internet connection

### Alternative Installation Methods

#### Using Docker (Future)

Docker support is planned but not yet implemented. This will provide:
- Containerized environment
- Consistent dependencies
- Easy deployment
- Isolation from host system

#### Using NPM Global Install (Future)

Global npm installation is planned for easier access:
```bash
npm install -g ai-ui
ai-ui start
```

### Upgrading

To upgrade to the latest version:

```bash
# Pull latest changes (if using git)
git pull origin main

# Reinstall dependencies
npm install

# Restart server
npm start
```

**Important Notes:**
- Your `config.json` and `data/` directory will be preserved
- Always backup your configuration before upgrading
- Check the changelog for breaking changes
- Test in a development environment first

## Configuration

### Environment Variables

Create a `.env` file in the root directory (optional). See `.env.example` for reference:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
PORT=3001
ALLOW_INSECURE_TLS=true
CLOUDFLARE_PROXY_BASE_URL=
PROXY_BASE_URL=
```

### Application Configuration

The main configuration is stored in `config.json` (created automatically on first run). This file contains:

- **Endpoints**: List of configured AI service providers
- **Current Endpoint ID**: Currently selected endpoint
- **Unified API Key**: Generated key for unified API access
- **Tools**: Enabled/disabled tools
- **Search Engine**: Preferred search engine

### Endpoint Configuration

Each endpoint can be configured with:

- **Name**: Display name for the endpoint
- **Base URL**: API endpoint URL
- **Authentication Type**: API key or OAuth 2.0
- **API Key** (if applicable): Authentication key
- **Token URL** (OAuth): OAuth token endpoint
- **Client ID** (OAuth): OAuth client identifier
- **Client Secret** (OAuth): OAuth client secret
- **Scope** (OAuth): OAuth scope
- **Default Model**: Default model for this endpoint
- **System Prompt**: Default system prompt
- **Stream**: Enable/disable streaming
- **Input Cost**: Cost per 1M input tokens
- **Output Cost**: Cost per 1M output tokens

## Usage

### Running the Project

#### Option 1: Server Mode (Recommended for Development)

Server mode provides full backend functionality with local data storage and API endpoints.

**Starting the Server:**

```bash
# Normal mode
npm start

# Development mode with auto-reload
npm run dev

# Debug mode with inspector
npm run debug
```

**What happens when you start:**
1. Server initializes on port 3001 (or PORT environment variable)
2. Express app sets up middleware and routes
3. Static files are served from `public/` directory
4. API endpoints become available at `/api/*`
5. Unified API gateway becomes available at `/unified/v1/*`
6. Data directories are created if they don't exist
7. Configuration is loaded from `config.json`

**Accessing the Application:**
1. Open your web browser
2. Navigate to `http://localhost:3001`
3. The main interface will load

**Server Mode Features:**
- Full API backend
- Local file-based storage
- Chat history persistence
- Model caching
- Tool execution
- Search engine integration
- OAuth token management
- Request logging

**Stopping the Server:**
- Press `Ctrl+C` in the terminal
- The server will gracefully shut down
- All in-memory data will be lost (but persisted data remains)

#### Option 2: Static Site Mode (For Cloud Deployment)

Static site mode runs entirely in the browser with no backend server. Suitable for GitHub Pages or other static hosting.

**Local Testing:**

```bash
# Using npx serve
npx serve docs

# Using Python
cd docs
python -m http.server 8080

# Using Node.js http-server
npx http-server docs -p 8080
```

**Deploying to GitHub Pages:**

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click **Settings**
   - Click **Pages** in the left sidebar
   - Under **Build and deployment**:
     - Source: Deploy from a branch
     - Branch: `main` (or `master`)
     - Folder: `/docs`
   - Click **Save**

3. **Access Your Site:**
   - Wait 1-2 minutes for deployment
   - Visit: `https://your-username.github.io/your-repo-name/`

4. **Configure Endpoints:**
   - On first load, you'll be prompted to paste configuration
   - Paste your endpoint configuration JSON
   - Configuration is stored in browser localStorage

**Static Site Mode Features:**
- Runs entirely in browser
- No server required
- Data stored in localStorage
- CORS proxy support (via Cloudflare Worker)
- Suitable for public sharing
- Limited by browser security policies

**Static Site Limitations:**
- No server-side processing
- Data lost when browser cache is cleared
- CORS restrictions on some APIs
- No OAuth token caching
- Limited search engine support

#### Option 3: Cloudflare Worker Mode (Edge Deployment)

Deploy as a Cloudflare Worker for global edge distribution.

**Prerequisites:**
- Cloudflare account
- Wrangler CLI installed: `npm install -g wrangler`

**Setup:**

1. **Configure Wrangler:**
   ```bash
   cd cloudflare-worker
   wrangler login
   ```

2. **Edit wrangler.toml:**
   ```toml
   name = "ai-ui-worker"
   main = "index.js"
   compatibility_date = "2024-01-01"

   [vars]
   # Add your environment variables
   ```

3. **Deploy:**
   ```bash
   wrangler deploy
   ```

4. **Access Your Worker:**
   - Wrangler will output the worker URL
   - Access via: `https://ai-ui-worker.your-subdomain.workers.dev`

**Cloudflare Worker Features:**
- Global edge distribution
- Low latency
- CORS proxying
- Request forwarding
- Serverless execution

### First-Time Setup Guide

#### Step 1: Access the Interface

After starting the server (or accessing the static site), you'll see the main interface with:
- Sidebar on the left (chat history)
- Chat area in the center
- Input field at the bottom
- Settings and controls in the header

#### Step 2: Configure Your First Endpoint

1. **Open Settings:**
   - Click the gear icon (⚙️) in the top-right corner
   - The settings modal will open

2. **Add an Endpoint:**
   - Click the **+ Add Endpoint** button
   - A form will appear

3. **Fill in Endpoint Details:**

   **Basic Fields:**
   - **Preset**: Choose from presets (OpenAI, Google, Groq, etc.) or select "Custom"
   - **Name**: Display name (e.g., "My OpenAI Account")
   - **Base URL**: API endpoint URL
     - OpenAI: `https://api.openai.com/v1`
     - Groq: `https://api.groq.com/openai/v1`
     - Anthropic: `https://api.anthropic.com/v1`
     - Local: `http://localhost:11434` (Ollama)

   **Authentication:**
   - **Auth Type**: Choose "API Key" or "OAuth 2.0"
   - **API Key**: Your service's API key (if using API Key auth)
   - **OAuth Fields** (if using OAuth 2.0):
     - Token URL: OAuth token endpoint
     - Client ID: OAuth client identifier
     - Client Secret: OAuth client secret
     - Scope: OAuth scope (optional)

   **Model Configuration:**
   - **Default Model**: Default model for this endpoint (optional)
   - **System Prompt**: Default system prompt for all chats (optional)

   **Advanced Options:**
   - **Stream**: Enable streaming responses (default: checked)
   - **Input Cost**: Cost per 1M input tokens (for tracking)
   - **Output Cost**: Cost per 1M output tokens (for tracking)

4. **Save the Endpoint:**
   - Click the **Save** button
   - The endpoint will be added to your list

#### Step 3: Select and Refresh Models

1. **Select Your Endpoint:**
   - In the main header, click the endpoint dropdown
   - Select your newly added endpoint
   - The status indicator should turn green

2. **Refresh Models:**
   - Click the refresh button (circular arrow icon) next to the model dropdown
   - Wait for the model list to populate
   - This may take a few seconds depending on the endpoint

3. **Select a Model:**
   - Click the model dropdown
   - Select your preferred model from the list
   - The model is now active for new chats

#### Step 4: Start Your First Chat

1. **Create a New Chat:**
   - Click the **+** button in the sidebar header
   - A new chat will be created

2. **Type Your Message:**
   - Click in the input field at the bottom
   - Type your message
   - Press Enter or click the send button

3. **View the Response:**
   - The AI response will stream in real-time
   - Markdown will be rendered automatically
   - Code blocks will have syntax highlighting

4. **Continue the Conversation:**
   - Type follow-up messages
   - The conversation context is maintained
   - Chat history is saved automatically

### Advanced Usage

#### Using Multiple Endpoints

You can configure multiple endpoints and switch between them:

1. **Add Multiple Endpoints:**
   - Repeat the endpoint configuration process for each service
   - Give each a descriptive name

2. **Switch Between Endpoints:**
   - Use the endpoint dropdown in the header
   - Each chat can use a different endpoint
   - The model list updates when you switch endpoints

3. **Compare Responses:**
   - Branch a chat to try different endpoints
   - Compare responses from different models
   - Use the best response for your needs

#### Using Tools

Enable AI tools for enhanced capabilities:

1. **Enable Tools Globally:**
   - Go to Settings → Tools section
   - Toggle tools on/off
   - Available tools: web_search, url_fetch, wikipedia

2. **Enable Tools Per Chat:**
   - In the chat input area, click tool icons
   - Toggle tools on/off for the current chat
   - Tools are automatically called by the AI when relevant

3. **Tool Usage Examples:**
   - Ask: "What's the latest news about AI?"
   - AI will use web_search to find current information
   - Ask: "Summarize this article: https://example.com"
   - AI will use url_fetch to read the article
   - Ask: "Tell me about quantum computing"
   - AI may use wikipedia for background information

#### Chat Organization

Organize your chats for better management:

1. **Create Folders:**
   - Use the folder pills in the sidebar (All, General, Work, Personal, Archive)
   - Chats are automatically organized by folder

2. **Rename Chats:**
   - Double-click on a chat title in the sidebar
   - Enter a new name
   - Press Enter to save

3. **Pin Important Chats:**
   - Click the menu button (⋮) on a chat
   - Click "Pin"
   - Pinned chats appear at the top

4. **Delete Chats:**
   - Click the menu button (⋮) on a chat
   - Click "Delete"
   - Confirm deletion

5. **Search Chats:**
   - Use the search bar in the sidebar
   - Search by title, content, or tags
   - Results filter in real-time

6. **Branch Conversations:**
   - Start a new branch from any point in a conversation
   - Useful for exploring different directions
   - Original conversation is preserved

#### Using Incognito Mode

Create temporary, unsaved chats:

1. **Start Incognito Chat:**
   - Click the incognito button (🕶️) in the sidebar header
   - The chat will not be saved to history
   - Useful for sensitive or temporary conversations

2. **Incognito Indicator:**
   - Incognito chats show a "Private" badge
   - They are not saved to localStorage or server

#### Image Upload

Use vision capabilities with compatible models:

1. **Attach an Image:**
   - Click the attachment button (📎) in the input area
   - Select an image file
   - The image preview will appear

2. **Send with Message:**
   - Type your message
   - The image will be sent with the message
   - AI can analyze the image (if model supports vision)

3. **Supported Models:**
   - GPT-4o, GPT-4 Vision
   - Claude 3.5 Sonnet
   - Gemini 1.5 Pro
   - Other vision-capable models

#### Cost Tracking

Track token costs for your usage:

1. **Configure Costs:**
   - In endpoint settings, set input/output costs per 1M tokens
   - Costs are tracked per endpoint

2. **View Costs:**
   - Costs are displayed in the chat menu
   - Total cost per chat is calculated
   - Helps manage API expenses

#### System Prompts

Set default behavior per endpoint:

1. **Configure System Prompt:**
   - In endpoint settings, enter a default system prompt
   - This prompt is used for all chats with that endpoint
   - Override per chat if needed

2. **Example System Prompts:**
   - "You are a helpful assistant."
   - "You are a code expert. Provide clean, well-commented code."
   - "You are a creative writer. Be descriptive and engaging."

### API Usage

#### Using the Unified API

The unified API provides a single endpoint for all configured services:

1. **Get Your Unified API Key:**
   - The key is automatically generated in `config.json`
   - Located at `config.unifiedApiKey`
   - Format: `ag-` followed by 64 hex characters

2. **List All Models:**
   ```bash
   curl http://localhost:3001/unified/v1/models \
     -H "Authorization: Bearer YOUR_UNIFIED_KEY"
   ```

3. **Send Chat Completion:**
   ```bash
   curl http://localhost:3001/unified/v1/chat/completions \
     -H "Authorization: Bearer YOUR_UNIFIED_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [
         {"role": "user", "content": "Hello!"}
       ],
       "stream": true
     }'
   ```

4. **Model Selection:**
   - Specify the model in the request
   - The system routes to the appropriate endpoint
   - No need to specify endpoint ID

#### Using the Main API

Direct API access with endpoint-specific configuration:

1. **List Endpoints:**
   ```bash
   curl http://localhost:3001/api/endpoints
   ```

2. **Get Models for Specific Endpoint:**
   ```bash
   curl http://localhost:3001/api/models?endpointId=ENDPOINT_ID
   ```

3. **Send Chat Completion:**
   ```bash
   curl http://localhost:3001/api/chat \
     -H "Content-Type: application/json" \
     -d '{
       "endpointId": "ENDPOINT_ID",
       "model": "MODEL_NAME",
       "messages": [
         {"role": "user", "content": "Hello!"}
       ],
       "stream": true
     }'
   ```

### Troubleshooting Common Issues

#### Server Won't Start

**Problem:** Port already in use
```bash
# Solution 1: Use a different port
PORT=3002 npm start

# Solution 2: Kill the process using the port
# On Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# On Mac/Linux
lsof -ti:3001 | xargs kill -9
```

**Problem:** Dependencies not installed
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Models Not Loading

**Problem:** Authentication error
- Verify API key is correct
- Check endpoint URL is accurate
- Ensure the API key has necessary permissions

**Problem:** Network error
- Check internet connection
- Verify endpoint is accessible
- Try disabling proxy if configured

**Problem:** CORS error (static site mode)
- Configure CORS proxy in settings
- Use server mode instead
- Check endpoint CORS policy

#### Chat Not Saving

**Problem:** File permissions
- Ensure the application has write access to `data/` directory
- Check disk space
- Review logs for specific errors

**Problem:** Incognito mode
- Incognito chats are not saved by design
- Use regular chat for persistence

#### Search Not Working

**Problem:** Selenium not configured
- Ensure Python is installed
- Install Chrome browser
- Check Selenium WebDriver installation

**Problem:** Rate limiting
- Search engines may rate limit requests
- Try a different search engine
- Wait before retrying

### Using the Unified API

The unified API provides a single endpoint for all configured services:

- **Base URL**: `http://localhost:3001/unified/v1`
- **Authentication**: Bearer token from `config.json`
- **Endpoints**:
  - `/models` - List all models from all endpoints
  - `/chat/completions` - Send chat completion requests

### Chat Features

- **New Chat**: Click the + button to start a new conversation
- **Incognito Chat**: Create unsaved, temporary chats
- **Chat Management**:
  - Pin important chats
  - Rename chats (double-click title)
  - Delete chats
  - Regenerate titles
  - Branch conversations
- **Organization**:
  - Use folders (General, Work, Personal, Archive)
  - Tag chats for easy filtering
  - Search across all chats
- **Tools**:
  - Enable/disable tools per chat
  - Web search integration
  - URL fetching
  - Wikipedia search

## Deployment Options

### Local Development

Run the server locally for development and testing:

```bash
npm start
# or with auto-reload
npm run dev
```

### Cloudflare Workers

Deploy as a Cloudflare Worker for edge deployment:

1. Install Wrangler CLI
2. Configure `cloudflare-worker/wrangler.toml`
3. Deploy:
   ```bash
   cd cloudflare-worker
   wrangler deploy
   ```

### GitHub Pages

Deploy the static site to GitHub Pages:

1. Push repository to GitHub
2. Enable Pages in repository settings
3. Select source: Branch `main` → `/docs` folder
4. Access via `https://username.github.io/repo-name`

### Traditional Hosting

Deploy the server to any Node.js hosting provider:

- Heroku
- Railway
- Render
- DigitalOcean
- AWS
- Google Cloud

### Docker (Future)

Containerize the application for easy deployment (not yet implemented).

## API Reference

### Main API Endpoints

#### Configuration

- `GET /api/endpoints` - List all configured endpoints
- `POST /api/endpoints` - Add or update an endpoint
- `DELETE /api/endpoints/:id` - Delete an endpoint
- `POST /api/endpoints/select` - Select current endpoint

#### History

- `GET /api/history` - Retrieve chat history
- `POST /api/history` - Save chat history

#### Models

- `GET /api/models` - List models for current endpoint
- `POST /api/models` - List models for specific endpoint
- `POST /api/models/refresh` - Refresh all model lists

#### Chat

- `POST /api/chat` - Send chat completion request

#### Tools

- `GET /api/tools` - List available tools
- `POST /api/tools/:id` - Toggle tool enable/disable

#### Search

- `GET /api/search` - Perform web search

#### Logging

- `POST /api/logs` - Submit client-side logs

### Unified API Endpoints

The unified API provides OpenAI-compatible endpoints:

- `GET /unified/v1/models` - List all models from all endpoints
- `POST /unified/v1/chat/completions` - Send chat completion with unified key

### Request/Response Formats

#### Chat Completion Request

```json
{
  "endpointId": "string",
  "model": "string",
  "messages": [
    {
      "role": "user|assistant|system",
      "content": "string"
    }
  ],
  "stream": true,
  "activeTools": ["web_search", "url_fetch"]
}
```

#### Chat Completion Response (Streaming)

Server-Sent Events (SSE) format:

```
data: {"choices": [{"delta": {"content": "text"}}]}

data: [DONE]
```

## Web Search System

The web search system provides intelligent, multi-engine search capabilities with automatic fallback and performance optimization.

### Supported Engines

- **Bing**: Primary search engine
- **DuckDuckGo**: Privacy-focused search
- **Yahoo**: Alternative search engine
- **Google**: Limited (blocked by CAPTCHA)

### Features

- **Automatic Engine Selection**: Chooses best performing engine
- **Selenium Fallback**: Handles JavaScript-heavy pages
- **Smart Wait Detection**: Reduces wait times
- **Request Jitter**: Human-like delays
- **User Agent Rotation**: Avoids detection
- **Performance Tracking**: Scores engines by success rate
- **Comprehensive Logging**: Detailed analytics

### Usage

The search system is integrated with the AI tools:

- **web_search**: Search across engines
- **url_fetch**: Fetch webpage content
- **wikipedia**: Search Wikipedia

### Configuration

Search engine preference can be configured in the application settings.

### Documentation

For detailed information, see:
- [docs/SEARCH_SYSTEM.md](docs/SEARCH_SYSTEM.md) - Complete documentation
- [docs/SEARCH_QUICK_REFERENCE.md](docs/SEARCH_QUICK_REFERENCE.md) - Quick reference
- [docs/SEARCH_CHANGES.md](docs/SEARCH_CHANGES.md) - Changelog

## Tools and Capabilities

### Available Tools

#### web_search
Search the web for current, factual, or real-time information.

**Parameters:**
- `query` (required): The search query

**Usage:**
The AI automatically uses this tool when questions require current information.

#### url_fetch
Fetch and read the text content of any public webpage.

**Parameters:**
- `url` (required): The full URL of the webpage

**Features:**
- Automatic fallback to Selenium for JavaScript-heavy pages
- DOM-based content extraction
- Error handling and retry logic

#### wikipedia
Search Wikipedia for a topic and return a short summary.

**Parameters:**
- `query` (required): The topic to search on Wikipedia

**Features:**
- Direct Wikipedia API integration
- Summary extraction
- Link preservation

### Tool Management

- Enable/disable tools globally in settings
- Enable/disable tools per chat
- Tools are automatically called by AI models
- Tool results are included in conversation context

### Future Tools

Planned additions:
- File system operations
- Code execution
- Database queries
- API integrations
- Custom tool definitions

## Development

### Running in Development Mode

```bash
npm run dev
```

This enables auto-reload on file changes.

### Debugging

```bash
npm run debug
```

Starts the server with Node.js debugging enabled on port 9229.

### Code Structure

#### Server Entry Point
- `server.js` - Main server setup, middleware, route mounting

#### API Routes
- `routes/api.js` - Main API endpoints
- `routes/unified.js` - Unified API gateway

#### Utilities
- `utils/helpers.js` - Configuration, data management, OAuth
- `utils/logger.js` - Logging system
- `utils/search.js` - Search system entry point
- `utils/tools.js` - Tool execution logic

#### Search Engines
- `utils/search/index.js` - Search engine registry
- `utils/search/bing.js` - Bing implementation
- `utils/search/duckduckgo.js` - DuckDuckGo implementation
- `utils/search/yahoo.js` - Yahoo implementation
- `utils/search/selenium.js` - Selenium web scraping
- `utils/search/helpers.js` - Helper functions
- `utils/search/logger.js` - Search-specific logging

#### Frontend
- `public/app.js` - Client-side application logic
- `public/index.html` - Main HTML structure
- `public/styles.css` - Styling

### Adding New Features

1. **New Search Engine**: Add to `utils/search/` and register in `utils/search/index.js`
2. **New Tool**: Add to `utils/tools.js` and configure in settings
3. **New API Endpoint**: Add to `routes/api.js`
4. **New Frontend Feature**: Modify `public/app.js` and related HTML/CSS

### Code Style

- Use existing patterns and conventions
- Follow the established structure
- Add error handling for all async operations
- Include logging for debugging
- Maintain backward compatibility

## Testing

### Running All Tests

```bash
npm test
```

### Individual Tests

```bash
# Search system
node tests/search.test.js

# Selenium
node tests/test-selenium.js

# Yahoo search
node tests/test-yahoo.js

# Logging
node tests/test-logging.js

# Google search (may fail due to CAPTCHA)
node tests/test-google.js

# Engine comparison
node tests/compare-engines.js
```

### Test Coverage

Tests cover:
- Search engine functionality
- Selenium web scraping
- Logging system
- Search engine performance comparison
- Error handling

## Troubleshooting

### Common Issues

#### Server won't start
- Check if port 3001 is already in use
- Verify Node.js installation
- Check dependencies are installed

#### CORS errors
- Configure CORS proxy in settings
- Use server mode instead of static site
- Check endpoint CORS configuration

#### Authentication failures
- Verify API keys are correct
- Check OAuth credentials
- Ensure token URL is accessible
- Check token cache (restart server)

#### Search not working
- Verify internet connection
- Check Selenium WebDriver installation
- Try different search engine
- Check logs for errors

#### Models not loading
- Check endpoint URL is correct
- Verify authentication
- Force refresh models
- Check network connectivity

#### Chat history not saving
- Check file permissions
- Verify data directory exists
- Check disk space
- Review logs for errors

### Logging

Logs are stored in the `logs/` directory:
- Request logs: HTTP request/response data
- Client logs: Browser-side errors and events
- Server logs: Server-side errors and events
- Search logs: Search engine performance data

### Getting Help

- Check the documentation in the `docs/` folder
- Review the logs in the `logs/` folder
- Check the GitHub issues
- Review the search system documentation

## License

See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

## Acknowledgments

- OpenAI for the API specification
- Marked.js for Markdown parsing
- Highlight.js for syntax highlighting
- Selenium for web automation
- Cloudflare for edge computing platform
