import React from 'react';
import { YouTrackIssue } from '../types';
import { STATUS_COLORS, STATUS_ORDER, getStatusDisplayName } from '../statusMeta';

interface StatisticsProps {
  issues: YouTrackIssue[];
}

export const Statistics: React.FC<StatisticsProps> = ({ issues }) => {
  // Seskupení issues podle týmů
  const issuesByTeam: Record<string, YouTrackIssue[]> = {};
  
  issues.forEach(issue => {
    if (issue.mktTeam && issue.mktTeam.length > 0) {
      issue.mktTeam.forEach(team => {
        if (!issuesByTeam[team]) {
          issuesByTeam[team] = [];
        }
        issuesByTeam[team].push(issue);
      });
    } else {
      if (!issuesByTeam['Bez týmu']) {
        issuesByTeam['Bez týmu'] = [];
      }
      issuesByTeam['Bez týmu'].push(issue);
    }
  });

  // Funkce pro získání statusů pro tým - FIXNÍ POŘADÍ
  const getTeamStatuses = (teamIssues: YouTrackIssue[]) => {
    const byStatus: Record<string, number> = {};
    
    teamIssues.forEach(issue => {
      const statusKey = getStatusDisplayName(issue.status);
      byStatus[statusKey] = (byStatus[statusKey] || 0) + 1;
    });
    
    return STATUS_ORDER.map(status => {
      return [status, byStatus[status] || 0] as [string, number];
    });
  };

  // Celkový počet všech issues
  const totalIssues = issues.length;

  // Seřazení týmů podle počtu issues (nejvíc → nejméně)
  const sortedTeams = Object.entries(issuesByTeam).sort(([, a], [, b]) => b.length - a.length);

  return (
    <div className="statistics">
      {/* Celkový počet - kolečko nahoře */}
      <div className="total-circle-container">
        <div className="total-circle">
          <div className="circle-content">
            <div className="circle-number">{totalIssues}</div>
            <div className="circle-label">Celkem tasků</div>
          </div>
        </div>
      </div>

      {/* Pipeline pro každý tým */}
      <div className="teams-pipelines">
        <h2>Pipeline podle týmů</h2>
        
        {sortedTeams.map(([teamName, teamIssues]) => {
          const teamTotal = teamIssues.length;
          const teamStatuses = getTeamStatuses(teamIssues);
          
          // Získáme jen statusy s issues pro výpočet celkové šířky
          const statusesWithIssues = teamStatuses.filter(([, count]) => count > 0);
          const totalPercentage = statusesWithIssues.reduce((sum, [, count]) => {
            return sum + (count / teamTotal) * 100;
          }, 0);

          return (
            <div key={teamName} className="team-pipeline-container">
              <div className="team-pipeline-header">
                <h3 className="team-pipeline-title">{teamName}</h3>
                <span className="team-pipeline-count">{teamTotal} tasků</span>
              </div>

              <div className="pipeline-bar">
                {teamStatuses.map(([status, count]) => {
                  const percentage = teamTotal > 0 ? (count / teamTotal) * 100 : 0;
                  const color = STATUS_COLORS[status] || '#95a5a6';
                  
                  // Pokud má status 0, nezobrazíme ho vůbec
                  if (count === 0) {
                    return null;
                  }
                  
                  // Normalizujeme šířku, aby celkem dávalo 100%
                  const normalizedWidth = totalPercentage > 0 ? (percentage / totalPercentage) * 100 : 0;
                  
                  return (
                    <div
                      key={status}
                      className="pipeline-segment"
                      style={{
                        width: `${normalizedWidth}%`,
                        backgroundColor: color,
                      }}
                      title={`${status}: ${count} (${percentage.toFixed(1)}%)`}
                    >
                      {normalizedWidth > 8 && (
                        <div className="pipeline-segment-content">
                          <span className="pipeline-count">{count}</span>
                          <span className="pipeline-label">{status}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legenda pro tento tým - zobrazí VŠECHNY statusy */}
              <div className="pipeline-legend">
                {teamStatuses
                  .filter(([, count]) => count > 0) // Zobrazíme jen statusy s issues
                  .map(([status, count]) => {
                    const percentage = (count / teamTotal) * 100;
                    const color = STATUS_COLORS[status] || '#95a5a6';
                    
                    return (
                      <div key={status} className="legend-item">
                        <span 
                          className="legend-color" 
                          style={{ backgroundColor: color }}
                        ></span>
                        <span className="legend-text">
                          {status}: <strong>{count}</strong> ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};