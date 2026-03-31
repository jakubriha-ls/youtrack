import React, { useState, useMemo } from 'react';
import { YouTrackIssue } from '../types';
import { formatDate, formatDateTime, isOverdue } from '../dateUtils';
import { STATUS_ORDER, getStatusDisplayName, getStatusIcon } from '../statusMeta';
import { useConfig } from '../ConfigContext';

interface AllTasksProps {
  issues: YouTrackIssue[];
}

type SortField =
  | 'id'
  | 'summary'
  | 'tag'
  | 'owner'
  | 'assignee'
  | 'team'
  | 'status'
  | 'dueDate'
  | 'updated';
type SortDirection = 'asc' | 'desc';

export const AllTasks: React.FC<AllTasksProps> = ({ issues }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(STATUS_ORDER);
  const [selectedProjectCategories, setSelectedProjectCategories] = useState<string[]>([]);
  const [showOnlyOverdue, setShowOnlyOverdue] = useState(false);
  const [showDueToday, setShowDueToday] = useState(false);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');
  const { config } = useConfig();

  const teams = useMemo(() => {
    const teamSet = new Set<string>();
    issues.forEach(issue => {
      if (issue.mktTeam && issue.mktTeam.length > 0) {
        issue.mktTeam.forEach(team => teamSet.add(team));
      }
    });
    return ['all', ...Array.from(teamSet).sort()];
  }, [issues]);

  const assignees = useMemo(() => {
    const assigneeSet = new Set<string>();
    issues.forEach(issue => {
      if (issue.assignee) assigneeSet.add(issue.assignee);
    });
    return ['all', ...Array.from(assigneeSet).sort((a, b) => a.localeCompare(b, 'cs'))];
  }, [issues]);

  const projectCategories = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(issue => {
      if (issue.projectCategory) set.add(issue.projectCategory);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [issues]);

  const isDueToday = (dueDate?: number): boolean => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() === today.getTime();
  };

  const toggleProjectCategory = (category: string) => {
    setSelectedProjectCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category],
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status],
    );
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedTeam('all');
    setSelectedAssignee('all');
    setSelectedStatuses(STATUS_ORDER);
    setSelectedProjectCategories([]);
    setShowOnlyOverdue(false);
    setShowDueToday(false);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count += 1;
    if (selectedTeam !== 'all') count += 1;
    if (selectedAssignee !== 'all') count += 1;
    if (selectedStatuses.length !== STATUS_ORDER.length) count += 1;
    if (selectedProjectCategories.length > 0) count += 1;
    if (showOnlyOverdue) count += 1;
    if (showDueToday) count += 1;
    return count;
  }, [
    searchQuery,
    selectedTeam,
    selectedAssignee,
    selectedStatuses,
    selectedProjectCategories,
    showOnlyOverdue,
    showDueToday,
  ]);

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      const matchesSearch = 
        issue.idReadable.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (issue.assignee || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (issue.projectCategory || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (issue.mktTeam || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      if (selectedTeam !== 'all') {
        const hasTeam = issue.mktTeam?.includes(selectedTeam);
        if (!hasTeam) return false;
      }

      if (selectedAssignee !== 'all' && issue.assignee !== selectedAssignee) {
        return false;
      }

      if (
        selectedStatuses.length > 0 &&
        !selectedStatuses.includes(getStatusDisplayName(issue.status))
      ) {
        return false;
      }

      if (
        selectedProjectCategories.length > 0 &&
        (!issue.projectCategory || !selectedProjectCategories.includes(issue.projectCategory))
      ) {
        return false;
      }

      if (showOnlyOverdue) {
        const isDone = issue.status === 'Done';
        if (isDone || !isOverdue(issue.dueDate)) return false;
      }

      if (showDueToday && !isDueToday(issue.dueDate)) {
        return false;
      }

      return true;
    });
  }, [
    issues,
    searchQuery,
    selectedTeam,
    selectedAssignee,
    selectedStatuses,
    selectedProjectCategories,
    showOnlyOverdue,
    showDueToday,
  ]);

  const sortedIssues = useMemo(() => {
    const sorted = [...filteredIssues];
    
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'id':
          aValue = a.idReadable;
          bValue = b.idReadable;
          break;
        case 'summary':
          aValue = a.summary.toLowerCase();
          bValue = b.summary.toLowerCase();
          break;
        case 'tag':
          aValue = a.tags?.join(',') || '';
          bValue = b.tags?.join(',') || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'team':
          aValue = a.mktTeam?.join(',') || '';
          bValue = b.mktTeam?.join(',') || '';
          break;
        case 'assignee':
          aValue = a.assignee || '';
          bValue = b.assignee || '';
          break;
        case 'owner':
          aValue = a.owner || '';
          bValue = b.owner || '';
          break;
        case 'dueDate':
          aValue = a.dueDate || 0;
          bValue = b.dueDate || 0;
          break;
        case 'updated':
          aValue = a.updated || 0;
          bValue = b.updated || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredIssues, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const toggleExpand = (issueId: string) => {
    setExpandedIssueId(expandedIssueId === issueId ? null : issueId);
  };

  const openInYouTrack = (issueId: string) => {
    window.open(`${config.baseUrl}/issue/${issueId}`, '_blank');
  };

  const toggleSelectIssue = (issueId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const newSelected = new Set(selectedIssues);
    if (newSelected.has(issueId)) {
      newSelected.delete(issueId);
    } else {
      newSelected.add(issueId);
    }
    setSelectedIssues(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIssues.size === sortedIssues.length) {
      setSelectedIssues(new Set());
    } else {
      setSelectedIssues(new Set(sortedIssues.map(i => i.id)));
    }
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedIssues.size === 0) return;
    console.info(`Neimplementovaná bulk akce "${bulkAction}" na ${selectedIssues.size} issues.`);
    setSelectedIssues(new Set());
    setBulkAction('');
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '⇅';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="all-tasks">
              <div className="all-tasks-header">
        <div className="header-top">
          <h2>All Tasks - Marketing</h2>
          <div className="all-tasks-header-right">
            <span className="task-count">
              {filteredIssues.length} {filteredIssues.length !== issues.length && `(z ${issues.length})`} tasků
            </span>
            <span className="task-count task-count-muted">Filtry: {activeFilterCount}</span>
            <button className="gantt-reset-btn" onClick={resetFilters}>
              Reset filtru
            </button>
          </div>
        </div>

        <div className="filters-row">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Hledat v názvech, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="team-filter"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            <option value="all">Všechny týmy</option>
            {teams.filter(t => t !== 'all').map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>

          <select
            className="team-filter"
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
          >
            <option value="all">Všichni assignees</option>
            {assignees.filter(a => a !== 'all').map(assignee => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>

          <div className="gantt-filter gantt-filter-multiselect all-tasks-status-filter">
            <label className="gantt-filter-label">Status:</label>
            <details className="gantt-multiselect">
              <summary className="gantt-multiselect-summary">
                {selectedStatuses.length > 0
                  ? `${selectedStatuses.length} vybráno`
                  : 'Všechny'}
              </summary>
              <div className="gantt-multiselect-menu">
                <button
                  type="button"
                  className="gantt-multiselect-clear"
                  onClick={() => setSelectedStatuses(STATUS_ORDER)}
                >
                  Všechny
                </button>
                {STATUS_ORDER.map(status => (
                  <label key={status} className="gantt-multiselect-option">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={() => toggleStatus(status)}
                    />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>

          <div className="gantt-filter gantt-filter-multiselect all-tasks-project-category-filter">
            <label className="gantt-filter-label">Project category:</label>
            <details className="gantt-multiselect">
              <summary className="gantt-multiselect-summary">
                {selectedProjectCategories.length > 0
                  ? `${selectedProjectCategories.length} vybráno`
                  : 'Všechny'}
              </summary>
              <div className="gantt-multiselect-menu">
                <button
                  type="button"
                  className="gantt-multiselect-clear"
                  onClick={() => setSelectedProjectCategories([])}
                >
                  Všechny
                </button>
                {projectCategories.map(category => (
                  <label key={category} className="gantt-multiselect-option">
                    <input
                      type="checkbox"
                      checked={selectedProjectCategories.includes(category)}
                      onChange={() => toggleProjectCategory(category)}
                    />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>

          <label className="checkbox-filter">
            <input
              type="checkbox"
              checked={showOnlyOverdue}
              onChange={(e) => setShowOnlyOverdue(e.target.checked)}
            />
            <span>Jen po termínu</span>
          </label>

          <label className="checkbox-filter">
            <input
              type="checkbox"
              checked={showDueToday}
              onChange={(e) => setShowDueToday(e.target.checked)}
            />
            <span>Due date: Today</span>
          </label>
        </div>

        {selectedIssues.size > 0 && (
          <div className="bulk-actions-bar">
            <span className="selected-count">{selectedIssues.size} vybraných</span>
            
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="bulk-action-select"
            >
              <option value="">Vyberte akci...</option>
              <option value="change-status">Změnit status</option>
              <option value="change-assignee">Změnit assignee</option>
              <option value="set-due-date">Nastavit due date</option>
              <option value="add-tag">Přidat tag</option>
            </select>

            <button 
              onClick={handleBulkAction}
              disabled={!bulkAction}
              className="btn-bulk-apply"
            >
              Aplikovat
            </button>

            <button 
              onClick={() => setSelectedIssues(new Set())}
              className="btn-bulk-cancel"
            >
              Zrušit výběr
            </button>
          </div>
        )}
      </div>

      <div className="all-tasks-table-container">
        <table className="all-tasks-table">
          <thead>
            <tr>
              <th className="col-checkbox">
                <input
                  type="checkbox"
                  checked={selectedIssues.size === sortedIssues.length && sortedIssues.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="col-id sortable" onClick={() => handleSort('id')}>
                ID {getSortIcon('id')}
              </th>
              <th className="col-summary sortable" onClick={() => handleSort('summary')}>
                Název {getSortIcon('summary')}
              </th>
              <th className="col-tag sortable" onClick={() => handleSort('tag')}>
                Tag {getSortIcon('tag')}
              </th>
              <th className="col-owner sortable" onClick={() => handleSort('owner')}>
                Owner {getSortIcon('owner')}
              </th>
              <th className="col-assignee sortable" onClick={() => handleSort('assignee')}>
                Assignee {getSortIcon('assignee')}
              </th>
              <th className="col-team sortable" onClick={() => handleSort('team')}>
                Team {getSortIcon('team')}
              </th>
              <th className="col-status sortable" onClick={() => handleSort('status')}>
                Status {getSortIcon('status')}
              </th>
              <th className="col-due-date sortable" onClick={() => handleSort('dueDate')}>
                Due Date {getSortIcon('dueDate')}
              </th>
              <th className="col-last-update sortable" onClick={() => handleSort('updated')}>
                Last update {getSortIcon('updated')}
              </th>
              <th className="col-actions">Akce</th>
            </tr>
          </thead>
          <tbody>
            {sortedIssues.map((issue) => {
              const isDone = issue.status === 'Done';
              const overdueClass = isOverdue(issue.dueDate) ? 'row-overdue' : '';
              const doneClass = isDone ? 'row-done' : '';
              const expandedClass = expandedIssueId === issue.id ? 'row-expanded' : '';

              return (
                <React.Fragment key={issue.id}>
                  <tr 
                    className={`task-row ${overdueClass} ${doneClass} ${expandedClass}`}
                    onClick={() => toggleExpand(issue.id)}
                  >
                    <td className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIssues.has(issue.id)}
                        onChange={(e) => toggleSelectIssue(issue.id, e)}
                      />
                    </td>
                    <td className="col-id">
                      <span className="expand-icon">{expandedIssueId === issue.id ? '▼' : '▶'}</span>
                      {issue.idReadable}
                    </td>
                    <td className="col-summary">
                      {issue.summary}
                      {issue.subtaskProgress && (
                        <span className="subtask-badge">
                          [{issue.subtaskProgress.done}/{issue.subtaskProgress.total}]
                        </span>
                      )}
                    </td>
                    <td className="col-tag">
                      {issue.tags && issue.tags.length > 0 ? issue.tags.join(', ') : '-'}
                    </td>
                    <td className="col-owner">
                      {issue.owner || '-'}
                    </td>
                    <td className="col-assignee">
                      {issue.assignee || '-'}
                    </td>
                    <td className="col-team">
                      {issue.mktTeam && issue.mktTeam.length > 0
                        ? issue.mktTeam.length > 2
                          ? `${issue.mktTeam.slice(0, 2).join(', ')}…`
                          : issue.mktTeam.join(', ')
                        : '-'}
                    </td>
                    <td className="col-status">
                      <span className="status-badge">
                        {issue.status || 'No Status'}
                      </span>
                    </td>
                    <td className="col-due-date">
                      {formatDate(issue.dueDate)}
                    </td>
                    <td className="col-last-update">
                      {formatDateTime(issue.updated)}
                    </td>
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-open-yt"
                        onClick={() => openInYouTrack(issue.idReadable)}
                        title="Otevřít v YouTrack"
                      >
                        🔗
                      </button>
                    </td>
                  </tr>

                  {expandedIssueId === issue.id && (                    <tr className="task-detail-row">
                      <td colSpan={11}>
                        <div className="task-detail">
                          <div className="detail-section">
                            <h4>📝 Popis</h4>
                            <p>{issue.description || 'Bez popisu'}</p>
                          </div>

                          <div className="detail-section">
                            <h4>📊 Detaily</h4>
                            <div className="detail-grid">
                              <div className="detail-item">
                                <span className="detail-label">Owner:</span>
                                <span className="detail-value">{issue.owner || '-'}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">Created:</span>
                                <span className="detail-value">{formatDateTime(issue.created)}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">Updated:</span>
                                <span className="detail-value">{formatDateTime(issue.updated)}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">Start Date:</span>
                                <span className="detail-value">{formatDate(issue.startDate)}</span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-label">Due Date:</span>
                                <span className="detail-value">{formatDate(issue.dueDate)}</span>
                              </div>
                            </div>
                          </div>

                          {issue.subtasks && issue.subtasks.length > 0 && (
                            <div className="detail-section">
                              <h4>🔗 Related & Subtasks ({issue.subtasks.length})</h4>
                              <div className="subtasks-list">
                                {issue.subtasks.map((subtask) => (
                                  <div key={subtask.id} className="subtask-item">
                                    <span className="subtask-icon">{getStatusIcon(subtask.status)}</span>
                                    <span className="subtask-id">{subtask.idReadable}</span>
                                    <span className="subtask-status">{subtask.status || 'No Status'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="detail-actions">
                            <button
                              className="btn-open-youtrack"
                              onClick={() => openInYouTrack(issue.idReadable)}
                            >
                              Otevřít v YouTrack →
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {sortedIssues.length === 0 && (
          <div className="no-results">
            <p>Žádné tasky neodpovídají vybraným filtrům</p>
          </div>
        )}
      </div>
    </div>
  );
};