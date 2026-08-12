import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ClipboardList, Users, History, Settings, Wifi, WifiOff, CalendarDays, Pill, MapPin } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/routes', icon: ClipboardList, label: 'Roteiro' },
  { path: '/agenda', icon: CalendarDays, label: 'Agenda' },
  { path: '/doctors', icon: Users, label: 'Médicos' },
  { path: '/pharmacies', icon: Pill, label: 'Farmácias' },
  { path: '/history', icon: History, label: 'Histórico' },
  { path: '/settings', icon: Settings, label: 'Config' }
];

function NavigationItems({ compact = false }: { compact?: boolean }) {
  return navItems.map(({ path, icon: Icon, label }) => (
    <NavLink
      key={path}
      to={path}
      end={path === '/'}
      className={({ isActive }) => compact
        ? `flex w-16 flex-col items-center justify-center rounded-xl px-1 py-2.5 transition-colors ${isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`
        : `flex flex-col items-center justify-center rounded-lg px-3 py-2 transition-colors ${isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`
      }
    >
      <Icon className={compact ? 'h-5 w-5' : 'h-5 w-5'} />
      <span className={`${compact ? 'mt-1.5 text-[10px]' : 'mt-1 text-xs'} font-medium`}>{label}</span>
    </NavLink>
  ));
}

export function Layout({ children }: LayoutProps) {
  const { isOnline } = useApp();

  return (
    <div className="flex min-h-screen bg-slate-50 lg:h-screen lg:overflow-hidden">
      <aside className="hidden w-20 shrink-0 flex-col items-center border-r border-slate-200 bg-white py-4 lg:flex">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
          <MapPin className="h-6 w-6" />
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1">
          <NavigationItems compact />
        </nav>
        <div className={`mb-1 h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} title={isOnline ? 'Online' : 'Offline'} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:h-screen lg:min-h-0">
        <header className="flex h-14 shrink-0 items-center justify-between bg-blue-600 px-4 text-white shadow-sm lg:border-b lg:border-slate-200 lg:bg-white lg:px-6 lg:text-slate-900 lg:shadow-none">
          <h1 className="text-lg font-semibold">MedVisit</h1>
          <div className="flex items-center gap-2 text-xs">
            {isOnline ? <Wifi className="h-5 w-5 text-green-300 lg:text-emerald-500" /> : <WifiOff className="h-5 w-5 text-yellow-300 lg:text-amber-500" />}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white px-2 py-1 shadow-lg lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          <NavigationItems />
        </div>
      </nav>
    </div>
  );
}
