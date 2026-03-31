export interface YouTrackConfig {
  baseUrl: string;
  token?: string;
  dashboardPassword?: string;
}

export interface SubTask {
  id: string;
  idReadable: string;
  status?: string;
  relationType?: 'subtask' | 'related';
}

export interface IssueRelation {
  id: string;
  idReadable: string;
  status?: string;
  relationType: 'subtask' | 'related' | 'parent';
}

export interface SubTaskProgress {
  total: number;
  done: number;
  percentage: number;
}

export interface CustomField {
  name: string;
  value: any;
}

export interface YouTrackIssue {
  id: string;
  idReadable: string;
  summary: string;
  description?: string;
  created: number;
  updated: number;
  resolved?: number;
  customFields?: CustomField[];
  // Subtasky
  subtasks?: SubTask[];
  relations?: IssueRelation[];
  subtaskProgress?: SubTaskProgress;
  // Pro snadnější přístup
  status?: string;
  tags?: string[];
  mktTeam?: string[];
  projectCategory?: string;
  assignee?: string;
  owner?: string;
  startDate?: number;
  dueDate?: number;
}

export interface Project {
  id: string;
  name: string;
  shortName: string;
}

export interface MarketingStats {
  totalIssues: number;
  byStatus: Record<string, number>;
  byTeam: Record<string, number>;
}

export interface AllTasksFilterPreset {
  searchQuery?: string;
  teams?: string[];
  assignees?: string[];
  statuses?: string[];
  projectCategories?: string[];
  showOnlyOverdue?: boolean;
  showDueToday?: boolean;
}