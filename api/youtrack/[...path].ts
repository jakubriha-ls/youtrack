declare const process: {
  env: Record<string, string | undefined>;
};

const pickHeader = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const toBaseUrl = (raw: string): string => raw.replace(/\/+$/, '');

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

type RateBucket = { count: number; resetAt: number };
const globalRateState = globalThis as unknown as { __ytProxyRate?: Map<string, RateBucket> };
const rateBuckets = globalRateState.__ytProxyRate ?? new Map<string, RateBucket>();
globalRateState.__ytProxyRate = rateBuckets;

const buildTarget = (baseUrl: string, pathParts: string[], query: string): string =>
  `${baseUrl}/api/${pathParts.join('/')}${query ? `?${query}` : ''}`;

const getPathParts = (req: any): string[] => {
  if (Array.isArray(req.query?.path) && req.query.path.length > 0) {
    return req.query.path.map((part: unknown) => String(part));
  }
  if (typeof req.query?.path === 'string' && req.query.path.trim()) {
    return [req.query.path];
  }

  const rawUrl = String(req.url || '');
  const pathname = rawUrl.split('?')[0] || '';
  const normalized = pathname.replace(/^\/api\/youtrack\/?/, '');
  if (!normalized) return [];
  return normalized.split('/').filter(Boolean);
};

export default async function handler(req: any, res: any): Promise<void> {
  const ip =
    pickHeader(req.headers['x-forwarded-for'])?.split(',')[0]?.trim() ||
    pickHeader(req.headers['x-real-ip']) ||
    'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else if (bucket.count >= RATE_LIMIT_MAX) {
    const retryIn = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('retry-after', String(Math.max(retryIn, 1)));
    res.status(429).json({ error: 'Too many requests.' });
    return;
  } else {
    bucket.count += 1;
  }

  const requiredDashboardPassword = process.env.DASHBOARD_PASSWORD;
  if (requiredDashboardPassword) {
    const suppliedDashboardPassword = pickHeader(req.headers['x-dashboard-password']);
    if (suppliedDashboardPassword !== requiredDashboardPassword) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const envBaseUrl = process.env.YOUTRACK_BASE_URL;
  const headerBaseUrl = pickHeader(req.headers['x-youtrack-base-url']);
  const baseUrl = envBaseUrl || (!isProduction ? headerBaseUrl : undefined);
  const envToken = process.env.YOUTRACK_TOKEN;
  const headerToken = pickHeader(req.headers['x-youtrack-token']);
  const token = envToken || (!isProduction ? headerToken : undefined);

  if (!baseUrl || !token) {
    res.status(400).json({ error: 'Missing YouTrack credentials.' });
    return;
  }

  const pathParts = getPathParts(req);

  const searchParams = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (key === 'path') return;
    if (Array.isArray(value)) {
      value.forEach(v => searchParams.append(key, String(v)));
      return;
    }
    if (typeof value !== 'undefined') {
      searchParams.append(key, String(value));
    }
  });

  const query = searchParams.toString();
  const normalizedBase = toBaseUrl(baseUrl);
  const candidates = new Set<string>();
  candidates.add(buildTarget(normalizedBase, pathParts, query));
  if (!normalizedBase.endsWith('/youtrack')) {
    candidates.add(buildTarget(`${normalizedBase}/youtrack`, pathParts, query));
  }

  try {
    const requestInit = {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
    };
    let selectedStatus = 502;
    let selectedContentType = 'application/json';
    let selectedText = '{"error":"Proxy request failed."}';
    let bestScore = -1;
    const attempts: Array<{ target: string; status: number; contentType: string }> = [];

    for (const target of candidates) {
      const response = await fetch(target, requestInit);
      const contentType = response.headers.get('content-type') || 'application/json';
      const text = await response.text();
      attempts.push({ target, status: response.status, contentType });
      const isJson = contentType.includes('application/json');
      const looksHtml = text.trim().startsWith('<!doctype html') || text.trim().startsWith('<html');

      // Best case: successful JSON response.
      if (response.ok && isJson && !looksHtml) {
        selectedStatus = response.status;
        selectedContentType = contentType;
        selectedText = text;
        break;
      }

      // Fallback scoring:
      // 1) JSON non-404 errors (usually auth/perms) are more useful than 404s.
      // 2) JSON 404s are better than HTML responses.
      // 3) Keep highest score among non-success responses.
      let score = 0;
      if (isJson && !looksHtml) {
        score = response.status === 404 ? 100 + response.status : 500 + response.status;
      } else {
        score = response.status;
      }

      if (score > bestScore) {
        bestScore = score;
        selectedStatus = response.status;
        selectedContentType = contentType;
        selectedText = text;
      }
    }

    if (selectedStatus === 404) {
      res.status(404).json({
        error: 'Upstream returned 404 for all candidates.',
        attempts,
      });
      return;
    }

    res.status(selectedStatus);
    res.setHeader('content-type', selectedContentType);
    res.send(selectedText);
  } catch (error: any) {
    res.status(502).json({
      error: 'Proxy request failed.',
      details: error?.message ?? 'Unknown error',
    });
  }
}
