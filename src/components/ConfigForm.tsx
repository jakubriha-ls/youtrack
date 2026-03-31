import React, { useState } from 'react';
import { YouTrackConfig } from '../types';

interface ConfigFormProps {
  onSave: (config: YouTrackConfig) => void;
  initialConfig?: YouTrackConfig;
}

export const ConfigForm: React.FC<ConfigFormProps> = ({ onSave, initialConfig }) => {
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || '');
  const [token, setToken] = useState(initialConfig?.token || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ baseUrl, token });
  };

  return (
    <div className="config-form">
      <h2>Konfigurace YouTrack API</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="baseUrl">
            YouTrack URL:
            <span className="help-text">např. https://youtrack.example.com</span>
          </label>
          <input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://youtrack.example.com"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="token">
            API Token:
            <span className="help-text">
              Získej v YouTrack: Profile → Authentication → Tokens
            </span>
          </label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="perm:xxxxx"
            required
          />
        </div>

        <button type="submit" className="btn-primary">
          Uložit konfiguraci
        </button>
      </form>
    </div>
  );
};