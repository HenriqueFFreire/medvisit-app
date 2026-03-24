import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Settings } from '../types';
import { useAuth } from './AuthContext';

interface AppContextType {
  isOnline: boolean;
  settings: Settings | null;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const DEFAULT_SETTINGS = {
  workStartTime: '07:00',
  workEndTime: '19:00',
  defaultVisitDuration: 10,
  defaultVisitsPerDay: 11,
  minimumInterval: 15
};

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setSettings(null);
        return;
      }

      const snap = await getDoc(doc(db, 'users', user.id, 'settings', 'main'));
      if (snap.exists()) {
        const data = snap.data();
        setSettings({
          id: 'main',
          userId: user.id,
          workStartTime: data.workStartTime ?? DEFAULT_SETTINGS.workStartTime,
          workEndTime: data.workEndTime ?? DEFAULT_SETTINGS.workEndTime,
          defaultVisitDuration: data.defaultVisitDuration ?? DEFAULT_SETTINGS.defaultVisitDuration,
          defaultVisitsPerDay: data.defaultVisitsPerDay ?? DEFAULT_SETTINGS.defaultVisitsPerDay,
          minimumInterval: data.minimumInterval ?? DEFAULT_SETTINGS.minimumInterval
        });
      } else {
        const defaultSettings: Settings = { id: 'main', userId: user.id, ...DEFAULT_SETTINGS };
        await setDoc(doc(db, 'users', user.id, 'settings', 'main'), DEFAULT_SETTINGS);
        setSettings(defaultSettings);
      }
    };

    loadSettings();
  }, [user]);

  const updateSettings = async (updates: Partial<Settings>) => {
    if (!settings || !user) return;
    const updatedSettings = { ...settings, ...updates };
    const { id: _id, userId: _userId, ...data } = updatedSettings;
    await setDoc(doc(db, 'users', user.id, 'settings', 'main'), data, { merge: true });
    setSettings(updatedSettings);
  };

  return (
    <AppContext.Provider value={{ isOnline, settings, updateSettings }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
