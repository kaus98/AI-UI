# AI Chat — Static Site

A fully static, browser-based AI chat interface that runs on **GitHub Pages**.

## What it does

- Runs entirely in the browser — no server required.
- Stores endpoints, settings, and chat history in `localStorage`.
- Supports **API Key** (`Authorization: Bearer ...`) and **OAuth2 Client Credentials** authentication.
- Fetches model lists, sends chat-completion requests, streams responses, and renders Markdown.
- All data is cleared when the browser session/cache is cleared.
- **Responsive design** optimized for phones, tablets, and desktops.
- **Cross-browser compatible** with Chrome, Firefox, Safari, and Edge.
- **Accessibility features** including ARIA labels, keyboard navigation, and screen reader support.

## Features

- ✅ Multiple search engines (Bing, DuckDuckGo, Yahoo)
- ✅ URL fetch with Selenium fallback
- ✅ Wikipedia integration
- ✅ Model/endpoint change confirmation
- ✅ Responsive design (7 breakpoints)
- ✅ Touch gestures (swipe to open/close sidebar)
- ✅ Dark mode support
- ✅ Image upload support
- ✅ Streaming responses
- ✅ Markdown rendering
- ✅ Code syntax highlighting

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

Or with Python:

```bash
cd docs
python -m http.server 8080
```

## Documentation

For detailed information about the search system and features, see:

- **[SEARCH_SYSTEM.md](SEARCH_SYSTEM.md)** - Complete search system documentation
- **[SEARCH_QUICK_REFERENCE.md](SEARCH_QUICK_REFERENCE.md)** - Quick reference guide
- **[SEARCH_CHANGES.md](SEARCH_CHANGES.md)** - Search system change log
