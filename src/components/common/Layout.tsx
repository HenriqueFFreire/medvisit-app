import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ClipboardList, Users, History, Settings, Wifi, WifiOff, CalendarDays } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isOnline } = useApp();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/routes', icon: ClipboardList, label: 'Roteiro' },
    { path: '/agenda', icon: CalendarDays, label: 'Agenda' },
    { path: '/doctors', icon: Users, label: 'Médicos' },
    { path: '/history', icon: History, label: 'Histórico' },
    { path: '/settings', icon: Settings, label: 'Config' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <h1 className="text-lg font-semibold">MedVisit</h1>
        <div className="flex items-center gap-1">
          {isOnline ? (
            <Wifi className="w-5 h-5 text-green-300" />
          ) : (
            <WifiOff className="w-5 h-5 text-yellow-300" />
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-1 shadow-lg">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs mt-1">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
