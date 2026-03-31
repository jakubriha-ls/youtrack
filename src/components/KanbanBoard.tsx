import React, { useMemo } from 'react';
import { YouTrackIssue } from '../types';
import { formatDate, isOverdue } from '../dateUtils';
import { STATUS_ORDER, getStatusDisplayName, isDoneStatus } from '../statusMeta';
import { useConfig } from '../ConfigContext';

interface KanbanBoardProps {
  issues: YouTrackIssue[];
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ issues }) => {
  const { config } = useConfig();
  const youtrackUrl = config.baseUrl;

// Seskupení a seřazení podle fixního pořadí
const columns = useMemo(() => {
  const statusGroups: Record<string, YouTrackIssue[]> = {};
  
  issues.forEach(issue => {
    const status = getStatusDisplayName(issue.status);
    if (!statusGroups[status]) {
      statusGroups[status] = [];
    }
    statusGroups[status].push(issue);
  });

  // Seřadíme podle fixního pořadí
  const sortedColumns: Record<string, YouTrackIssue[]> = {};
  STATUS_ORDER.forEach(status => {
    if (statusGroups[status]) {
      sortedColumns[status] = statusGroups[status];
    }
  });

  // Přidáme ostatní statusy na konec (pokud nějaké existují)
  Object.keys(statusGroups).forEach(status => {
    if (!STATUS_ORDER.includes(status as any)) {
      sortedColumns[status] = statusGroups[status];
    }
  });

  return sortedColumns;
}, [issues]);

// Seřazení issues v každém sloupci podle due date
const sortedColumns = useMemo(() => {
  const result: Record<string, YouTrackIssue[]> = {};
  
  Object.entries(columns).forEach(([status, statusIssues]) => {
    result[status] = [...statusIssues].sort((a, b) => {
      // Tasky bez due date na konec
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      
      // Seřadit podle due date (nejbližší nahoře)
      return a.dueDate - b.dueDate;
    });
  });
  
  return result;
}, [columns]);

  const getDueDateClass = (dueDate?: number) => {
    if (!dueDate) return '';
    
    const now = Date.now();
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 3) return 'due-soon';
    if (daysUntilDue <= 7) return 'due-warning';
    return '';
  };

  const handleCardClick = (issueId: string) => {
    if (youtrackUrl) {
      const issueUrl = `${youtrackUrl}/issue/${issueId}`;
      window.open(issueUrl, '_blank');
    }
  };

  return (
    <div className="kanban-board">
      <h2>Kanban Board - Marketing</h2>
      
     <div className="kanban-columns">
  {Object.entries(sortedColumns).map(([status, statusIssues]) => (
          <div key={status} className="kanban-column">
            <div className="column-header">
              <h3>{status}</h3>
              <span className="issue-count">{statusIssues.length}</span>
            </div>
            
            <div className="column-cards">
              {statusIssues.map(issue => (
                <div 
  key={issue.id} 
  className={`kanban-card ${isOverdue(issue.dueDate) ? 'card-overdue' : ''} ${isDoneStatus(issue.status) ? 'card-done' : ''}`}
  onClick={() => handleCardClick(issue.idReadable)}
  title="Klikni pro otevření v YouTrack"
>
                  <div className="card-header">
                    <span className="card-id">{issue.idReadable}</span>
                    <span className="open-icon">🔗</span>
                  </div>
                  
                  <div className="card-title">{issue.summary}</div>
                  
                  <div className="card-meta">
                    {issue.assignee && (
                      <div className="meta-row">
                        <span className="meta-label">👤 Assignee:</span>
                        <span className="meta-value">{issue.assignee}</span>
                      </div>
                    )}
                    
                    <div className="meta-row">
                      <span className="meta-label">📅 Due Date:</span>
                      <span className={`meta-value ${getDueDateClass(issue.dueDate)}`}>
                        {formatDate(issue.dueDate)}
                      </span>
                    </div>
                    
                    {issue.mktTeam && issue.mktTeam.length > 0 && (
                      <div className="meta-row">
                        <span className="meta-label">👥 Team:</span>
                        <span className="meta-value">
                          {issue.mktTeam.length > 2
                            ? `${issue.mktTeam.slice(0, 2).join(', ')}…`
                            : issue.mktTeam.join(', ')}
                        </span>
                      </div>
                    )}
                    
                    {issue.owner && (
                      <div className="meta-row">
                        <span className="meta-label">✏️ Owner:</span>
                        <span className="meta-value">{issue.owner}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};