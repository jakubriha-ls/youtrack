const pickHeader = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const toBaseUrl = (raw: string): string => raw.replace(/\/+$/, '');

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
  const target = `${toBaseUrl(baseUrl)}/api/${pathParts.join('/')}${query ? `?${query}` : ''}`;

  try {
    const response = await fetch(target, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
    });

    const text = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';
    res.status(response.status);
    res.setHeader('content-type', contentType);
    res.send(text);
  } catch (error: any) {
    res.status(502).json({
      error: 'Proxy request failed.',
      details: error?.message ?? 'Unknown error',
    });
  }
}
