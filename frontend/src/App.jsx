import React, { useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import AuthPage from './pages/AuthPage';
import Onboarding from './components/layout/Onboarding';
import Overview from './pages/Overview';
import GoalsPage from './pages/Goals';
import DebtsPage from './pages/Debts';
import InsurancePage from './pages/Insurance';
import Wealth from './pages/Wealth';
import Money from './pages/Money';
import Essentials from './pages/Essentials';
import Calculators from './pages/Calculators';
import Import from './pages/Import';
import AIAdvisor from './pages/AIAdvisor';
import Profile from './pages/Profile';
import preventNegativeNumberInput from './utils/preventNegativeNumberInput';

export default function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hideAmounts, setHideAmounts] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('finverse_theme') || 'light');

  useEffect(() => {
    localStorage.setItem('finverse_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl aurora-gradient flex items-center justify-center text-white font-black text-2xl font-display animate-pulse shadow-lg">
              F
            </div>
            <div className="absolute inset-0 rounded-2xl aurora-gradient opacity-40 blur-xl animate-glow" />
          </div>
          <p className="text-xs font-semibold text-slate-400 tracking-wide uppercase">Loading Finverse...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // Show onboarding if they haven't completed it AND haven't manually set an income yet
  const needsOnboarding = !user.is_onboarded && (!user.monthly_income || user.monthly_income === 0);

  if (needsOnboarding) {
    return <Onboarding />;
  }

  return (
    <div className={`min-h-screen app-shell theme-${theme} flex flex-col lg:flex-row`}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        theme={theme}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <Navbar 
          hideAmounts={hideAmounts} 
          setHideAmounts={setHideAmounts} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          theme={theme}
          setTheme={setTheme}
        />

        {/* Page Switcher */}
        <main
          className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-24 lg:pb-12"
          onChangeCapture={preventNegativeNumberInput}
        >
          {(activeTab === 'dashboard' || activeTab === 'overview') && (
            <Overview hideAmounts={hideAmounts} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'goals' && <GoalsPage />}
          {activeTab === 'debts' && <DebtsPage />}
          {activeTab === 'insurance' && <InsurancePage />}
          {activeTab === 'wealth' && (
            <Wealth hideAmounts={hideAmounts} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'money' && (
            <Money hideAmounts={hideAmounts} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'essentials' && (
            <Essentials hideAmounts={hideAmounts} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'calculators' && (
            <Calculators hideAmounts={hideAmounts} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'import' && (
            <Import hideAmounts={hideAmounts} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'ai-advisor' && (
            <AIAdvisor hideAmounts={hideAmounts} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'profile' && <Profile />}
        </main>
      </div>
    </div>
  );
}
