import React, { useMemo } from 'react';
import { YouTrackIssue } from '../types';

interface StatisticsProps {
  issues: YouTrackIssue[];
}

export const Statistics: React.FC<StatisticsProps> = ({ issues }) => {
  const now = Date.now();
  const last7d = now - 7 * 24 * 60 * 60 * 1000;

  const byMktTeam = useMemo(() => {
    const map = new Map<string, number>();
    issues.forEach(issue => {
      if (issue.mktTeam && issue.mktTeam.length > 0) {
        issue.mktTeam.forEach(team => {
          map.set(team, (map.get(team) || 0) + 1);
        });
      } else {
        map.set('Bez týmu', (map.get('Bez týmu') || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [issues]);

  const byProjectCategory = useMemo(() => {
    const map = new Map<string, number>();
    issues.forEach(issue => {
      const key = issue.projectCategory || 'Bez category';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [issues]);

  const closedLast7d = useMemo(
    () =>
      issues
        .filter(i => i.status === 'Done' && i.resolved && i.resolved >= last7d)
        .sort((a, b) => (b.resolved || 0) - (a.resolved || 0)),
    [issues, last7d],
  );

  const activityByPeople = useMemo(() => {
    const createdBy = new Map<string, number>();
    const assignedTo = new Map<string, number>();
    const touchedRecently = new Map<string, number>();

    issues.forEach(issue => {
      const owner = issue.owner || 'Unknown';
      const assignee = issue.assignee || 'Unassigned';
      createdBy.set(owner, (createdBy.get(owner) || 0) + 1);
      assignedTo.set(assignee, (assignedTo.get(assignee) || 0) + 1);
      if (issue.updated >= last7d) {
        touchedRecently.set(owner, (touchedRecently.get(owner) || 0) + 1);
      }
    });

    const keys = new Set<string>([
      ...createdBy.keys(),
      ...assignedTo.keys(),
      ...touchedRecently.keys(),
    ]);

    return Array.from(keys)
      .map(name => ({
        name,
        created: createdBy.get(name) || 0,
        assigned: assignedTo.get(name) || 0,
        recentUpdates: touchedRecently.get(name) || 0,
        score:
          (createdBy.get(name) || 0) * 1 +
          (assignedTo.get(name) || 0) * 0.7 +
          (touchedRecently.get(name) || 0) * 1.4,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [issues, last7d]);

  const maxTeam = byMktTeam[0]?.[1] || 1;
  const maxCategory = byProjectCategory[0]?.[1] || 1;

  return (
    <div className="statistics-overview">
      <div className="stats-header">
        <h2>Workload Overview</h2>
        <div className="stats-subtitle">{issues.length} tasks in MKT</div>
      </div>

      <div className="stats-grid">
        <div className="stats-card">
          <h3>By MKT Team</h3>
          <div className="stats-bars">
            {byMktTeam.map(([label, count]) => (
              <div key={label} className="stats-bar-row">
                <span className="stats-label">{label}</span>
                <div className="stats-bar-track">
                  <div className="stats-bar-fill" style={{ width: `${(count / maxTeam) * 100}%` }} />
                </div>
                <span className="stats-value">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-card">
          <h3>By Project Category</h3>
          <div className="stats-bars">
            {byProjectCategory.map(([label, count]) => (
              <div key={label} className="stats-bar-row">
                <span className="stats-label">{label}</span>
                <div className="stats-bar-track">
                  <div className="stats-bar-fill stats-bar-fill-alt" style={{ width: `${(count / maxCategory) * 100}%` }} />
                </div>
                <span className="stats-value">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-card">
          <h3>Tasks Closed (Last 7 Days)</h3>
          <div className="stats-list">
            {closedLast7d.length === 0 ? (
              <div className="stats-empty">No tasks closed in the last 7 days.</div>
            ) : (
              closedLast7d.slice(0, 12).map(issue => (
                <div key={issue.id} className="stats-list-item">
                  <span className="stats-item-id">{issue.idReadable}</span>
                  <span className="stats-item-summary">{issue.summary}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="stats-card">
          <h3>Most Active People (MKT)</h3>
          <div className="stats-people-table">
            <div className="stats-people-head">
              <span>Person</span>
              <span>Created</span>
              <span>Assigned</span>
              <span>Recent upd.</span>
            </div>
            {activityByPeople.map(person => (
              <div key={person.name} className="stats-people-row">
                <span>{person.name}</span>
                <span>{person.created}</span>
                <span>{person.assigned}</span>
                <span>{person.recentUpdates}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};