import React, { useEffect, useMemo, useRef, useState } from 'react';
import { YouTrackIssue } from '../types';
import { formatDate, isOverdue } from '../dateUtils';
import { STATUS_COLORS, STATUS_ORDER, getStatusDisplayName } from '../statusMeta';
import { useConfig } from '../ConfigContext';
import wc2026Logo from '../assets/wc2026-logo.svg';
import { getReadableTextColor } from '../colorUtils';

interface GanttChartProps {
  issues: YouTrackIssue[];
  variant?: 'wc' | 'all';
}

export const GanttChart: React.FC<GanttChartProps> = ({
  issues,
  variant = 'wc',
}) => {
  const { config } = useConfig();
  const isAllTasksVariant = variant === 'all';
  const [sortBy, setSortBy] = useState<'timeline' | 'name' | 'assignee'>('timeline');
  const [expandedParentIds, setExpandedParentIds] = useState<string[]>([]);
  const [assigneeFilters, setAssigneeFilters] = useState<string[]>([]);
  const [mktTeamFilters, setMktTeamFilters] = useState<string[]>([]);
  const [projectCategoryFilters, setProjectCategoryFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('__all__');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(STATUS_ORDER);
  const [search, setSearch] = useState<string>('');
  const [showClosedTasks, setShowClosedTasks] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const UI_STORAGE_KEY = isAllTasksVariant ? 'gantt-all-ui-v1' : 'gantt-ui-v1';

  useEffect(() => {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<{
        assigneeFilter: string;
        assigneeFilters: string[];
        mktTeamFilter: string;
        mktTeamFilters: string[];
        projectCategoryFilter: string;
        projectCategoryFilters: string[];
        statusFilter: string;
        selectedStatuses: string[];
        search: string;
        expandedParentIds: string[];
        showClosedTasks: boolean;
        sortBy: 'timeline' | 'name' | 'assignee';
      }>;
      // backward compatibility – původně single-select
      if (Array.isArray(parsed.assigneeFilters)) {
        setAssigneeFilters(parsed.assigneeFilters);
      } else if (parsed.assigneeFilter && parsed.assigneeFilter !== '__all__') {
        setAssigneeFilters([parsed.assigneeFilter]);
      }
      if (Array.isArray(parsed.mktTeamFilters)) {
        setMktTeamFilters(parsed.mktTeamFilters);
      } else if (parsed.mktTeamFilter && parsed.mktTeamFilter !== '__all__') {
        setMktTeamFilters([parsed.mktTeamFilter]);
      }
      if (Array.isArray(parsed.projectCategoryFilters)) {
        setProjectCategoryFilters(parsed.projectCategoryFilters);
      } else if (
        parsed.projectCategoryFilter &&
        parsed.projectCategoryFilter !== '__all__'
      ) {
        // backward compatibility for previous single-select storage
        setProjectCategoryFilters([parsed.projectCategoryFilter]);
      }
      if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
      if (Array.isArray(parsed.selectedStatuses)) {
        setSelectedStatuses(parsed.selectedStatuses);
      }
      if (typeof parsed.search === 'string') setSearch(parsed.search);
      if (Array.isArray(parsed.expandedParentIds)) {
        setExpandedParentIds(parsed.expandedParentIds);
      }
      if (typeof parsed.showClosedTasks === 'boolean') {
        setShowClosedTasks(parsed.showClosedTasks);
      }
      if (parsed.sortBy) {
        setSortBy(parsed.sortBy);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        assigneeFilters,
        mktTeamFilters,
        projectCategoryFilters,
        statusFilter,
        selectedStatuses,
        search,
        expandedParentIds,
        showClosedTasks,
        sortBy,
      }),
    );
  }, [
    assigneeFilters,
    mktTeamFilters,
    projectCategoryFilters,
    statusFilter,
    selectedStatuses,
    search,
    expandedParentIds,
    showClosedTasks,
    sortBy,
  ]);

  const DEBUG = false;

  const DAY_MS = 24 * 60 * 60 * 1000;

  // Normalizace na lokální půlnoc – konzistentní s POC
  const toLocalMidnight = (timestamp: number): number => {
    const d = new Date(timestamp);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  // Spodní/ horní hranice osy
  const CLAMP_START = toLocalMidnight(new Date(2026, 0, 1).getTime()); // 1.1.2026
  // Horní hranice osy – 31. 8. 2026 (včetně)
  const CLAMP_END = toLocalMidnight(new Date(2026, 7, 31).getTime()); // měsíce 0–11 → 7 = srpen

  // World Cup pevné body
  const WC_START_TS = toLocalMidnight(new Date(2026, 5, 11).getTime()); // 11. 6. 2026
  const WC_END_TS = toLocalMidnight(new Date(2026, 6, 19).getTime()); // 19. 7. 2026

  // Filtrujeme pouze issues s Start Date a Due Date, bez "Master Task" v názvu
  // a zároveň jen ty, které začínají nejpozději v CLAMP_END (jinak by bar byl celý za osou)
  const availableAssignees = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => {
      if (i.assignee) set.add(i.assignee);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [issues]);

  const availableMktTeams = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => {
      i.mktTeam?.forEach(t => set.add(t));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [issues]);

  const availableProjectCategories = useMemo(() => {
    const set = new Set<string>();
    issues.forEach(i => {
      if (i.projectCategory) set.add(i.projectCategory);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [issues]);

  const toggleProjectCategory = (category: string) => {
    setProjectCategoryFilters(prev =>
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
    setAssigneeFilters([]);
    setMktTeamFilters([]);
    setProjectCategoryFilters([]);
    setStatusFilter('__all__');
    setSelectedStatuses(STATUS_ORDER);
    setSearch('');
    setShowClosedTasks(true);
  };

  const toggleExpandedParent = (issueId: string) => {
    setExpandedParentIds(prev =>
      prev.includes(issueId)
        ? prev.filter(id => id !== issueId)
        : [...prev, issueId],
    );
  };

  const compareIssues = (a: YouTrackIssue, b: YouTrackIssue): number => {
    const byId = a.idReadable.localeCompare(b.idReadable, 'cs');
    if (sortBy === 'name') {
      const bySummary = a.summary.localeCompare(b.summary, 'cs');
      return bySummary || byId;
    }
    if (sortBy === 'assignee') {
      const byAssignee = (a.assignee || '').localeCompare(b.assignee || '', 'cs');
      const bySummary = a.summary.localeCompare(b.summary, 'cs');
      return byAssignee || bySummary || byId;
    }

    // timeline (default): start asc -> due asc -> id
    const aStart = a.startDate ?? Number.MAX_SAFE_INTEGER;
    const bStart = b.startDate ?? Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) return aStart - bStart;
    const aDue = a.dueDate ?? Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ?? Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    return byId;
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (assigneeFilters.length > 0) count += 1;
    if (mktTeamFilters.length > 0) count += 1;
    if (projectCategoryFilters.length > 0) count += 1;
    if (search.trim()) count += 1;
    if (isAllTasksVariant) {
      if (selectedStatuses.length !== STATUS_ORDER.length) count += 1;
    } else if (statusFilter !== '__all__') {
      count += 1;
    }
    return count;
  }, [
    assigneeFilters,
    mktTeamFilters,
    projectCategoryFilters,
    search,
    isAllTasksVariant,
    selectedStatuses,
    statusFilter,
  ]);

  const issuesWithDates = useMemo<YouTrackIssue[]>(() => {
    const q = search.trim().toLowerCase();
    return issues.filter(issue => {
      if (!issue.startDate || !issue.dueDate) return false;
      if (!isAllTasksVariant && issue.summary.toLowerCase().includes('master task')) {
        return false;
      }
      if (!showClosedTasks && getStatusDisplayName(issue.status) === 'Done') {
        return false;
      }
      if (toLocalMidnight(issue.startDate) > CLAMP_END) return false;
      if (
        assigneeFilters.length > 0 &&
        (!issue.assignee || !assigneeFilters.includes(issue.assignee))
      ) {
        return false;
      }
      if (
        mktTeamFilters.length > 0 &&
        (!issue.mktTeam || !issue.mktTeam.some(team => mktTeamFilters.includes(team)))
      ) {
        return false;
      }
      if (
        projectCategoryFilters.length > 0 &&
        (!issue.projectCategory ||
          !projectCategoryFilters.includes(issue.projectCategory))
      )
        return false;
      if (
        !isAllTasksVariant &&
        statusFilter !== '__all__' &&
        getStatusDisplayName(issue.status) !== statusFilter
      ) {
        return false;
      }
      if (
        isAllTasksVariant &&
        selectedStatuses.length > 0 &&
        !selectedStatuses.includes(getStatusDisplayName(issue.status))
      ) {
        return false;
      }
      if (q) {
        const haystack = [
          issue.summary,
          issue.idReadable,
          issue.assignee ?? '',
          issue.projectCategory ?? '',
          ...(issue.mktTeam ?? []),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    issues,
    assigneeFilters,
    mktTeamFilters,
    projectCategoryFilters,
    statusFilter,
    selectedStatuses,
    search,
    CLAMP_END,
    isAllTasksVariant,
    showClosedTasks,
  ]);

  // Osa: pevně od 1. 1. 2026 do CLAMP_END (31. 8. 2026)
  const { minDay, maxDay, totalDays } = useMemo(() => {
    if (issuesWithDates.length === 0) {
      const startIdx = Math.floor(CLAMP_START / DAY_MS);
      const endIdx = Math.floor(CLAMP_END / DAY_MS);
      const days = endIdx - startIdx + 1;

      return {
        minDay: startIdx * DAY_MS,
        maxDay: (endIdx + 1) * DAY_MS,
        totalDays: days,
      };
    }

    const maxFromData = Math.max(
      ...issuesWithDates.map(i => toLocalMidnight(i.dueDate!)),
    );
    const effectiveEnd = Math.min(maxFromData, CLAMP_END);

    const startIdx = Math.floor(CLAMP_START / DAY_MS);
      const endIdx = Math.floor(effectiveEnd / DAY_MS);
      const days = endIdx - startIdx + 1;

      return {
        minDay: startIdx * DAY_MS,
        maxDay: (endIdx + 1) * DAY_MS,
        totalDays: days,
      };
  }, [issuesWithDates, CLAMP_START, CLAMP_END]);

  const dayIndex = (timestamp: number): number => {
    const t = toLocalMidnight(timestamp);
    return (
      Math.floor(t / DAY_MS) -
      Math.floor(minDay / DAY_MS)
    );
  };

  const getPosition = (timestamp: number): number => {
    const idx = dayIndex(timestamp);
    return (idx / totalDays) * 100;
  };

  const getWidth = (start: number, end: number): number => {
    const startIdx = dayIndex(start);
    const rawEndIdx = dayIndex(end);
    const endIdx = Math.min(rawEndIdx, totalDays - 1); // tasky po 31. 8. ořízneme na konec osy
    const spanDays = Math.max(endIdx - startIdx + 1, 1); // inkluzivně, aspoň 1 den
    return (spanDays / totalDays) * 100;
  };

  const getDebugInfo = (issue: YouTrackIssue): string => {
    const startLocal = toLocalMidnight(issue.startDate!);
    const endLocal = toLocalMidnight(issue.dueDate!);
    const leftPct = getPosition(issue.startDate!);
    const widthPct = getWidth(issue.startDate!, issue.dueDate!);

    return [
      `startTs=${issue.startDate}`,
      `endTs=${issue.dueDate}`,
      `startLocal=${new Date(startLocal).toISOString().slice(0, 10)}`,
      `endLocal=${new Date(endLocal).toISOString().slice(0, 10)}`,
      `left=${leftPct.toFixed(2)}%`,
      `width=${widthPct.toFixed(2)}%`,
    ].join(' | ');
  };

  // Barva baru podle statusu
  const getStatusColor = (status?: string): string => {
    const key = getStatusDisplayName(status);
    return STATUS_COLORS[key] || '#667eea';
  };

  const getProgressTone = (percentage: number): 'low' | 'mid' | 'high' | 'done' => {
    if (percentage >= 100) return 'done';
    if (percentage >= 70) return 'high';
    if (percentage >= 30) return 'mid';
    return 'low';
  };

  // reserved for future (e.g. sticky timeline scroll sync)
  void containerRef;

  // Tooltip text s informacemi o subtaskách
  const getTooltipText = (issue: YouTrackIssue): string => {
    let text = `${issue.summary}\n${issue.idReadable}\n${formatDate(issue.startDate!)} - ${formatDate(issue.dueDate!)}`;
    
    if (issue.subtaskProgress) {
      text += `\n\nProgress: ${issue.subtaskProgress.done}/${issue.subtaskProgress.total} subtasků (${issue.subtaskProgress.percentage.toFixed(0)}%)`;
    }
    
    return text;
  };

  // Sestavíme parent rows + jejich children (subtasks/related).
  const groupedItems = useMemo(
    () => {
      const byId = new Map<string, YouTrackIssue>();
      const sortedIssues = [...issuesWithDates].sort(compareIssues);
      sortedIssues.forEach(issue => {
        byId.set(issue.id, issue);
      });

      // označíme všechny issues, které někde vystupují jako subtask/related-child
      const childIds = new Set<string>();
      sortedIssues.forEach(issue => {
        issue.subtasks?.forEach(sub => {
          childIds.add(sub.id);
        });
      });

      const result: Array<{
        issue: YouTrackIssue;
        children: Array<{ issue: YouTrackIssue; relationType: 'subtask' | 'related' }>;
      }> = [];
      const visited = new Set<string>();

      sortedIssues.forEach(issue => {
        if (visited.has(issue.id)) return;

        const isChildOnly = childIds.has(issue.id);
        // Pokud je issue pouze subtaskem někoho jiného, nebudeme ho renderovat jako root
        if (!isChildOnly) {
          result.push({ issue, children: [] });
          visited.add(issue.id);
        }

        const parentGroup = result.find(group => group.issue.id === issue.id);
        const sortedChildren = (issue.subtasks ?? [])
          .slice()
          .sort((a, b) => {
            const rankA = a.relationType === 'related' ? 1 : 0;
            const rankB = b.relationType === 'related' ? 1 : 0;
            if (rankA !== rankB) return rankA - rankB;
            const issueA = byId.get(a.id);
            const issueB = byId.get(b.id);
            if (!issueA || !issueB) {
              return a.idReadable.localeCompare(b.idReadable, 'cs');
            }
            return compareIssues(issueA, issueB);
          });
        if (sortedChildren.length > 0) {
          sortedChildren.forEach(sub => {
            const subIssue = byId.get(sub.id);
            if (subIssue && !visited.has(subIssue.id)) {
              const relType = sub.relationType === 'related' ? 'related' : 'subtask';
              if (parentGroup) {
                parentGroup.children.push({ issue: subIssue, relationType: relType });
              }
              visited.add(subIssue.id);
            }
          });
        }
      });

      return result;
    },
    [issuesWithDates, sortBy],
  );

  const orderedItems = useMemo(() => {
    const flattened: Array<{
      issue: YouTrackIssue;
      relationType: 'root' | 'subtask' | 'related';
      hasChildren: boolean;
    }> = [];

    groupedItems.forEach(group => {
      const hasChildren = group.children.length > 0;
      flattened.push({
        issue: group.issue,
        relationType: 'root',
        hasChildren,
      });

      if (hasChildren && expandedParentIds.includes(group.issue.id)) {
        group.children.forEach(child => {
          flattened.push({
            issue: child.issue,
            relationType: child.relationType,
            hasChildren: false,
          });
        });
      }
    });

    return flattened;
  }, [groupedItems, expandedParentIds]);

  const expandableParentIds = useMemo(
    () => groupedItems.filter(group => group.children.length > 0).map(group => group.issue.id),
    [groupedItems],
  );
  const areAllParentsExpanded =
    expandableParentIds.length > 0 &&
    expandableParentIds.every(id => expandedParentIds.includes(id));

  // Generujeme měsíce pro osu X – jen v rozsahu min/max dat
  const months = useMemo(() => {
    const result: Array<{ label: string; position: number }> = [];

    const start = new Date(minDay);
    const end = new Date(maxDay);

    const current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
      const t = current.getTime();
      const label = current.toLocaleDateString('cs-CZ', {
        month: 'short',
        year: '2-digit',
      });

      result.push({
        label,
        position: getPosition(t),
      });

      current.setMonth(current.getMonth() + 1, 1);
    }

    return result;
  }, [minDay, maxDay, totalDays]);

  // Pozice dnešního dne pro vertikální čáru
  const todayPosition = useMemo(() => {
    const todayMidnight = toLocalMidnight(Date.now());
    const pct = getPosition(todayMidnight);
    if (pct < 0 || pct > 100) {
      return null;
    }
    return pct;
  }, [getPosition]);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    [],
  );

  if (issuesWithDates.length === 0) {
    return (
      <div className="gantt-chart">
        {isAllTasksVariant ? (
          <h2 className="gantt-worldcup-title">Marketing Tasks</h2>
        ) : (
          <div className="gantt-worldcup-heading">
            <img className="gantt-worldcup-logo" src={wc2026Logo} alt="FIFA World Cup 2026" />
            <div className="gantt-worldcup-text">
              <h2 className="gantt-worldcup-title">Road to World Cup 2026</h2>
              <div className="gantt-host-flags" aria-label="Host countries">
                <span className="gantt-flag" title="USA">🇺🇸</span>
                <span className="gantt-flag" title="Mexico">🇲🇽</span>
                <span className="gantt-flag" title="Canada">🇨🇦</span>
              </div>
            </div>
          </div>
        )}
        <div className="no-data">
          Žádné issues nemají nastavené Start Date a Due Date
        </div>
      </div>
    );
  }

  return (
    <div className="gantt-chart">
      {isAllTasksVariant ? (
        <h2 className="gantt-worldcup-title">Marketing Tasks</h2>
      ) : (
        <div className="gantt-worldcup-heading">
          <img className="gantt-worldcup-logo" src={wc2026Logo} alt="FIFA World Cup 2026" />
          <div className="gantt-worldcup-text">
            <h2 className="gantt-worldcup-title">Road to World Cup 2026</h2>
            <div className="gantt-host-flags" aria-label="Host countries">
              <span className="gantt-flag" title="USA">🇺🇸</span>
              <span className="gantt-flag" title="Mexico">🇲🇽</span>
              <span className="gantt-flag" title="Canada">🇨🇦</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="gantt-legend">
        <div className="gantt-filter gantt-filter--search">
          <label className="gantt-filter-label" htmlFor="gantt-search">
            Search:
          </label>
          <input
            id="gantt-search"
            className="gantt-filter-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Summary / ID / assignee…"
          />
        </div>
        <div className="gantt-filter">
          <label className="gantt-filter-label" htmlFor="gantt-sort-by">
            Sort by:
          </label>
          <select
            id="gantt-sort-by"
            className="gantt-filter-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'timeline' | 'name' | 'assignee')}
          >
            <option value="timeline">Timeline</option>
            <option value="name">Name</option>
            <option value="assignee">Assignee</option>
          </select>
        </div>
        <div className="gantt-filter gantt-filter-multiselect">
          <label className="gantt-filter-label" htmlFor="gantt-assignee-filter">
            Assignee:
          </label>
          <details className="gantt-multiselect" id="gantt-assignee-filter">
            <summary className="gantt-multiselect-summary">
              {assigneeFilters.length > 0 ? `${assigneeFilters.length} vybráno` : 'Všichni'}
            </summary>
            <div className="gantt-multiselect-menu">
              <button
                type="button"
                className="gantt-multiselect-clear"
                onClick={() => setAssigneeFilters([])}
              >
                Všichni
              </button>
              {availableAssignees.map(a => (
                <label key={a} className="gantt-multiselect-option">
                  <input
                    type="checkbox"
                    checked={assigneeFilters.includes(a)}
                    onChange={() =>
                      setAssigneeFilters(prev =>
                        prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a],
                      )
                    }
                  />
                  <span>{a}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
        {isAllTasksVariant ? (
          <div className="gantt-filter gantt-filter-multiselect">
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
        ) : (
          <div className="gantt-filter">
            <label className="gantt-filter-label" htmlFor="gantt-status-filter">
              Status:
            </label>
            <select
              id="gantt-status-filter"
              className="gantt-filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="__all__">Všechny</option>
              {STATUS_ORDER.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="gantt-filter gantt-filter-multiselect">
          <label className="gantt-filter-label" htmlFor="gantt-mkt-team-filter">
            MKT Team:
          </label>
          <details className="gantt-multiselect" id="gantt-mkt-team-filter">
            <summary className="gantt-multiselect-summary">
              {mktTeamFilters.length > 0 ? `${mktTeamFilters.length} vybráno` : 'Všechny'}
            </summary>
            <div className="gantt-multiselect-menu">
              <button
                type="button"
                className="gantt-multiselect-clear"
                onClick={() => setMktTeamFilters([])}
              >
                Všechny
              </button>
              {availableMktTeams.map(team => (
                <label key={team} className="gantt-multiselect-option">
                  <input
                    type="checkbox"
                    checked={mktTeamFilters.includes(team)}
                    onChange={() =>
                      setMktTeamFilters(prev =>
                        prev.includes(team) ? prev.filter(t => t !== team) : [...prev, team],
                      )
                    }
                  />
                  <span>{team}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
        <div className="gantt-filter gantt-filter-multiselect">
          <label className="gantt-filter-label" htmlFor="gantt-project-category-filter">
            Project category:
          </label>
          <details className="gantt-multiselect" id="gantt-project-category-filter">
            <summary className="gantt-multiselect-summary">
              {projectCategoryFilters.length > 0
                ? `${projectCategoryFilters.length} vybráno`
                : 'Všechny'}
            </summary>
            <div className="gantt-multiselect-menu">
              <button
                type="button"
                className="gantt-multiselect-clear"
                onClick={() => setProjectCategoryFilters([])}
              >
                Všechny
              </button>
              {availableProjectCategories.map(category => (
                <label key={category} className="gantt-multiselect-option">
                  <input
                    type="checkbox"
                    checked={projectCategoryFilters.includes(category)}
                    onChange={() => toggleProjectCategory(category)}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
        {STATUS_ORDER.map(status => (
          <div key={status} className="gantt-legend-item">
            <span
              className="gantt-legend-color"
              style={{ backgroundColor: STATUS_COLORS[status] || '#95a5a6' }}
            />
            <span className="gantt-legend-label">{status}</span>
          </div>
        ))}
        <div className="gantt-legend-item gantt-active-filters-chip">
          Filtry: {activeFilterCount}
        </div>
        <label className="checkbox-filter">
          <input
            type="checkbox"
            checked={areAllParentsExpanded}
            disabled={expandableParentIds.length === 0}
            onChange={(e) =>
              setExpandedParentIds(e.target.checked ? expandableParentIds : [])
            }
          />
          <span>Expand all</span>
        </label>
        <label className="checkbox-filter">
          <input
            type="checkbox"
            checked={showClosedTasks}
            onChange={(e) => setShowClosedTasks(e.target.checked)}
          />
          <span>Show closed tasks (Done)</span>
        </label>
        <button className="gantt-reset-btn" onClick={resetFilters}>
          Reset filtru
        </button>
      </div>

      <div
        className="gantt-container"
        ref={containerRef}
      >
        {/* Časová osa – vizuálně posunutá doprava o šířku panelu s tasky */}
        <div className="gantt-timeline">
          <div className="timeline-header">
            <div className="timeline-inner">
              {todayPosition !== null && (
                <div
                  className="timeline-today-label"
                  style={{ left: `${todayPosition}%` }}
                >
                  {todayLabel}
                </div>
              )}
              {!isAllTasksVariant && (() => {
                const startPct = getPosition(WC_START_TS);
                const endPct = getPosition(WC_END_TS);
                const startVisible = startPct >= 0 && startPct <= 100;
                const endVisible = endPct >= 0 && endPct <= 100;
                const rangeLeft = Math.min(startPct, endPct);
                const rangeRight = Math.max(startPct, endPct);
                const rangeWidth = Math.max(rangeRight - rangeLeft, 0);
                return (
                  <>
                    {startVisible && endVisible && rangeWidth > 0 && (
                      <div
                        className="gantt-fixed-range"
                        style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
                        aria-hidden="true"
                      />
                    )}
                    {startVisible && (
                      <div
                        className="timeline-fixed-label timeline-fixed-start"
                        style={{ left: `${startPct}%` }}
                      >
                        World Cup start
                      </div>
                    )}
                    {endVisible && (
                      <div
                        className="timeline-fixed-label timeline-fixed-end"
                        style={{ left: `${endPct}%` }}
                      >
                        World Cup end
                      </div>
                    )}
                  </>
                );
              })()}
              {months.map((month, idx) => (
                <div
                  key={idx}
                  className="timeline-month"
                  style={{ left: `${month.position}%` }}
                >
                  {month.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Issues – jeden řádek = info vlevo + bar vpravo */}
        <div className="gantt-rows">
          {todayPosition !== null && (
            <div className="gantt-today-track">
              <div className="gantt-today-line" style={{ left: `${todayPosition}%` }} />
            </div>
          )}
          {!isAllTasksVariant && (() => {
            const startPct = getPosition(WC_START_TS);
            const endPct = getPosition(WC_END_TS);
            const startVisible = startPct >= 0 && startPct <= 100;
            const endVisible = endPct >= 0 && endPct <= 100;
            const rangeLeft = Math.min(startPct, endPct);
            const rangeRight = Math.max(startPct, endPct);
            const rangeWidth = Math.max(rangeRight - rangeLeft, 0);
            return (
              <>
                {startVisible && endVisible && rangeWidth > 0 && (
                  <div className="gantt-fixed-track" aria-hidden="true">
                    <div
                      className="gantt-fixed-range"
                      style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
                    />
                  </div>
                )}
                {startVisible && (
                  <div className="gantt-fixed-track">
                    <div
                      className="gantt-fixed-line gantt-fixed-line-start"
                      style={{ left: `${startPct}%` }}
                    />
                  </div>
                )}
                {endVisible && (
                  <div className="gantt-fixed-track">
                    <div
                      className="gantt-fixed-line gantt-fixed-line-end"
                      style={{ left: `${endPct}%` }}
                    />
                  </div>
                )}
              </>
            );
          })()}
          {orderedItems.map(({ issue, relationType, hasChildren }) => {
            const left = getPosition(issue.startDate!);
            const width = getWidth(issue.startDate!, issue.dueDate!);
            const overdue = isOverdue(issue.dueDate) && issue.status !== 'Done';
            const isDone = issue.status === 'Done';
            const barBg = getStatusColor(issue.status);
            const { color: barTextColor, isLight } = getReadableTextColor(barBg);
            const isExpanded = expandedParentIds.includes(issue.id);

            return (
              <div
                key={issue.id}
                className={`gantt-row ${
                  relationType === 'subtask'
                    ? 'gantt-row-subtask'
                    : relationType === 'related'
                    ? 'gantt-row-related'
                    : ''
                } ${overdue ? 'gantt-row-overdue' : ''} ${
                  isDone ? 'gantt-row-done' : ''
                }`}
              >
                <div className="gantt-row-info">
                  <div className="issue-summary">
                    {relationType === 'root' && hasChildren && (
                      <button
                        type="button"
                        className="gantt-expand-btn"
                        onClick={() => toggleExpandedParent(issue.id)}
                        title={isExpanded ? 'Sbalit subtasky' : 'Rozbalit subtasky'}
                        aria-label={isExpanded ? 'Sbalit subtasky' : 'Rozbalit subtasky'}
                      >
                        {isExpanded ? '▾' : '▸'}
                      </button>
                    )}
                    {relationType === 'subtask' && (
                      <span className="gantt-link-arrow gantt-link-arrow-subtask">
                        ↳
                      </span>
                    )}
                    {relationType === 'related' && (
                      <span className="gantt-link-arrow gantt-link-arrow-related">
                        ⇄
                      </span>
                    )}
                    <span className="issue-summary-text">{issue.summary}</span>
                  </div>
                  <div className="issue-id">
                    <span className="issue-id-text">({issue.idReadable})</span>
                  </div>
                  {DEBUG && <div className="issue-debug">{getDebugInfo(issue)}</div>}
                  <div className="issue-meta">
                    {issue.mktTeam && issue.mktTeam.length > 0 && (
                      <span className="meta-team">
                        👥{' '}
                        {issue.mktTeam.length > 2
                          ? `${issue.mktTeam.slice(0, 2).join(', ')}…`
                          : issue.mktTeam.join(', ')}
                      </span>
                    )}
                    {issue.assignee && (
                      <span className="meta-assignee">👤 {issue.assignee}</span>
                    )}
                    {issue.startDate && (
                      <span className="meta-dates">
                        🕒 {formatDate(issue.startDate)} –{' '}
                        {formatDate(issue.dueDate)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="gantt-bar-container">
                  <div
                    className={`gantt-bar ${
                      relationType === 'subtask'
                        ? 'gantt-bar-subtask'
                        : relationType === 'related'
                        ? 'gantt-bar-related'
                        : ''
                    }`}
                    data-status={getStatusDisplayName(issue.status)}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: barBg,
                      color: barTextColor,
                      borderColor: isLight ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.18)',
                      textShadow: isLight ? '0 1px 1px rgba(0,0,0,0.35)' : 'none',
                    }}
                    title={getTooltipText(issue)}
                    onClick={() =>
                      window.open(
                        `${config.baseUrl}/issue/${issue.idReadable}`,
                        '_blank',
                      )
                    }
                  >
                    <span className="bar-label">
                      {relationType === 'subtask'
                        ? `↳ ${issue.summary}`
                        : issue.summary}
                    </span>

                    {issue.subtaskProgress && (
                      <span
                        className={`bar-subtask-count bar-subtask-count-${getProgressTone(
                          issue.subtaskProgress.percentage,
                        )}`}
                      >
                        {issue.subtaskProgress.percentage.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};