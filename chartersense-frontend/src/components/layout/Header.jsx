import { Bell, Download, Menu, Moon, RefreshCw, Search, Settings, Sun, User } from 'lucide-react';
import { Menu as HeadlessMenu, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';

import { useTheme } from '../../contexts/ThemeContext';
import { useApp } from '../../contexts/AppContext';

export default function Header({ onMenuClick }) {
  const { isDark, setIsDark } = useTheme();
  const { lastUpdated } = useApp();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
      <div className="flex h-16 items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5 text-slate-700 dark:text-slate-200" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 text-xl font-bold text-white">
              ⚓
            </div>
            <div>
              <h1 className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-xl font-bold text-transparent">
                CharterSense
              </h1>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">AI intelligence</p>
            </div>
          </div>
        </div>

        <div className="hidden flex-1 max-w-lg md:block">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search routes, vessels, ports..."
              className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 lg:flex">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Updated: {lastUpdated}</span>
          </div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsDark(!isDark)}
            className="rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-slate-600" />}
          </motion.button>

          <button className="rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Download report">
            <Download className="h-5 w-5 text-slate-600 dark:text-slate-200" />
          </button>

          <HeadlessMenu as="div" className="relative">
            <HeadlessMenu.Button className="relative rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800">
              <Bell className="h-5 w-5 text-slate-600 dark:text-slate-200" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
            </HeadlessMenu.Button>
            <Transition
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-in"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <HeadlessMenu.Items className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Notifications</h3>
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <HeadlessMenu.Item key={i}>
                    {({ active }) => (
                      <div className={`rounded-lg px-3 py-2 ${active ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">⚠️ Risk alert #{i + 1}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">2 minutes ago</p>
                      </div>
                    )}
                  </HeadlessMenu.Item>
                ))}
              </HeadlessMenu.Items>
            </Transition>
          </HeadlessMenu>

          <HeadlessMenu as="div" className="relative">
            <HeadlessMenu.Button className="flex items-center gap-2 rounded-lg p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
                SA
              </div>
              <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 md:inline">Admin</span>
            </HeadlessMenu.Button>
            <Transition
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-in"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <HeadlessMenu.Items className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
                      <User className="h-4 w-4" /> Profile
                    </button>
                  )}
                </HeadlessMenu.Item>
                <HeadlessMenu.Item>
                  {({ active }) => (
                    <button className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
                      <Settings className="h-4 w-4" /> Settings
                    </button>
                  )}
                </HeadlessMenu.Item>
              </HeadlessMenu.Items>
            </Transition>
          </HeadlessMenu>
        </div>
      </div>
    </header>
  );
}
