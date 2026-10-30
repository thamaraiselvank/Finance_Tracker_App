import React, { useState } from 'react';
import { 
  Bell, 
  Clock3,
  Eye, 
  EyeOff, 
  Moon, 
  Sun, 
  ChevronDown, 
  LogOut, 
  User, 
  Sliders,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar({ hideAmounts, setHideAmounts, activeTab, setActiveTab, theme, setTheme }) {
  const { user, logout, remainingSeconds, staySignedIn, isRefreshingSession, sessionRefreshError } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const sessionTime = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;
  const sessionWarning = remainingSeconds <= 120;

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 app-navbar backdrop-blur-xl border-b">
      {/* Main Navbar */}
      <div className="navbar-main px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="lg:hidden font-bold text-lg font-display">
            <span className="aurora-text">Fin</span><span className="brand-tail">verse</span><span className="text-cyan-400">.</span>
          </div>
          <div className="hidden sm:block text-sm font-medium text-slate-400 capitalize">
            {activeTab}
          </div>
        </div>

        {/* Right Actions */}
        <div className="navbar-actions flex items-center gap-1 sm:gap-3">
          {/* Privacy Toggle (Hide Amounts) */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? "Switch to light theme" : "Switch to dark theme"}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setHideAmounts(!hideAmounts)}
            title={hideAmounts ? "Show monetary amounts" : "Hide monetary amounts"}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200"
          >
            {hideAmounts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-aurora-400" />}
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications((open) => !open)}
              aria-expanded={showNotifications}
              aria-label="Notifications"
              className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200 relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900 p-4 text-sm text-slate-300 shadow-xl z-50">
                <p className="font-semibold text-white">Notifications</p>
                <p className="mt-2 text-xs text-slate-400">You’re all caught up.</p>
              </div>
            )}
          </div>

          <div className="relative">
            <div className={`session-timer-control flex items-center gap-1 rounded-xl border px-2 py-1.5 ${sessionWarning ? 'session-timer-warning' : ''}`}>
              <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="font-mono text-[11px] font-semibold tabular-nums" aria-label={`Session expires in ${sessionTime}`}>
                {sessionTime}
              </span>
              <button
                type="button"
                onClick={staySignedIn}
                disabled={isRefreshingSession}
                className="session-refresh-button rounded-md p-1 transition-colors disabled:cursor-wait disabled:opacity-60"
                title="Refresh sign-in session"
                aria-label={isRefreshingSession ? 'Refreshing sign-in session' : 'Refresh sign-in session'}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingSession ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            </div>
            {sessionRefreshError && (
              <p className="session-refresh-error absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border px-3 py-2 text-[11px] shadow-lg" role="alert">
                {sessionRefreshError}
              </p>
            )}
          </div>

          {/* User Profile Pill */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-full border border-white/[0.08] hover:border-aurora-500/30 hover:bg-white/[0.04] transition-all duration-200"
            >
              <div className="w-7 h-7 rounded-full aurora-gradient text-white font-bold text-xs flex items-center justify-center shadow-md">
                {getInitials(user?.full_name || user?.username)}
              </div>
              <span className="hidden sm:block text-xs font-semibold text-slate-200 max-w-[120px] truncate">
                {user?.full_name || user?.username || 'User'}
              </span>
              <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-500" />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 glass-panel py-1.5 z-50 animate-float-in">
                <div className="px-4 py-2 border-b border-white/[0.06]">
                  <p className="text-xs font-semibold text-white">{user?.full_name || user?.username}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setActiveTab('profile'); setShowUserMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-white/[0.04] hover:text-white flex items-center gap-2 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-slate-500" /> My Profile
                </button>
                <button
                  onClick={() => { setActiveTab('essentials'); setShowUserMenu(false); }}
                  className="w-full px-4 py-2 text-left text-xs text-slate-300 hover:bg-white/[0.04] hover:text-white flex items-center gap-2 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" /> Financial Settings
                </button>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  onClick={logout}
                  className="w-full px-4 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
