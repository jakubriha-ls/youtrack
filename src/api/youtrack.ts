import axios, { AxiosInstance } from 'axios';
import { YouTrackConfig, YouTrackIssue, SubTask } from '../types';

export class YouTrackAPI {
  private client: AxiosInstance;
  private readonly issueFields =
    'id,idReadable,summary,description,created,updated,resolved,' +
    'tags(name),' +
    'customFields(name,value(name,login)),' +
    'links(direction,linkType(name),issues(id,idReadable,customFields(name,value(name))))';

  constructor(config: YouTrackConfig) {
    this.client = axios.create({
      baseURL: '/api/youtrack',
      headers: {
        ...(config.baseUrl ? { 'X-YouTrack-Base-Url': config.baseUrl } : {}),
        ...(config.token ? { 'X-YouTrack-Token': config.token } : {}),
        ...(config.dashboardPassword
          ? { 'X-Dashboard-Password': config.dashboardPassword }
          : {}),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  private parseCustomFields(issue: any): YouTrackIssue {
    const parsed: YouTrackIssue = {
      id: issue.id,
      idReadable: issue.idReadable,
      summary: issue.summary,
      description: issue.description,
      created: issue.created,
      updated: issue.updated,
      resolved: issue.resolved,
      customFields: issue.customFields || [],
      tags: Array.isArray(issue.tags)
        ? issue.tags
            .map((t: any) => t?.name)
            .filter((name: string | undefined): name is string => Boolean(name))
        : [],
    };

    // Parsování custom fieldů
    issue.customFields?.forEach((field: any) => {
      switch (field.name) {
        case 'Status':
          parsed.status = field.value?.name || 'No Status';  // ← OPRAVENO
          break;
        case 'MKT Team':
          if (Array.isArray(field.value)) {
            parsed.mktTeam = field.value.map((v: any) => v.name);
          } else if (field.value?.name) {
            parsed.mktTeam = [field.value.name];
          }
          break;
        case 'Project category':
          parsed.projectCategory = field.value?.name || null;
          break;
        case 'Assignee':
          parsed.assignee = field.value?.name || field.value?.login || null;
          break;
        case 'Owner (who made an issue)':
          parsed.owner = field.value?.name || field.value?.login || null;
          break;
        case 'Start Date':
          parsed.startDate = field.value;
          break;
        case 'Due Date':
          parsed.dueDate = field.value;
          break;
      }
    });

    // Parsování subtasků a souvisejících tasků
    if (issue.links && Array.isArray(issue.links)) {
      const subtasks: SubTask[] = [];
      issue.links.forEach((link: any) => {
        const linkName = link.linkType?.name;
        const direction = link.direction as 'INWARD' | 'OUTWARD' | undefined;

        let relationType: SubTask['relationType'] | null = null;
        let treatAsChild = false;

        if (linkName === 'Subtask' || linkName === 'parent for') {
          relationType = 'subtask';
          treatAsChild =
            (linkName === 'Subtask' && direction === 'OUTWARD') ||
            // YouTrack "parent for" points from parent -> child when direction is OUTWARD.
            (linkName === 'parent for' && direction === 'OUTWARD');
        } else if (linkName === 'Relates' || linkName === 'relates to') {
          relationType = 'related';
          treatAsChild = true;
        }

        if (!relationType || !treatAsChild) {
          return;
        }

        if (link.issues && Array.isArray(link.issues)) {
          link.issues.forEach((subIssue: any) => {
            const status = subIssue.customFields?.find((f: any) => f.name === 'Status')?.value?.name;
            subtasks.push({
              id: subIssue.id,
              idReadable: subIssue.idReadable,
              status,
              relationType,
            });
          });
        }
      });

      if (subtasks.length > 0) {
        parsed.subtasks = subtasks;
        const doneCount = subtasks.filter(st => st.status === 'Done').length;
        parsed.subtaskProgress = {
          total: subtasks.length,
          done: doneCount,
          percentage: (doneCount / subtasks.length) * 100,
        };
      }
    }

    return parsed;
  }

  private async getIssuesByQuery(query: string): Promise<YouTrackIssue[]> {
    const params = {
      fields: this.issueFields,
      query,
      $top: 500,
    };
    try {
      const response = await this.client.get('/issues', { params });
      const payload = response.data;
      if (!Array.isArray(payload)) {
        const upstreamError =
          payload?.error_description ||
          payload?.error ||
          payload?.message ||
          'Unexpected response from YouTrack API.';
        throw new Error(upstreamError);
      }
      return payload.map((issue: any) => this.parseCustomFields(issue));
    } catch (error: any) {
      console.error('Chyba při načítání issues:', error);
      throw new Error(`Nepodařilo se načíst issues: ${error.message}`);
    }
  }

  async getMarketingIssues(tag: string): Promise<YouTrackIssue[]> {
    return this.getIssuesByQuery(`project: MKT tag: ${tag}`);
  }

  async getAllMarketingIssues(): Promise<YouTrackIssue[]> {
    return this.getIssuesByQuery('project: MKT');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/admin/projects?fields=id&$top=1');
      return true;
    } catch (error) {
      console.error('Test connection failed:', error);
      return false;
    }
  }
}