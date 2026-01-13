# OpenAI Node.js Starter (No SDK)

This project demonstrates how to interact with OpenAI-compatible APIs using native Node.js `fetch`, without the official SDK. This is useful for connecting to custom endpoints (like local LLMs).

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```


2.  **Configuration**:
    - Open `config.json`.
    - Configure your keys and base URL:
      ```json
      {
        "apiKey": "sk-...",
        "baseUrl": "https://api.openai.com/v1"
      }
      ```


## Usage

Run the script:

```bash
node index.js
```

The script will:
1. Fetch and list available models (`/v1/models`).
2. Send a chat completion request (`/v1/chat/completions`).

