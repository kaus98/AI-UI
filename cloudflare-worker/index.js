/**
 * AI-UI CORS / proxy worker
 *
 * Deploy:
 *   cd cloudflare-worker
 *   npx wrangler deploy
 *
 * Set environment variables in the Cloudflare dashboard or via `wrangler secret`:
 *   - ALLOWED_ORIGIN: your GitHub Pages URL, e.g. https://youruser.github.io
 *   - ALLOWED_HOSTS: comma-separated allowed upstream hostnames, e.g.
 *     api.groq.com,generativelanguage.googleapis.com,api.openai.com,api.nvidia.com
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const requestOrigin = request.headers.get('Origin') || '';

    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin === '*' ? requestOrigin || '*' : allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // --- OpenAI-compatible proxy endpoints for the docs/ static client ---
    const proxyPath = url.pathname; // e.g. /models, /v1/models, /chat/completions, /v1/chat/completions
    const openaiPaths = ['/models', '/v1/models', '/chat/completions', '/v1/chat/completions'];

    if (openaiPaths.includes(proxyPath)) {
      const targetBase = url.searchParams.get('target');
      if (!targetBase) {
        return jsonResponse({ error: 'Missing ?target= base URL' }, 400, corsHeaders);
      }

      let targetUrl;
      try {
        targetUrl = new URL(`${targetBase.replace(/\/+$/, '')}${proxyPath}`);
      } catch (e) {
        return jsonResponse({ error: 'Invalid target URL' }, 400, corsHeaders);
      }

      const allowedHosts = (env.ALLOWED_HOSTS || '')
        .split(',')
        .map(h => h.trim())
        .filter(Boolean);

      if (allowedHosts.length && !allowedHosts.includes(targetUrl.hostname)) {
        return jsonResponse({ error: 'Target host not allowed' }, 403, corsHeaders);
      }

      const headers = new Headers();
      const auth = request.headers.get('Authorization');
      const contentType = request.headers.get('Content-Type') || 'application/json';
      if (auth) headers.set('Authorization', auth);
      if (contentType) headers.set('Content-Type', contentType);

      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: request.body,
      });

      const responseHeaders = new Headers({
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      });

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Any other path is not implemented by this proxy worker
    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  }
};

function jsonResponse(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
