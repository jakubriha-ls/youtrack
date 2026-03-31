declare const process: {
  env: Record<string, string | undefined>;
};

const pickHeader = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const toBaseUrl = (raw: string): string => raw.replace(/\/+$/, '');

const buildTarget = (baseUrl: string, pathParts: string[], query: string): string =>
  `${baseUrl}/api/${pathParts.join('/')}${query ? `?${query}` : ''}`;

export default async function handler(req: any, res: any): Promise<void> {
  const requiredDashboardPassword = process.env.DASHBOARD_PASSWORD;
  if (requiredDashboardPassword) {
    const suppliedDashboardPassword = pickHeader(req.headers['x-dashboard-password']);
    if (suppliedDashboardPassword !== requiredDashboardPassword) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
  }

  const baseUrl =
    process.env.YOUTRACK_BASE_URL || pickHeader(req.headers['x-youtrack-base-url']);
  const token =
    process.env.YOUTRACK_TOKEN || pickHeader(req.headers['x-youtrack-token']);

  if (!baseUrl || !token) {
    res.status(400).json({ error: 'Missing YouTrack credentials.' });
    return;
  }

  const pathParts = Array.isArray(req.query.path)
    ? req.query.path
    : req.query.path
      ? [req.query.path]
      : [];

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
    let bestErrorStatus = -1;

    for (const target of candidates) {
      const response = await fetch(target, requestInit);
      const contentType = response.headers.get('content-type') || 'application/json';
      const text = await response.text();
      const isJson = contentType.includes('application/json');
      const looksHtml = text.trim().startsWith('<!doctype html') || text.trim().startsWith('<html');

      // Best case: successful JSON response.
      if (response.ok && isJson && !looksHtml) {
        selectedStatus = response.status;
        selectedContentType = contentType;
        selectedText = text;
        break;
      }

      // Keep the most informative API-style error as fallback.
      if (isJson && !looksHtml && response.status > bestErrorStatus) {
        bestErrorStatus = response.status;
        selectedStatus = response.status;
        selectedContentType = contentType;
        selectedText = text;
      } else if (bestErrorStatus < 0) {
        // If we have only HTML/non-JSON errors so far, keep latest.
        selectedStatus = response.status;
        selectedContentType = contentType;
        selectedText = text;
      }
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
