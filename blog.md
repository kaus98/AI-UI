# Building Your Own AI Command Center: A Deep Dive into AI-UI

In the rapidly evolving landscape of Large Language Models (LLMs), developers and power users often find themselves juggling multiple subscriptions, API keys, and disparate interfaces. You might use ChatGPT for reasoning, Claude for coding, and a local Ollama instance for privacy. Switching between these contexts breaks flow and fragments your history.

Enter **AI-UI** (project codename: `ag-aiEndpoints`), a lightweight, open-source, local-first chat interface designed to unify all your AI interactions under one roof.

## Source Code
You can access the full source code and contribute to the project on GitHub:
**[https://github.com/kaus98/AI-UI](https://github.com/kaus98/AI-UI)**

---

## Why This Project Matters

The importance of AI-UI lies in **sovereignty and standardization**. 

1.  **Unified Interface**: Instead of adapting to three different UIs, you use one standardized interface for everything.
2.  **Privacy First**: All your chat history, API configurations, and system prompts are stored locally on your machine in simple JSON files. No data is sent to a third-party wrapper service.
3.  **Model Agnostic**: It leverages the "OpenAI-compatible" API standard, which has become the *de facto* universal language for AI. This means it works out-of-the-box with OpenAI, Groq, OpenRouter, and local inference servers like LM Studio and Ollama.

## Major Features

### 1. Multi-Endpoint Management
The core strength of the project is its ability to define multiple API endpoints. You can toggle between:
- **Cloud Giants**: OpenAI (GPT-4), Google (Gemini via standard adapter), or Groq (for speed).
- **Local Privacy**: LocalAI, Ollama, or LM Studio running on `localhost`.
- **Custom Auth**: Supports both standard API Keys and complex OAuth2 Client Credentials flows for enterprise endpoints.

### 2. Intelligent Model Caching
Querying model lists from providers can be slow. AI-UI implements a smart local caching system (`models.json`). It fetches the available models (e.g., `gpt-4o`, `llama-3-70b`) once and caches them for instant access. A dedicated "Refresh" button allows you to sync with providers whenever you need updates.

### 3. Vision & Multimodal Support
The interface isn't just for text. It includes a fully verified **Image Upload** workflow.
- **Smart Detection**: The "Attach Image" button automatically enables or disables itself based on the selected model's capabilities (e.g., enabled for `gpt-4o`, disabled for `gpt-3.5`).
- **Preview & Edit**: Uploaded images are previewed as thumbnails and can be managed before sending.

### 4. Developer-Centric Controls
Unlike standard consumer chat apps, AI-UI exposes the knobs developers care about:
- **System Prompts**: Define a persistent persona or set of rules (e.g., "You are a senior React developer") that applies to your chat session.
- **Temperature Control**: A slider to adjust the creativity (0.0 to 2.0) of the model on the fly.
- **Markdown & Code**: Uses `EasyMDE` for a rich editing experience and renders responses with full syntax highlighting.

---

## Unified API Layer (V1)

AI-UI acts as more than just a chat client; it's a **Universal Proxy**. It exposes a standard OpenAI-compatible API that lets you connect **other applications** (like Cursor, VS Code, or other AI agents) to your AI-UI instance, giving them centralized access to all your configured models.

### Authentication
All requests to the Unified API require your **Unified API Key**.
- **Location**: Your key is stored in `config.json` under `unifiedApiKey`.
- **Header**: `Authorization: Bearer <YOUR_UNIFIED_API_KEY>`

### Endpoints

#### 1. Unified Models
- **`GET /unified/v1/models`**
- Aggregates models from **all** your configured endpoints (OpenAI, Ollama, Groq, etc.) into a single master list.
- **Model IDs** are namespaced to avoid conflicts: `EndpointName/OriginalModelID` (e.g., `Ollama/llama3`, `OpenAI/gpt-4o`).

#### 2. Unified Chat Completions
- **`POST /unified/v1/chat/completions`**
- Fully OpenAI-compatible chat endpoint.
- **Streaming Supported**: Yes (Server-Sent Events).
- **Usage**:
    ```bash
    curl http://localhost:3000/unified/v1/chat/completions \
      -H "Authorization: Bearer <YOUR_KEY>" \
      -H "Content-Type: application/json" \
      -d '{
        "model": "OpenAI/gpt-4o",
        "messages": [{"role": "user", "content": "Hello!"}],
        "stream": true
      }'
    ```

---

## Use Cases

- **Model Battle-Testing**: Quickly send the same prompt to Llama 3 on Groq and GPT-4 on OpenAI to compare reasoning and speed.
- **Offline/Private Development**: Use a local model (like Mistral or Llama) for coding tasks where you don't want to leak proprietary code to the cloud.
- **API Debugging**: Because it acts as a direct proxy, checking the server logs helps you understand the exact JSON payloads being sent to and received from LLM providers.
- **Central Gateway**: Use AI-UI as the single "LLM Server" for all your other dev tools, managing keys in one place.

## How to Run This Project

Running AI-UI is straightforward for anyone with a basic Node.js environment.

### Prerequisites
- Node.js (v18 or higher recommended)
- `npm` (Node Package Manager)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/kaus98/AI-UI
    cd AI-UI
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Start the Server**:
    ```bash
    node server.js
    ```

4.  **Access the UI**:
    Open your browser and navigate to `http://localhost:3000`.

### Getting Started
1.  Click the **Settings** (gear icon) in the bottom left.
2.  Add a new Endpoint (e.g., OpenAI, `https://api.openai.com/v1`, `sk-...`).
3.  Save and close settings.
4.  Select a model from the dropdown (top header) and start chatting!

---

## API Reference (Internal)

These endpoints are primarily used by the frontend but can be useful for advanced integrations.

### 1. Chat Completion
- **Endpoint**: `POST /api/chat`
- **Description**: Proxies the chat request to the *currently active* endpoint.
- **Payload**: `{ "endpointId": "...", "model": "...", "messages": [...] }`

### 2. Model Management
- **`GET /api/models`**: Returns the list of available models (cached).
- **`POST /api/models/refresh`**: Forces a fresh fetch from all configured upstream providers to update the cache.

### 3. History Management
- **`GET /api/history`**: Retrieves all saved chat sessions.
- **`POST /api/history`**: Saves the current state of all chats (full sync).

### 4. Configuration
- **`GET /api/endpoints`**: returns the list of configured model providers.
- **`POST /api/endpoints`**: Add or update an endpoint configuration.

## Current Limitations & Roadmap

While powerful, AI-UI is designed as a personal tool:
- **Single User**: It runs locally and doesn't have multi-user login support.
- **Local Storage**: Data is saved in JSON files (`chats.json`), which is excellent for portability but not designed for millions of records.

**Future Updates will include:**
- **Plugin System**: Allowing custom tools to be connected to the chat context.
- **Search**: Full-text search across history.

---

*This project represents a shift towards "Bring Your Own Model" (BYOM) software, empowering users to choose the intelligence engine that best fits their specific task, budget, and privacy requirements.*
