import React, { createContext, useContext } from 'react';
import type { YouTrackConfig } from './types';

interface ConfigContextValue {
  config: YouTrackConfig;
}

const ConfigContext = createContext<ConfigContextValue | undefined>(undefined);

export const ConfigProvider: React.FC<{ config: YouTrackConfig; children: React.ReactNode }> = ({
  config,
  children,
}) => {
  return <ConfigContext.Provider value={{ config }}>{children}</ConfigContext.Provider>;
};

export const useConfig = (): ConfigContextValue => {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return ctx;
};

