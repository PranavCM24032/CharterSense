import { AlertTriangle, FileText, GitBranch, HelpCircle, LayoutDashboard, LineChart, Settings, Ship } from 'lucide-react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', color: 'blue' },
  { path: '/forecast', icon: LineChart, label: 'Forecast Analytics', color: 'green' },
  { path: '/charter', icon: Ship, label: 'Charter Optimizer', color: 'purple' },
  { path: '/scenarios', icon: GitBranch, label: 'Scenario Analysis', color: 'orange' },
  { path: '/reports', icon: FileText, label: 'Reports', color: 'red' },
];

const secondaryItems = [
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/help', icon: HelpCircle, label: 'Help' },
];

export default function Sidebar({ isOpen }) {
  return (
    <aside className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] border-r border-slate-200 bg-white/90 backdrop-blur transition-all duration-300 dark:border-slate-700 dark:bg-slate-900/90 ${isOpen ? 'w-64' : 'w-20'}`}>
      <div className="flex h-full flex-col">
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'} ${!isOpen ? 'justify-center' : ''}`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {isOpen && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium">
                  {item.label}
                </motion.span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-slate-200 p-3 dark:border-slate-700">
          {secondaryItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${isActive ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'} ${!isOpen ? 'justify-center' : ''}`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {isOpen && <span className="text-sm font-medium">{item.label}</span>}
            </NavLink>
          ))}
        </div>

        {isOpen && (
          <div className="border-t border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span>System online</span>
              <span className="ml-auto font-semibold text-slate-600 dark:text-slate-200">v2.0</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
