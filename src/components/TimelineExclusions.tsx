import React, { useMemo, useState } from 'react';
import { YouTrackIssue } from '../types';
import { formatDate } from '../dateUtils';

interface TimelineExclusionsProps {
  issues: YouTrackIssue[];
  variant?: 'wc' | 'all';
}

type ExclusionRow = {
  issue: YouTrackIssue;
  reasons: string[];
};

const toLocalMidnight = (timestamp: number): number => {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const TimelineExclusions: React.FC<TimelineExclusionsProps> = ({
  issues,
  variant = 'wc',
}) => {
  const [search, setSearch] = useState('');
  const clampStart = toLocalMidnight(new Date(2026, 0, 1).getTime());
  const clampEnd = toLocalMidnight(
    new Date(2026, variant === 'all' ? 11 : 7, variant === 'all' ? 31 : 31).getTime(),
  );

  const excluded = useMemo<ExclusionRow[]>(() => {
    return issues
      .map(issue => {
        const reasons: string[] = [];
        if (!issue.startDate) reasons.push('Missing Start Date');
        if (!issue.dueDate) reasons.push('Missing Due Date');
        if (issue.startDate && issue.dueDate && issue.startDate > issue.dueDate) {
          reasons.push('Invalid range: Start Date is after Due Date');
        }
        if (!issue.startDate || !issue.dueDate) {
          return { issue, reasons };
        }
        const start = toLocalMidnight(issue.startDate);
        const due = toLocalMidnight(issue.dueDate);
        if (due < clampStart) reasons.push('Due Date is before timeline start');
        if (start > clampEnd) reasons.push('Start Date is after timeline end');
        if (variant === 'wc' && issue.summary.toLowerCase().includes('master task')) {
          reasons.push('Hidden in WC view: Master Task');
        }
        return { issue, reasons };
      })
      .filter(row => row.reasons.length > 0)
      .sort((a, b) => a.issue.idReadable.localeCompare(b.issue.idReadable, 'cs'));
  }, [issues, clampStart, clampEnd, variant]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return excluded;
    return excluded.filter(row => {
      const text = `${row.issue.idReadable} ${row.issue.summary} ${row.reasons.join(' ')}`.toLowerCase();
      return text.includes(q);
    });
  }, [excluded, search]);

  return (
    <div className="all-tasks">
      <div className="all-tasks-header">
        <div className="header-top">
          <h2>
            Out of timeline ({variant === 'wc' ? 'WC view' : 'All tasks'}) · {filtered.length}{' '}
            tasks
          </h2>
        </div>
        <div className="filters-row">
          <input
            type="text"
            className="search-input"
            placeholder="Search by ID / summary / reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="all-tasks-table-container">
        <table className="all-tasks-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Summary</th>
              <th>Start</th>
              <th>Due</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ issue, reasons }) => (
              <tr key={issue.id}>
                <td className="col-id">{issue.idReadable}</td>
                <td className="col-summary">{issue.summary}</td>
                <td>{formatDate(issue.startDate)}</td>
                <td>{formatDate(issue.dueDate)}</td>
                <td>{reasons.join(' | ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="no-results">
            <p>No excluded tasks for this timeline scope.</p>
          </div>
        )}
      </div>
    </div>
  );
};
