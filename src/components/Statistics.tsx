import React, { useMemo, useState } from 'react';
import { AllTasksFilterPreset, YouTrackIssue } from '../types';
import { isDoneStatus } from '../statusMeta';

interface StatisticsProps {
  issues: YouTrackIssue[];
  onOpenAllTasksFilter?: (preset: AllTasksFilterPreset) => void;
}

export const Statistics: React.FC<StatisticsProps> = ({ issues, onOpenAllTasksFilter }) => {
  const [peopleSortBy, setPeopleSortBy] = useState<
    'name' | 'created' | 'assigned' | 'recentUpdates'
  >('recentUpdates');
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
        .filter(i => isDoneStatus(i.status) && i.resolved && i.resolved >= last7d)
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

    return Array.from(keys).map(name => ({
        name,
        created: createdBy.get(name) || 0,
        assigned: assignedTo.get(name) || 0,
        recentUpdates: touchedRecently.get(name) || 0,
        score:
          (createdBy.get(name) || 0) * 1 +
          (assignedTo.get(name) || 0) * 0.7 +
          (touchedRecently.get(name) || 0) * 1.4,
      }));
  }, [issues, last7d]);

  const sortedPeople = useMemo(() => {
    const sorted = [...activityByPeople];
    sorted.sort((a, b) => {
      if (peopleSortBy === 'name') {
        return b.name.localeCompare(a.name, 'cs');
      }
      return (b[peopleSortBy] as number) - (a[peopleSortBy] as number);
    });
    return sorted.slice(0, 10);
  }, [activityByPeople, peopleSortBy]);

  const maxTeam = byMktTeam[0]?.[1] || 1;
  const maxCategory = byProjectCategory[0]?.[1] || 1;
  const dataQuality = useMemo(() => {
    const missingAssignee = issues.filter(i => !i.assignee);
    const missingTeam = issues.filter(i => !i.mktTeam || i.mktTeam.length === 0);
    const missingStartDate = issues.filter(i => !i.startDate);
    const missingDueDate = issues.filter(i => !i.dueDate);
    return {
      missingAssignee,
      missingTeam,
      missingStartDate,
      missingDueDate,
    };
  }, [issues]);

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
              <button
                key={label}
                className="stats-bar-row stats-action-row"
                type="button"
                onClick={() => onOpenAllTasksFilter?.({ teams: [label] })}
              >
                <span className="stats-label">{label}</span>
                <div className="stats-bar-track">
                  <div className="stats-bar-fill" style={{ width: `${(count / maxTeam) * 100}%` }} />
                </div>
                <span className="stats-value">{count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="stats-card">
          <h3>By Project Category</h3>
          <div className="stats-bars">
            {byProjectCategory.map(([label, count]) => (
              <button
                key={label}
                className="stats-bar-row stats-action-row"
                type="button"
                onClick={() => onOpenAllTasksFilter?.({ projectCategories: [label] })}
              >
                <span className="stats-label">{label}</span>
                <div className="stats-bar-track">
                  <div className="stats-bar-fill stats-bar-fill-alt" style={{ width: `${(count / maxCategory) * 100}%` }} />
                </div>
                <span className="stats-value">{count}</span>
              </button>
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
                <button
                  key={issue.id}
                  className="stats-list-item stats-list-item-action"
                  type="button"
                  onClick={() => onOpenAllTasksFilter?.({ searchQuery: issue.idReadable })}
                >
                  <span className="stats-item-id">{issue.idReadable}</span>
                  <span className="stats-item-summary">{issue.summary}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="stats-card">
          <h3>Most Active People (MKT)</h3>
          <div className="stats-hint">Tip: klikni na název sloupce pro řazení sestupně.</div>
          <div className="stats-people-table">
            <div className="stats-people-head">
              <button type="button" className="stats-head-btn" onClick={() => setPeopleSortBy('name')}>
                Person {peopleSortBy === 'name' ? '↓' : '⇅'}
              </button>
              <button type="button" className="stats-head-btn" onClick={() => setPeopleSortBy('created')}>
                Created {peopleSortBy === 'created' ? '↓' : '⇅'}
              </button>
              <button type="button" className="stats-head-btn" onClick={() => setPeopleSortBy('assigned')}>
                Assigned {peopleSortBy === 'assigned' ? '↓' : '⇅'}
              </button>
              <button
                type="button"
                className="stats-head-btn"
                onClick={() => setPeopleSortBy('recentUpdates')}
              >
                Recent upd. {peopleSortBy === 'recentUpdates' ? '↓' : '⇅'}
              </button>
            </div>
            {sortedPeople.map(person => (
              <button
                key={person.name}
                className="stats-people-row stats-action-row"
                type="button"
                onClick={() => onOpenAllTasksFilter?.({ assignees: [person.name] })}
              >
                <span>{person.name}</span>
                <span>{person.created}</span>
                <span>{person.assigned}</span>
                <span>{person.recentUpdates}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="stats-card">
          <h3>Data Quality</h3>
          <div className="stats-quality-list">
            <details className="stats-quality-item">
              <summary>
                <span className="stats-item-id">Assignee</span>
                <span className="stats-item-summary">Missing: {dataQuality.missingAssignee.length}</span>
              </summary>
              <div className="stats-quality-tasks">
                {dataQuality.missingAssignee.slice(0, 20).map(issue => (
                  <button
                    key={issue.id}
                    type="button"
                    className="stats-list-item stats-list-item-action"
                    onClick={() => onOpenAllTasksFilter?.({ searchQuery: issue.idReadable })}
                  >
                    <span className="stats-item-id">{issue.idReadable}</span>
                    <span className="stats-item-summary">{issue.summary}</span>
                  </button>
                ))}
              </div>
            </details>

            <details className="stats-quality-item">
              <summary>
                <span className="stats-item-id">MKT Team</span>
                <span className="stats-item-summary">Missing: {dataQuality.missingTeam.length}</span>
              </summary>
              <div className="stats-quality-tasks">
                {dataQuality.missingTeam.slice(0, 20).map(issue => (
                  <button
                    key={issue.id}
                    type="button"
                    className="stats-list-item stats-list-item-action"
                    onClick={() => onOpenAllTasksFilter?.({ searchQuery: issue.idReadable })}
                  >
                    <span className="stats-item-id">{issue.idReadable}</span>
                    <span className="stats-item-summary">{issue.summary}</span>
                  </button>
                ))}
              </div>
            </details>

            <details className="stats-quality-item">
              <summary>
                <span className="stats-item-id">Start Date</span>
                <span className="stats-item-summary">Missing: {dataQuality.missingStartDate.length}</span>
              </summary>
              <div className="stats-quality-tasks">
                {dataQuality.missingStartDate.slice(0, 20).map(issue => (
                  <button
                    key={issue.id}
                    type="button"
                    className="stats-list-item stats-list-item-action"
                    onClick={() => onOpenAllTasksFilter?.({ searchQuery: issue.idReadable })}
                  >
                    <span className="stats-item-id">{issue.idReadable}</span>
                    <span className="stats-item-summary">{issue.summary}</span>
                  </button>
                ))}
              </div>
            </details>

            <details className="stats-quality-item">
              <summary>
                <span className="stats-item-id">Due Date</span>
                <span className="stats-item-summary">Missing: {dataQuality.missingDueDate.length}</span>
              </summary>
              <div className="stats-quality-tasks">
                {dataQuality.missingDueDate.slice(0, 20).map(issue => (
                  <button
                    key={issue.id}
                    type="button"
                    className="stats-list-item stats-list-item-action"
                    onClick={() => onOpenAllTasksFilter?.({ searchQuery: issue.idReadable })}
                  >
                    <span className="stats-item-id">{issue.idReadable}</span>
                    <span className="stats-item-summary">{issue.summary}</span>
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};