# AI Chat — Static Site

A fully static, browser-based AI chat interface that runs on **GitHub Pages**.

## What it does

- Runs entirely in the browser — no server required.
- Stores endpoints, settings, and chat history in `localStorage`.
- On first visit, asks for an endpoints config (paste JSON or add one endpoint manually).
- Supports **API Key** (`Authorization: Bearer ...`) and **OAuth2 Client Credentials** authentication.
- Fetches model lists, sends chat-completion requests, streams responses, and renders Markdown.
- All data is cleared when the browser session/cache is cleared.

## Deploy on GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages** in the GitHub repository.
3. Under **Build and deployment**, select:
   - **Source:** Deploy from a branch
   - **Branch:** `main` / `master` → `/docs` folder
4. Save. GitHub will build the site from the `docs/` folder.
5. Visit the published URL (e.g. `https://<your-username>.github.io/<repo-name>/`).

## Config format

When the site first loads, paste a config like this:

```json
{
  "endpoints": [
    {
      "name": "OpenAI",
      "baseUrl": "https://api.openai.com/v1",
      "authType": "api-key",
      "apiKey": "sk-..."
    }
  ]
}
```

### OAuth2 example

```json
{
  "endpoints": [
    {
      "name": "Protected API",
      "baseUrl": "https://api.example.com/v1",
      "authType": "oauth2",
      "tokenUrl": "https://auth.example.com/oauth2/token",
      "clientId": "...",
      "clientSecret": "...",
      "scope": "api://default"
    }
  ]
}
```

## Important notes

- The target API must allow **CORS** from the GitHub Pages domain, otherwise the browser will block the requests.
- API keys/secrets are stored in browser `localStorage`; do not use this for production secrets you cannot afford to expose.
- Clear site data / cookies in your browser to remove all stored endpoints and chats.

## Local testing

Open `docs/index.html` directly in a browser, or serve the `docs/` folder with any static server:

```bash
npx serve docs
```
