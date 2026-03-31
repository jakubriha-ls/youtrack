import { useState, useEffect } from 'react';
import { YouTrackAPI } from './api/youtrack';
import { YouTrackConfig, YouTrackIssue } from './types';
import { ConfigForm } from './components/ConfigForm';
import { GanttChart } from './components/GanttChart';
import { KanbanBoard } from './components/KanbanBoard';
import { AllTasks } from './components/AllTasks';
import { ConfigProvider } from './ConfigContext';

const STORAGE_KEY = 'youtrack-config';
const UI_STORAGE_KEY = 'dashboard-ui-v1';

function App() {
  const [config, setConfig] = useState<YouTrackConfig | null>(null);
  const [api, setApi] = useState<YouTrackAPI | null>(null);
  const [issues, setIssues] = useState<YouTrackIssue[]>([]);
  const [allTasksIssues, setAllTasksIssues] = useState<YouTrackIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'gantt' | 'ganttall' | 'kanban' | 'alltasks'>('gantt');
  const [selectedTag, setSelectedTag] = useState<string>('WC2026');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const availableTags = ['WC2026', 'head_meeting'];

  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig(parsedConfig);
      } catch (e) {
        console.error('Chyba při načítání konfigurace:', e);
      }
    }

    const savedUi = localStorage.getItem(UI_STORAGE_KEY);
    if (savedUi) {
      try {
        const parsedUi = JSON.parse(savedUi) as Partial<{
          activeView: 'gantt' | 'ganttall' | 'kanban' | 'alltasks';
          selectedTag: string;
          theme: 'dark' | 'light';
        }>;
        if (
          parsedUi.activeView &&
          ['gantt', 'ganttall', 'kanban', 'alltasks'].includes(parsedUi.activeView)
        ) {
          setActiveView(parsedUi.activeView);
        }
        if (parsedUi.selectedTag) setSelectedTag(parsedUi.selectedTag);
        if (parsedUi.theme) setTheme(parsedUi.theme);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ activeView, selectedTag, theme }));
  }, [activeView, selectedTag, theme]);

  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light');
    document.body.classList.toggle('dark-theme', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (config) {
      const newApi = new YouTrackAPI(config);
      setApi(newApi);
      loadIssues(newApi, selectedTag);
    }
  }, [config, selectedTag]);

  const loadIssues = async (apiInstance: YouTrackAPI, tag: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const [marketingIssues, allMktIssues] = await Promise.all([
        apiInstance.getMarketingIssues(tag),
        apiInstance.getAllMarketingIssues(),
      ]);

      // Enrich tag-filtered issues (WC/Kanban views) with their subtasks,
      // even when child issues do not carry the selected tag.
      const subtaskIdSet = new Set<string>();
      marketingIssues.forEach(issue => {
        issue.subtasks?.forEach(sub => {
          subtaskIdSet.add(sub.id);
        });
      });
      const existingIds = new Set(marketingIssues.map(i => i.id));
      const subtaskIssuesToAdd = allMktIssues.filter(
        issue => subtaskIdSet.has(issue.id) && !existingIds.has(issue.id),
      );
      const enrichedMarketingIssues = [...marketingIssues, ...subtaskIssuesToAdd];

      setIssues(enrichedMarketingIssues);
      setAllTasksIssues(allMktIssues);
      
      if (marketingIssues.length === 0) {
        setError(`Nebyly nalezeny žádné issues s tagem ${tag} v projektu Marketing (MKT)`);
      }
    } catch (err: any) {
      setError(`Chyba při načítání dat: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSave = (newConfig: YouTrackConfig) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    setConfig(newConfig);
  };

  const handleLogout = () => {
    if (confirm('Opravdu se chcete odhlásit? Vaše nastavení bude smazáno.')) {
      localStorage.removeItem(STORAGE_KEY);
      setConfig(null);
      setApi(null);
      setIssues([]);
      setAllTasksIssues([]);
    }
  };

  const handleRefresh = () => {
    if (api) {
      loadIssues(api, selectedTag);
    }
  };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
  };

  if (!config) {
    return (
      <div>
        <h1>Marketing Dashboard</h1>
        <ConfigForm onSave={handleConfigSave} />
      </div>
    );
  }

  return (
    <ConfigProvider config={config}>
      <div>
      <div className="app-header">
        <div>
          <h1 className="app-title">Marketing Dashboard</h1>
          <div className="connected-info">
            ✓ Připojeno k: {config.baseUrl}
            {!loading && <span> • {issues.length} issues načteno • Tag: {selectedTag}</span>}
          </div>
        </div>
        <div className="header-actions">
          <select 
            value={selectedTag} 
            onChange={(e) => handleTagChange(e.target.value)}
            className="tag-select"
            disabled={loading}
          >
            {availableTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <button onClick={handleRefresh} className="btn-refresh" disabled={loading}>
            🔄 Obnovit
          </button>
          <button onClick={handleLogout} className="btn-danger">
            Odhlásit se
          </button>
          <button
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            className="btn-theme-toggle"
            title="Přepnout vzhled aplikace"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      {error && (
        <div className="status error">
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div className="status loading">
          ⏳ Načítám data z YouTrack...
        </div>
      )}

      {!loading && (issues.length > 0 || allTasksIssues.length > 0) && (
        <>
<div className="view-tabs">
  <button
    className={`tab ${activeView === 'gantt' ? 'active' : ''}`}
    onClick={() => setActiveView('gantt')}
  >
    📅 Gantt WC26
  </button>
  <button
    className={`tab ${activeView === 'ganttall' ? 'active' : ''}`}
    onClick={() => setActiveView('ganttall')}
  >
    📅 Gantt all tasks
  </button>
  <button
    className={`tab ${activeView === 'kanban' ? 'active' : ''}`}
    onClick={() => setActiveView('kanban')}
  >
    📋 Kanban Board
  </button>
  <button
    className={`tab ${activeView === 'alltasks' ? 'active' : ''}`}
    onClick={() => setActiveView('alltasks')}
  >
    📋 All Tasks
  </button>
</div>

          <div className="view-content">
            {activeView === 'gantt' && <GanttChart issues={issues} variant="wc" />}
            {activeView === 'ganttall' && <GanttChart issues={allTasksIssues} variant="all" />}
            {activeView === 'kanban' && <KanbanBoard issues={issues} />}
            {activeView === 'alltasks' && <AllTasks issues={allTasksIssues} />}
          </div>
        </>
      )}
    </div>
    </ConfigProvider>
  );
}

export default App;