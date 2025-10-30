// Cloudflare Pages Functions reverse proxy for HTTP backends
// Usage: request /api/<path> or /api?target=<full_http_url>
// Environment:
// - ALLOWED_HOSTS: comma-separated host:port allowlist for ?target URLs
// - TARGET_ORIGIN (optional): default origin for path-based proxying

export async function onRequest(context: any): Promise<Response> {
  const { request, params, env } = context;

  // Basic CORS preflight support
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(request.url);
  const qTarget = url.searchParams.get('target');
  const qHost = url.searchParams.get('host');
  let targetUrl: string;

  const allowAll =
    String(env?.ALLOW_ALL_TARGETS || '').toLowerCase() === 'true';
  const allowed = String(env?.ALLOWED_HOSTS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (qTarget) {
    // Proxy arbitrary target only if allowed by ALLOWED_HOSTS
    let parsed: URL;
    try {
      parsed = new URL(qTarget);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid target URL' }), {
        status: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }
    const hostPort = parsed.host; // includes :port
    const hostname = parsed.hostname;
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    const defaultAllowed =
      allowed.length === 0 && isDefaultAllowedTarget(hostname, port);

    if (!allowAll && !defaultAllowed && !allowed.includes(hostPort)) {
      return new Response(JSON.stringify({ error: 'Target not allowed', host: hostPort }), {
        status: 403,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }
    targetUrl = parsed.toString();
  } else {
    // Path-based proxying using TARGET_ORIGIN
    const targetPathParam = params?.path; // string or undefined for [[path]]
    const targetPath = Array.isArray(targetPathParam)
      ? targetPathParam.join('/')
      : typeof targetPathParam === 'string'
        ? targetPathParam
        : '';
    const origin = (env?.TARGET_ORIGIN as string) || 'http://148.113.196.189:7010';
    targetUrl = `${origin.replace(/\/$/, '')}/${targetPath}`;
  }

  try {
    const inHeaders = new Headers(request.headers);
    inHeaders.set('User-Agent', 'Cloudflare-Proxy');
    inHeaders.delete('host');
    if (qHost) {
      inHeaders.set('host', qHost);
      inHeaders.set('Host', qHost);
    }

    const hasBody = !['GET', 'HEAD'].includes(request.method);
    const body = hasBody ? await request.arrayBuffer() : undefined;

    const resp = await fetch(targetUrl, {
      method: request.method,
      headers: inHeaders,
      body,
      redirect: 'follow',
    });

    const outHeaders = new Headers();
    const ct = resp.headers.get('content-type') || 'application/json';
    outHeaders.set('Content-Type', ct);
    const cacheControl = resp.headers.get('cache-control');
    if (cacheControl) outHeaders.set('Cache-Control', cacheControl);
    applyCors(outHeaders);

    return new Response(resp.body, { status: resp.status, headers: outHeaders });
  } catch (err: any) {
    const message = err?.message || 'Proxy error';
    return new Response(JSON.stringify({ error: message, target: targetUrl }), {
      status: 502,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    });
  }
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function applyCors(h: Headers) {
  const base = corsHeaders();
  for (const [k, v] of Object.entries(base)) h.set(k, v as string);
}

function isDefaultAllowedTarget(hostname: string, port: string): boolean {
  const ipLike = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  if (!ipLike) return false;
  const allowedPorts = new Set(['7010', '7011']);
  return allowedPorts.has(port || '80');
}
