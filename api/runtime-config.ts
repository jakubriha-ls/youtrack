declare const process: {
  env: Record<string, string | undefined>;
};

export default function handler(_req: any, res: any): void {
  const managed = Boolean(process.env.YOUTRACK_BASE_URL && process.env.YOUTRACK_TOKEN);
  res.status(200).json({
    managed,
    baseUrl: process.env.YOUTRACK_BASE_URL || null,
    requiresPassword: Boolean(process.env.DASHBOARD_PASSWORD),
  });
}
