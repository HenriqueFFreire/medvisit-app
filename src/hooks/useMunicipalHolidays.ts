import { useEffect, useMemo, useState } from 'react';

export interface MunicipalHoliday {
  date: string;
  name: string;
  city: string;
  state: string;
}

interface CityState {
  city: string;
  state: string;
}

interface ApiHoliday {
  date?: string;
  name?: string;
  type?: string;
  description?: string;
}

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

async function loadCityHolidays(city: CityState, year: number): Promise<MunicipalHoliday[]> {
  const cacheKey = `medvisit:municipal-holidays:${year}:${city.state}:${city.city}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { savedAt: number; holidays: MunicipalHoliday[] };
      if (Date.now() - parsed.savedAt < CACHE_TTL) return parsed.holidays;
    }
  } catch { /* cache is optional */ }

  const params = new URLSearchParams({ estado: city.state, cidade: city.city, ano: String(year) });
  const response = await fetch(`https://feriados.niceatc.api.br/?${params.toString()}`);
  if (!response.ok) throw new Error(`Holiday API returned ${response.status}`);
  const payload = await response.json() as { value?: ApiHoliday[] } | ApiHoliday[];
  const rows = Array.isArray(payload) ? payload : (payload.value ?? []);
  const holidays = rows
    .filter(item => item.type?.toLowerCase() === 'feriado municipal' && item.date && item.name)
    .map(item => ({
      date: item.date!,
      name: item.description?.trim() || item.name!,
      city: city.city,
      state: city.state,
    }));
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), holidays }));
  } catch { /* cache is optional */ }
  return holidays;
}

export function useMunicipalHolidays(cities: CityState[], year: number) {
  const [holidays, setHolidays] = useState<MunicipalHoliday[]>([]);
  const cityKey = useMemo(
    () => [...new Set(cities.filter(item => item.city && item.state).map(item => `${item.city}|${item.state}`))].sort().join(';'),
    [cities]
  );

  useEffect(() => {
    let cancelled = false;
    const uniqueCities = cityKey ? cityKey.split(';').map(item => {
      const [city, state] = item.split('|');
      return { city, state };
    }) : [];
    if (uniqueCities.length === 0) {
      setHolidays([]);
      return;
    }
    Promise.allSettled(uniqueCities.map(city => loadCityHolidays(city, year))).then(results => {
      if (cancelled) return;
      const loaded = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
      const unique = new Map(loaded.map(item => [`${item.date}|${item.city}|${item.name}`, item]));
      setHolidays([...unique.values()].sort((a, b) => a.date.localeCompare(b.date)));
    });
    return () => { cancelled = true; };
  }, [cityKey, year]);

  return holidays;
}
