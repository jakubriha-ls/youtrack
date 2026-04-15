import React, { useMemo, useState } from 'react';
import { YouTrackIssue } from '../types';
import { formatDate } from '../dateUtils';
import { useConfig } from '../ConfigContext';

interface TimelineExclusionsProps {
  issues: YouTrackIssue[];
  variant?: 'wc' | 'all';
}

type ExclusionRow = {
  issue: YouTrackIssue;
  reasons: string[];
};

type HiddenHierarchyRow = {
  issue: YouTrackIssue;
  parentIds: string[];
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
  const { config } = useConfig();
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

  const hiddenByHierarchy = useMemo<HiddenHierarchyRow[]>(() => {
    const timelineEligible = new Map<string, YouTrackIssue>();
    issues.forEach(issue => {
      if (!issue.startDate || !issue.dueDate) return;
      const start = toLocalMidnight(issue.startDate);
      const due = toLocalMidnight(issue.dueDate);
      if (start > due) return;
      if (due < clampStart) return;
      if (start > clampEnd) return;
      if (variant === 'wc' && issue.summary.toLowerCase().includes('master task')) return;
      timelineEligible.set(issue.id, issue);
    });

    const parentMap = new Map<string, Set<string>>();
    timelineEligible.forEach(parent => {
      parent.subtasks?.forEach(sub => {
        if (!timelineEligible.has(sub.id)) return;
        if (!parentMap.has(sub.id)) parentMap.set(sub.id, new Set());
        parentMap.get(sub.id)!.add(parent.idReadable);
      });
    });

    return Array.from(parentMap.entries())
      .map(([id, parents]) => ({
        issue: timelineEligible.get(id)!,
        parentIds: Array.from(parents).sort((a, b) => a.localeCompare(b, 'cs')),
      }))
      .filter(row => row.parentIds.length > 0)
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
              <th>Owner</th>
              <th>Assignee</th>
              <th>Start</th>
              <th>Due</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ issue, reasons }) => (
              <tr key={issue.id}>
                <td className="col-id">
                  <a
                    href={`${config.baseUrl}/issue/${issue.idReadable}`}
                    target="_blank"
                    rel="noreferrer"
                    className="timeline-exclusion-link"
                    title="Open in YouTrack"
                  >
                    {issue.idReadable}
                  </a>
                </td>
                <td className="col-summary">{issue.summary}</td>
                <td>{issue.owner || '-'}</td>
                <td>{issue.assignee || '-'}</td>
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

      <div className="all-tasks-header" style={{ marginTop: 16 }}>
        <div className="header-top">
          <h2>Hidden by hierarchy · {hiddenByHierarchy.length} tasks</h2>
        </div>
      </div>
      <div className="all-tasks-table-container">
        <table className="all-tasks-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Summary</th>
              <th>Parent task(s)</th>
              <th>Start</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {hiddenByHierarchy.map(({ issue, parentIds }) => (
              <tr key={issue.id}>
                <td className="col-id">
                  <a
                    href={`${config.baseUrl}/issue/${issue.idReadable}`}
                    target="_blank"
                    rel="noreferrer"
                    className="timeline-exclusion-link"
                  >
                    {issue.idReadable}
                  </a>
                </td>
                <td className="col-summary">{issue.summary}</td>
                <td>{parentIds.join(', ')}</td>
                <td>{formatDate(issue.startDate)}</td>
                <td>{formatDate(issue.dueDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hiddenByHierarchy.length === 0 && (
          <div className="no-results">
            <p>No tasks hidden by hierarchy in this scope.</p>
          </div>
        )}
      </div>
    </div>
  );
};
