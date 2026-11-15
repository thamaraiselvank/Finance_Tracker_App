import React, { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
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
import AIChatShortcut from './components/AIChatShortcut';
import LearningCenter from './pages/LearningCenter';
import Tax from './pages/Tax';
import FinancialAssessment from './pages/FinancialAssessment';

export default function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [moneyFocusDate, setMoneyFocusDate] = useState(null);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('finverse_theme') || 'light');
  const [authToast, setAuthToast] = useState('');
  const [appToast, setAppToast] = useState(null);

  useEffect(() => {
    const showAppToast = (event) => setAppToast(event.detail || null);
    window.addEventListener('finverse:toast', showAppToast);
    return () => window.removeEventListener('finverse:toast', showAppToast);
  }, []);

  useEffect(() => {
    if (!appToast) return undefined;
    const timeout = window.setTimeout(() => setAppToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [appToast]);

  useEffect(() => {
    if (!user) return undefined;
    const message = sessionStorage.getItem('finverse_auth_toast');
    if (!message) return undefined;
    sessionStorage.removeItem('finverse_auth_toast');
    setAuthToast(message);
  }, [user]);

  useEffect(() => {
    if (!authToast) return undefined;
    const timeout = window.setTimeout(() => setAuthToast(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [authToast]);

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
    return (
      <>
        <Onboarding />
        <AuthSuccessToast message={authToast} onClose={() => setAuthToast('')} />
        <AppToast toast={appToast} onClose={() => setAppToast(null)} />
      </>
    );
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
            <Overview hideAmounts={hideAmounts} setActiveTab={setActiveTab} userId={user?.id} />
          )}
          {activeTab === 'goals' && <GoalsPage />}
          {activeTab === 'debts' && <DebtsPage />}
          {activeTab === 'insurance' && <InsurancePage />}
          {activeTab === 'wealth' && (
            <Wealth hideAmounts={hideAmounts} setActiveTab={setActiveTab} onViewMoneyDate={(date) => { setMoneyFocusDate(date); setActiveTab('money'); }} />
          )}
          {activeTab === 'money' && (
            <Money hideAmounts={hideAmounts} setActiveTab={setActiveTab} focusDate={moneyFocusDate} />
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
          {activeTab === 'learn' && <LearningCenter setActiveTab={setActiveTab} />}
          {activeTab === 'tax' && <Tax user={user} hideAmounts={hideAmounts} setActiveTab={setActiveTab} />}
          {activeTab === 'assessment' && <FinancialAssessment hideAmounts={hideAmounts} setActiveTab={setActiveTab} />}
        </main>
      </div>
      <AIChatShortcut onOpen={() => setActiveTab('ai-advisor')} />
      <AuthSuccessToast message={authToast} onClose={() => setAuthToast('')} />
      <AppToast toast={appToast} onClose={() => setAppToast(null)} />
    </div>
  );
}

function AuthSuccessToast({ message, onClose }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 top-4 z-[200] flex max-w-sm items-start gap-3 rounded-xl border border-emerald-400/30 bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl animate-in slide-in-from-top-2 fade-in"
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
      <p className="flex-1 leading-relaxed">{message}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss notification" className="rounded p-0.5 text-slate-400 hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AppToast({ toast, onClose }) {
  if (!toast?.message) return null;
  const isError = toast.type === 'error';
  const Icon = isError ? CircleAlert : toast.type === 'info' ? Info : CheckCircle2;
  const isWarning = toast.type === 'warning';
  const tone = isError
    ? 'border-rose-400/30 text-rose-200'
    : isWarning ? 'border-amber-400/30 text-amber-200' : toast.type === 'info' ? 'border-sky-400/30 text-sky-200' : 'border-emerald-400/30 text-emerald-200';
  const iconTone = isError ? 'text-rose-400' : isWarning ? 'text-amber-400' : toast.type === 'info' ? 'text-sky-400' : 'text-emerald-400';
  return (
    <div role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'} className={`fixed right-4 top-4 z-[210] flex max-w-sm items-start gap-3 rounded-xl border bg-slate-900 px-4 py-3 text-sm shadow-2xl animate-in slide-in-from-top-2 fade-in ${tone}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone}`} aria-hidden="true" />
      <p className="flex-1 leading-relaxed">{toast.message}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss notification" className="rounded p-0.5 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
    </div>
  );
}
