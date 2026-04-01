declare const process: {
  env: Record<string, string | undefined>;
};

const TEST_RECEIVER = 'jakub.riha@livesport.eu';

type ReportTask = {
  idReadable: string;
  summary: string;
  dueDate?: number;
  assignee?: string | null;
  owner?: string | null;
};

const pickHeader = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const formatDate = (timestamp?: number): string => {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleDateString('cs-CZ');
};

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const requiredDashboardPassword = process.env.DASHBOARD_PASSWORD;
  if (requiredDashboardPassword) {
    const suppliedDashboardPassword = pickHeader(req.headers['x-dashboard-password']);
    if (suppliedDashboardPassword !== requiredDashboardPassword) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.REPORT_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    res.status(400).json({
      error:
        'Email provider is not configured. Set RESEND_API_KEY and REPORT_FROM_EMAIL in Vercel env.',
    });
    return;
  }

  const body = (req.body || {}) as {
    tasks?: ReportTask[];
    dashboardUrl?: string;
  };
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  const dashboardUrl = body.dashboardUrl || '';

  const subject = `[MKT Dashboard] Overdue tasks report (${tasks.length})`;
  const rows = tasks
    .slice(0, 200)
    .map(
      task =>
        `<li><strong>${task.idReadable}</strong> - ${task.summary} (Due: ${formatDate(task.dueDate)}, Assignee: ${task.assignee || '-'}, Owner: ${task.owner || '-'})</li>`,
    )
    .join('');

  const html = `
    <h2>Overdue tasks report</h2>
    <p>Total overdue tasks in current All Tasks filter: <strong>${tasks.length}</strong></p>
    ${dashboardUrl ? `<p><a href="${dashboardUrl}">Open dashboard</a></p>` : ''}
    <ul>${rows || '<li>No overdue tasks</li>'}</ul>
  `;

  const textLines = tasks
    .slice(0, 200)
    .map(
      task =>
        `${task.idReadable} - ${task.summary} | Due: ${formatDate(task.dueDate)} | Assignee: ${task.assignee || '-'} | Owner: ${task.owner || '-'}`,
    )
    .join('\n');
  const text = `Overdue tasks report\nTotal: ${tasks.length}\n${dashboardUrl ? `Dashboard: ${dashboardUrl}\n` : ''}\n${textLines || 'No overdue tasks'}`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [TEST_RECEIVER],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const payload = await response.text();
      res.status(502).json({
        error: `Failed to send email via Resend: ${payload.slice(0, 260)}`,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      sentTo: TEST_RECEIVER,
      count: tasks.length,
    });
  } catch (error: any) {
    res.status(502).json({
      error: `Email send failed: ${error?.message || 'Unknown error'}`,
    });
  }
}
