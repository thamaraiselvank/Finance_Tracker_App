import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);
const SESSION_TIMEOUT_MINUTES = Math.max(1, Number(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES) || 30);
const SESSION_WARNING_MINUTES = Math.min(
  SESSION_TIMEOUT_MINUTES,
  Math.max(0, Number(import.meta.env.VITE_SESSION_WARNING_MINUTES) || 2)
);
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(SESSION_TIMEOUT_MINUTES * 60);
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);
  const [sessionRefreshError, setSessionRefreshError] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('finverse_user');
    const token = localStorage.getItem('finverse_access_token');
    if (savedUser && token) {
      try {
        const savedSessionStart = Number(localStorage.getItem('finverse_session_started_at'));
        const startedAt = savedSessionStart || Date.now();
        if (Date.now() - startedAt >= SESSION_TIMEOUT_MS) {
          localStorage.removeItem('finverse_access_token');
          localStorage.removeItem('finverse_refresh_token');
          localStorage.removeItem('finverse_user');
          localStorage.removeItem('finverse_session_started_at');
          setLoading(false);
          return;
        }
        setSessionStartedAt(startedAt);
        setUser(JSON.parse(savedUser));
        // Verify / fetch fresh profile
        api.get('/auth/me')
          .then((res) => {
            setUser(res.data);
            localStorage.setItem('finverse_user', JSON.stringify(res.data));
          })
          .catch(() => {
            // silent fail, token interceptor handles 401
          })
          .finally(() => setLoading(false));
      } catch (e) {
        localStorage.clear();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username_or_email, password) => {
    const response = await api.post('/auth/login', { username_or_email, password });
    const { access_token, refresh_token, user: userData } = response.data;
    localStorage.setItem('finverse_access_token', access_token);
    localStorage.setItem('finverse_refresh_token', refresh_token);
    localStorage.setItem('finverse_user', JSON.stringify(userData));
    const startedAt = Date.now();
    localStorage.setItem('finverse_session_started_at', String(startedAt));
    setSessionStartedAt(startedAt);
    setUser(userData);
    return userData;
  };

  const register = async (formData) => {
    const response = await api.post('/auth/register', formData);
    const { access_token, refresh_token, user: userData } = response.data;
    localStorage.setItem('finverse_access_token', access_token);
    localStorage.setItem('finverse_refresh_token', refresh_token);
    localStorage.setItem('finverse_user', JSON.stringify(userData));
    const startedAt = Date.now();
    localStorage.setItem('finverse_session_started_at', String(startedAt));
    setSessionStartedAt(startedAt);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('finverse_access_token');
    localStorage.removeItem('finverse_refresh_token');
    localStorage.removeItem('finverse_user');
    localStorage.removeItem('finverse_session_started_at');
    setSessionStartedAt(null);
    setUser(null);
  };

  const staySignedIn = async () => {
    setIsRefreshingSession(true);
    setSessionRefreshError('');
    try {
      const refreshToken = localStorage.getItem('finverse_refresh_token');
      if (!refreshToken) {
        logout();
        return false;
      }
      const response = await api.post('/auth/refresh', { refresh_token: refreshToken });
      if (!response.data?.access_token) {
        throw new Error('Could not refresh your sign-in session.');
      }
      localStorage.setItem('finverse_access_token', response.data.access_token);
      const startedAt = Date.now();
      localStorage.setItem('finverse_session_started_at', String(startedAt));
      setSessionStartedAt(startedAt);
      setRemainingSeconds(SESSION_TIMEOUT_MINUTES * 60);
      return true;
    } catch (error) {
      console.error('Could not extend the sign-in session:', error);
      if (error.response?.status === 401) {
        logout();
      } else {
        setSessionRefreshError('Could not refresh your session. Check your connection and try again.');
      }
      return false;
    } finally {
      setIsRefreshingSession(false);
    }
  };

  useEffect(() => {
    if (!user || !sessionStartedAt) return undefined;

    const updateTimeRemaining = () => {
      const remaining = SESSION_TIMEOUT_MS - (Date.now() - sessionStartedAt);
      setRemainingSeconds(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= 0) logout();
    };

    updateTimeRemaining();
    const intervalId = window.setInterval(updateTimeRemaining, 1000);
    const handleStorage = (event) => {
      if (event.key === 'finverse_session_started_at' && event.newValue) {
        setSessionStartedAt(Number(event.newValue));
      } else if (event.key === 'finverse_access_token' && !event.newValue) {
        logout();
      }
    };
    const handleSessionRefresh = (event) => {
      if (event.detail?.startedAt) {
        setSessionStartedAt(event.detail.startedAt);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('finverse-session-refreshed', handleSessionRefresh);
    window.addEventListener('focus', updateTimeRemaining);
    document.addEventListener('visibilitychange', updateTimeRemaining);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('finverse-session-refreshed', handleSessionRefresh);
      window.removeEventListener('focus', updateTimeRemaining);
      document.removeEventListener('visibilitychange', updateTimeRemaining);
    };
  }, [user, sessionStartedAt]);

  const updateProfile = async (updatedData) => {
    const response = await api.put('/auth/me', updatedData);
    setUser(response.data);
    localStorage.setItem('finverse_user', JSON.stringify(response.data));
    return response.data;
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      updateProfile,
      remainingSeconds,
      staySignedIn,
      isRefreshingSession,
      sessionRefreshError,
    }}>
      {children}
      {user && sessionStartedAt && remainingSeconds <= SESSION_WARNING_MINUTES * 60 && remainingSeconds > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" role="presentation">
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-expiry-title"
          >
            <h2 id="session-expiry-title" className="text-lg font-bold">Your session is about to expire</h2>
            <p className="mt-2 text-sm text-slate-300">
              You will be signed out in {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}.
              Choose “Stay signed in” to continue for another {SESSION_TIMEOUT_MINUTES} minutes.
            </p>
            {sessionRefreshError && (
              <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
                {sessionRefreshError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Sign out
              </button>
              <button
                type="button"
                onClick={staySignedIn}
                disabled={isRefreshingSession}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                {isRefreshingSession ? 'Refreshing…' : 'Stay signed in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
