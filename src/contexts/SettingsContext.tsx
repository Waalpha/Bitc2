import React, { createContext, useContext, useState } from 'react';
import { AppSettings } from '../types';

export interface SettingsContextType {
  settings: AppSettings | null;
  setSettings: (settings: AppSettings | null) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
}

export const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  setSettings: () => {},
  updateSettings: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings(prev => (prev ? { ...prev, ...partial } : (partial as AppSettings)));
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = () => useContext(SettingsContext);
