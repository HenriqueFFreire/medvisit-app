import { useState, useEffect, useCallback } from 'react';
import { collection, doc, getDocs, addDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Doctor } from '../types';
import type { WeeklyRouteDistribution } from '../services/routing';

export interface RouteTemplate {
  id: string;
  name: string;
  visitsPerDay: number;
  visitDuration: number;
  distribution: Record<string, string[]>; // "1"–"5" → doctorIds
  createdAt: Date;
}

interface UseRouteTemplatesResult {
  templates: RouteTemplate[];
  isLoading: boolean;
  saveTemplate: (
    name: string,
    visitsPerDay: number,
    visitDuration: number,
    distribution: WeeklyRouteDistribution
  ) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  applyTemplate: (
    template: RouteTemplate,
    doctors: Doctor[]
  ) => { visitsPerDay: number; visitDuration: number; weeklyDistribution: WeeklyRouteDistribution };
}

export function useRouteTemplates(): UseRouteTemplatesResult {
  const [templates, setTemplates] = useState<RouteTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const loadTemplates = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const q = query(
        collection(db, 'users', user.id, 'route_templates'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setTemplates(snap.docs.map(d => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: data.name as string,
          visitsPerDay: data.visitsPerDay as number,
          visitDuration: data.visitDuration as number,
          distribution: data.distribution as Record<string, string[]>,
          createdAt: new Date(data.createdAt as string)
        };
      }));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const saveTemplate = async (
    name: string,
    visitsPerDay: number,
    visitDuration: number,
    distribution: WeeklyRouteDistribution
  ): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    const dist: Record<string, string[]> = {};
    for (let day = 1; day <= 5; day++) {
      dist[String(day)] = (distribution[day] || []).map(d => d.id);
    }
    const now = new Date().toISOString();
    await addDoc(collection(db, 'users', user.id, 'route_templates'), {
      name,
      visitsPerDay,
      visitDuration,
      distribution: dist,
      createdAt: now
    });
    await loadTemplates();
  };

  const deleteTemplate = async (id: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    await deleteDoc(doc(db, 'users', user.id, 'route_templates', id));
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const applyTemplate = (
    template: RouteTemplate,
    doctors: Doctor[]
  ): { visitsPerDay: number; visitDuration: number; weeklyDistribution: WeeklyRouteDistribution } => {
    const doctorMap = new Map(doctors.map(d => [d.id, d]));
    const weeklyDistribution: WeeklyRouteDistribution = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (let day = 1; day <= 5; day++) {
      const ids = template.distribution[String(day)] || [];
      weeklyDistribution[day] = ids
        .map(id => doctorMap.get(id))
        .filter((d): d is Doctor => d !== undefined);
    }
    return {
      visitsPerDay: template.visitsPerDay,
      visitDuration: template.visitDuration,
      weeklyDistribution
    };
  };

  return { templates, isLoading, saveTemplate, deleteTemplate, applyTemplate };
}
