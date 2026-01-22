# AG-AI Endpoints (AI Chat Interface)

A versatile AI Chat Interface that supports multiple AI endpoints (OpenAI, Google Gemini, Groq, NVIDIA, Local AI, etc.) with features for standard chatting and comparing agent/model responses side-by-side.

## Features

- **Multi-Endpoint Support**: Connect to various AI providers including OpenAI, Google Gemini, Groq, NVIDIA, and local inference servers (LM Studio, Ollama, LocalAI).
- **Unified API Gateway**: Includes a proxy server that normalizes requests to different providers, effectively giving you an OpenAI-compatible API for all supported endpoints.
- **Rich Chat Interface**:
    - Markdown rendering with syntax highlighting.
    - System Prompts support.
    - Responsive design with dark/glassmorphism theme.
- **Agent Comparison Mode**: Select two different models (or endpoints) and chat with them simultaneously to compare their responses.
- **Configurable**: Add, edit, and manage endpoints directly from the UI or configuration file.

## Prerequisites

- **Node.js**: v14.0.0 or higher.
- **NPM**: Included with Node.js.

## Installation

1.  **Clone the repository** (or download source):
    ```bash
    git clone <repository-url>
    cd ag-aiendpoints
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Start the Server**:
    ```bash
    npm start
    ```
    The application will run at [http://localhost:3000](http://localhost:3000).

## Configuration

Configuration is stored in `config.json`. You can manage endpoints via the **Settings** (gear icon) in the UI or edit the file manually.

### Adding Endpoints
1.  Click the **Settings** icon in the top right.
2.  Click **+ Add Endpoint**.
3.  Select a **Preset** (e.g., OpenAI, Gemini, Groq, Ollama) or choose "Custom".
4.  Enter specific details:
    - **Name**: Display name.
    - **Base URL**: The API endpoint (e.g., `https://api.openai.com/v1`).
    - **Auth Type**: API Key or OAuth2.
    - **API Key**: Your provider's API key.

### Config File Structure (`config.json`)
```json
{
  "endpoints": [
    {
      "id": "unique-id",
      "name": "Provider Name",
      "apiKey": "your-api-key",
      "baseUrl": "https://api.provider.com/v1",
      "authType": "api-key"
    }
  ],
  "currentEndpointId": "default-id",
  "unifiedApiKey": "optional-gateway-key"
}
```

## Usage

### Standard Chat
1.  Select an **Endpoint** from the dropdown near the logo.
2.  Select a **Model** from the top right.
3.  (Optional) Enter a **System Prompt** in the "System instructions" box.
4.  Type your message and send.

### Comparison Mode
1.  Click **New Compare** in the sidebar.
2.  Select an **Endpoint** and **Model**, then click **Add**.
3.  Add at least two models to compare.
4.  Click **Start Comparison**.
5.  Type a message; it will be sent to all selected agents simultaneously.

## Unified API Usage
The server exposes a unified OpenAI-compatible API at `/unified/v1`. You can use this to point other tools (like Cursor, VS Code extensions) to your running instance.

- **Base URL**: `http://localhost:3000/unified/v1`
- **API Key**: Value of `unifiedApiKey` in `config.json` (Default: Auto-generated or `my-static-secret-key-123`).
- **Models**: The API aggregates models from all configured endpoints.
    - Model ID Format: `EndpointName/ModelID` (e.g., `Groq/llama3-8b-8192`).

## Troubleshooting
- **Input Disabled**: Ensure an endpoint and model are selected.
- **Connection Failed**: Check your internet connection and API Key. For local models, ensure your local server (Ollama/LM Studio) is running and CORS is enabled if necessary.
