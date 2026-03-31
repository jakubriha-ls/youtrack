import React, { useMemo } from 'react';
import { YouTrackIssue } from '../types';

interface AssigneesProps {
  issues: YouTrackIssue[];
}

export const Assignees: React.FC<AssigneesProps> = ({ issues }) => {
  const counts = useMemo(() => {
    const map = new Map<
      string,
      { total: number; dueThisWeek: number; dueNextWeekOpen: number }
    >();

    // aktuální týden: pondělí 00:00 .. neděle 23:59:59.999
    const now = new Date();
    const day = now.getDay(); // 0=Sunday..6=Saturday
    const daysFromMonday = (day + 6) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - daysFromMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    // další týden: pondělí..neděle (posunuté o +7 dní)
    const nextStart = new Date(start);
    nextStart.setDate(start.getDate() + 7);
    const nextEnd = new Date(end);
    nextEnd.setDate(end.getDate() + 7);

    issues.forEach(issue => {
      const name = (issue.assignee ?? '').trim() || 'Bez assignee';

      const existing =
        map.get(name) || { total: 0, dueThisWeek: 0, dueNextWeekOpen: 0 };
      existing.total += 1;

      const due = issue.dueDate;
      if (due && due >= start.getTime() && due <= end.getTime()) {
        existing.dueThisWeek += 1;
      }

      const isOpen = issue.status !== 'Done';
      if (
        isOpen &&
        due &&
        due >= nextStart.getTime() &&
        due <= nextEnd.getTime()
      ) {
        existing.dueNextWeekOpen += 1;
      }

      map.set(name, existing);
    });

    return Array.from(map.entries())
      .map(([assignee, v]) => ({ assignee, ...v }))
      .sort((a, b) => b.total - a.total || a.assignee.localeCompare(b.assignee));
  }, [issues]);

  return (
    <div className="all-tasks">
      <div className="all-tasks-header">
        <div className="header-top">
          <h2>Assignees - Marketing</h2>
          <span className="task-count">{issues.length} tasků</span>
        </div>

        <div className="all-tasks-table-container">
          <table className="all-tasks-table">
            <thead>
              <tr>
                <th style={{ width: '50%' }}>Assignee</th>
                <th style={{ width: '25%' }}>Nezavřené další týden</th>
                <th style={{ width: '25%' }}>Konec týdne</th>
              </tr>
            </thead>
            <tbody>
              {counts.map(({ assignee, dueNextWeekOpen, dueThisWeek }) => (
                <tr key={assignee}>
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #e9ecef' }}>
                    {assignee}
                  </td>
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #e9ecef' }}>
                    {dueNextWeekOpen}
                  </td>
                  <td style={{ padding: '12px 15px', borderBottom: '1px solid #e9ecef' }}>
                    {dueThisWeek}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

