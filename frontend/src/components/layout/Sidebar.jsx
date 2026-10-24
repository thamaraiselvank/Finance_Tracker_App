import React from 'react';
import {
  LayoutGrid,
  LayoutDashboard,
  Target,
  CreditCard,
  Shield,
  TrendingUp,
  Wallet,
  Upload,
  Calculator,
  Sparkles,
  UserCircle2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, collapsed, setCollapsed, theme }) {
  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'debts', label: 'Debts', icon: CreditCard },
    { id: 'insurance', label: 'Insurance', icon: Shield },
    { id: 'wealth', label: 'Wealth', icon: TrendingUp },
    { id: 'money', label: 'Money', icon: Wallet },
    { id: 'essentials', label: 'Essentials', icon: Target },
    { id: 'profile', label: 'Profile', icon: UserCircle2 },
  ];

  const toolNavItems = [
    { id: 'import', label: 'Import', icon: Upload },
    { id: 'calculators', label: 'Calculators', icon: Calculator },
    { id: 'ai-advisor', label: 'AI Advisor', icon: Sparkles, badge: 'AI' },
  ];

  return (
    <>
    <aside className={`${collapsed ? 'w-20' : 'w-64'} sidebar-shell transition-all duration-300 hidden lg:flex lg:flex-none flex-col justify-between h-screen sticky top-0 select-none`}>
      <div>
        <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-4'} py-5`}>
          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
            <div className="relative">
              <div className="w-8 h-8 rounded-lg aurora-gradient flex items-center justify-center text-white font-bold text-lg shadow-lg">
                F
              </div>
              <div className="absolute inset-0 rounded-lg aurora-gradient opacity-30 blur-md" />
            </div>
            {!collapsed && (
              <span className="font-extrabold text-xl tracking-tight font-display">
                <span className="aurora-text">Fin</span><span className="brand-tail">verse</span><span className="text-cyan-400">.</span>
              </span>
            )}
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-lg sidebar-icon-button"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="px-2 pb-4 flex justify-center">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="p-1.5 rounded-lg sidebar-icon-button"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className={`${collapsed ? 'px-2' : 'px-3'} py-2 space-y-1`}>
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-500/15 to-cyan-500/10 text-slate-900 dark:text-white font-bold border border-violet-500/20 shadow-[0_0_12px_rgba(124,58,237,0.15)]'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/[0.04]'
                }`}
                title={item.label}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-violet-500' : ''}`} />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_6px_rgba(124,58,237,0.6)]" />}
              </button>
            );
          })}
        </div>

        {!collapsed && (
          <div className="px-6 pt-6 pb-2">
            <span className="text-[10px] font-bold tracking-[0.15em] text-slate-500 uppercase">Tools</span>
          </div>
        )}
        <div className={`${collapsed ? 'px-2' : 'px-3'} space-y-1`}>
          {toolNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-3.5'} py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-500/15 to-cyan-500/10 text-slate-900 dark:text-white font-bold border border-violet-500/20 shadow-[0_0_12px_rgba(124,58,237,0.15)]'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/[0.04]'
                }`}
                title={item.label}
              >
                <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-violet-500' : ''}`} />
                  {!collapsed && <span>{item.label}</span>}
                </div>
                {!collapsed && item.badge && (
                  <span className="aurora-gradient text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-3" />
    </aside>
    <nav
      aria-label="Main navigation"
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 flex lg:hidden overflow-x-auto border-t select-none"
    >
      {[...mainNavItems, ...toolNavItems].map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            aria-current={isActive ? 'page' : undefined}
            title={item.label}
            className={`flex min-w-[62px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[9px] font-semibold ${
              isActive ? 'text-violet-500' : 'text-slate-500'
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span className="max-w-full truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
    </>
  );
}
