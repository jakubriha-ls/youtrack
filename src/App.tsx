import { useState, useEffect, useMemo } from 'react';
import { YouTrackAPI } from './api/youtrack';
import { YouTrackConfig, YouTrackIssue } from './types';
import { ConfigForm } from './components/ConfigForm';
import { GanttChart } from './components/GanttChart';
import { KanbanBoard } from './components/KanbanBoard';
import { AllTasks } from './components/AllTasks';
import { ConfigProvider } from './ConfigContext';

const STORAGE_KEY = 'youtrack-config';
const UI_STORAGE_KEY = 'dashboard-ui-v1';
const DASHBOARD_PASSWORD_STORAGE_KEY = 'dashboard-password-v1';

type RuntimeConfig = {
  managed: boolean;
  baseUrl: string | null;
  requiresPassword: boolean;
};

function App() {
  const [config, setConfig] = useState<YouTrackConfig | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [api, setApi] = useState<YouTrackAPI | null>(null);
  const [allTasksIssues, setAllTasksIssues] = useState<YouTrackIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'gantt' | 'ganttall' | 'kanban' | 'alltasks'>('gantt');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [dashboardPassword, setDashboardPassword] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const availableTags = ['WC2026', 'head_meeting', 'flashscore_youtube', 'marketing-after_deadline'];

  useEffect(() => {
    const init = async () => {
      try {
        const response = await fetch('/api/runtime-config');
        const runtime = (await response.json()) as RuntimeConfig;
        setRuntimeConfig(runtime);

        if (runtime.managed) {
          const savedPassword = sessionStorage.getItem(DASHBOARD_PASSWORD_STORAGE_KEY) || '';
          setDashboardPassword(savedPassword);
          setConfig({
            baseUrl: runtime.baseUrl || 'Server-managed',
            token: '',
            dashboardPassword: savedPassword,
          });
        } else {
          const savedConfig = localStorage.getItem(STORAGE_KEY);
          if (savedConfig) {
            try {
              const parsedConfig = JSON.parse(savedConfig);
              setConfig(parsedConfig);
            } catch (e) {
              console.error('Chyba při načítání konfigurace:', e);
            }
          }
        }
      } catch {
        setRuntimeConfig({
          managed: false,
          baseUrl: null,
          requiresPassword: false,
        });
      }
    };

    void init();

    const savedUi = localStorage.getItem(UI_STORAGE_KEY);
    if (savedUi) {
      try {
        const parsedUi = JSON.parse(savedUi) as Partial<{
          activeView: 'gantt' | 'ganttall' | 'kanban' | 'alltasks';
          selectedTags: string[];
          selectedTag: string;
          theme: 'dark' | 'light';
        }>;
        if (
          parsedUi.activeView &&
          ['gantt', 'ganttall', 'kanban', 'alltasks'].includes(parsedUi.activeView)
        ) {
          setActiveView(parsedUi.activeView);
        }
        if (Array.isArray(parsedUi.selectedTags)) {
          setSelectedTags(parsedUi.selectedTags);
        } else if (parsedUi.selectedTag) {
          // backward compatibility for previous single-select storage
          setSelectedTags([parsedUi.selectedTag]);
        }
        if (parsedUi.theme) setTheme(parsedUi.theme);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify({ activeView, selectedTags, theme }));
  }, [activeView, selectedTags, theme]);

  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light');
    document.body.classList.toggle('dark-theme', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (config && (!runtimeConfig?.requiresPassword || dashboardPassword)) {
      const newApi = new YouTrackAPI(config);
      setApi(newApi);
      loadIssues(newApi);
    }
  }, [config, runtimeConfig, dashboardPassword]);

  const loadIssues = async (apiInstance: YouTrackAPI) => {
    setLoading(true);
    setError(null);
    
    try {
      const allMktIssues = await apiInstance.getAllMarketingIssues();
      setAllTasksIssues(allMktIssues);
      
      if (allMktIssues.length === 0) {
        setError('Nebyly nalezeny žádné issues v projektu Marketing (MKT)');
      }
    } catch (err: any) {
      if (runtimeConfig?.managed && runtimeConfig.requiresPassword && err?.message?.includes('401')) {
        setPasswordError('Neplatné heslo.');
        setDashboardPassword('');
        sessionStorage.removeItem(DASHBOARD_PASSWORD_STORAGE_KEY);
        setConfig(prev => (prev ? { ...prev, dashboardPassword: '' } : prev));
      }
      setError(`Chyba při načítání dat: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSave = (newConfig: YouTrackConfig) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    setConfig(newConfig);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    const next = passwordInput.trim();
    setDashboardPassword(next);
    sessionStorage.setItem(DASHBOARD_PASSWORD_STORAGE_KEY, next);
    setConfig(prev => (prev ? { ...prev, dashboardPassword: next } : prev));
  };

  const handleLogout = () => {
    if (confirm('Opravdu se chcete odhlásit? Vaše nastavení bude smazáno.')) {
      localStorage.removeItem(STORAGE_KEY);
      setConfig(null);
      setApi(null);
      setAllTasksIssues([]);
    }
  };

  const handleRefresh = () => {
    if (api) {
      loadIssues(api);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  };

  const wcTags = selectedTags.length > 0 ? selectedTags : ['WC2026'];
  const wcTagLabel =
    selectedTags.length > 0 ? selectedTags.join(', ') : 'WC2026 (default)';

  const wcIssues = useMemo(() => {
    const filtered = allTasksIssues.filter(issue =>
      issue.tags?.some(tag => wcTags.includes(tag)),
    );

    const subtaskIdSet = new Set<string>();
    filtered.forEach(issue => {
      issue.subtasks?.forEach(sub => {
        subtaskIdSet.add(sub.id);
      });
    });
    const existingIds = new Set(filtered.map(i => i.id));
    const subtaskIssuesToAdd = allTasksIssues.filter(
      issue => subtaskIdSet.has(issue.id) && !existingIds.has(issue.id),
    );
    return [...filtered, ...subtaskIssuesToAdd];
  }, [allTasksIssues, wcTags]);

  if (!runtimeConfig) {
    return (
      <div>
        <h1>Marketing Dashboard</h1>
        <div className="status loading">⏳ Inicializuji konfiguraci...</div>
      </div>
    );
  }

  if (runtimeConfig.managed && runtimeConfig.requiresPassword && !dashboardPassword) {
    return (
      <div>
        <h1>Marketing Dashboard</h1>
        <div className="config-form">
          <h2>Zadejte heslo pro přístup</h2>
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label htmlFor="dashboard-password">Password:</label>
              <input
                id="dashboard-password"
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {passwordError && <div className="status error">⚠️ {passwordError}</div>}
            <button type="submit" className="btn-primary">
              Přihlásit
            </button>
          </form>
        </div>
      </div>
    );
  }

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
            {!loading && <span> • {wcIssues.length} issues načteno • Tagy: {wcTagLabel}</span>}
          </div>
        </div>
        <div className="header-actions">
          <details className="gantt-multiselect">
            <summary className="gantt-multiselect-summary">
              {selectedTags.length > 0 ? `${selectedTags.length} tagy` : 'Žádný tag (default WC2026)'}
            </summary>
            <div className="gantt-multiselect-menu">
              <button
                type="button"
                className="gantt-multiselect-clear"
                onClick={() => setSelectedTags([])}
              >
                Žádný tag
              </button>
              {availableTags.map(tag => (
                <label key={tag} className="gantt-multiselect-option">
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={() => toggleTag(tag)}
                  />
                  <span>{tag}</span>
                </label>
              ))}
            </div>
          </details>
          <button onClick={handleRefresh} className="btn-refresh" disabled={loading}>
            🔄 Obnovit
          </button>
          {!runtimeConfig.managed && (
            <button onClick={handleLogout} className="btn-danger">
              Odhlásit se
            </button>
          )}
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

      {!loading && (wcIssues.length > 0 || allTasksIssues.length > 0) && (
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
            {activeView === 'gantt' && <GanttChart issues={wcIssues} variant="wc" />}
            {activeView === 'ganttall' && <GanttChart issues={allTasksIssues} variant="all" />}
            {activeView === 'kanban' && <KanbanBoard issues={wcIssues} />}
            {activeView === 'alltasks' && <AllTasks issues={allTasksIssues} />}
          </div>
        </>
      )}
    </div>
    </ConfigProvider>
  );
}

export default App;