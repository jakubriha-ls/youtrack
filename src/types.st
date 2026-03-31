export interface YouTrackConfig {
  baseUrl: string;
  token: string;
}

export interface SubTask {
  id: string;
  idReadable: string;
  status?: string;
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
  subtaskProgress?: {
    total: number;
    done: number;
    percentage: number;
  };
  // Pro snadnější přístup
  status?: string;
  mktTeam?: string[];
  assignee?: string;
  owner?: string;
  startDate?: number;
  dueDate?: number;
}

export interface CustomField {
  name: string;
  value: any;
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