import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ShieldCheck, TrendingUp, ArrowRight, Lock, Mail, User, Eye, EyeOff } from 'lucide-react';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(formData.username || formData.email, formData.password);
      } else {
        await register(formData);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen aurora-mesh-bg flex items-center justify-center p-4">
      <div className="w-full max-w-4xl glass-card overflow-hidden grid grid-cols-1 md:grid-cols-2 border border-white/[0.06]">
        {/* Left Side: Brand Value Proposition */}
        <div className="relative p-8 md:p-12 flex flex-col justify-between overflow-hidden">
          {/* Ambient glow blobs */}
          <div className="absolute top-10 left-10 w-40 h-40 bg-aurora-500/20 rounded-full blur-[80px]" />
          <div className="absolute bottom-20 right-10 w-32 h-32 bg-cyan-500/15 rounded-full blur-[60px]" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-8">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl aurora-gradient flex items-center justify-center text-white font-black text-xl shadow-lg">
                  F
                </div>
                <div className="absolute inset-0 rounded-xl aurora-gradient opacity-40 blur-lg" />
              </div>
              <span className="font-extrabold text-2xl tracking-tight font-display">
                <span className="aurora-text">Fin</span><span className="text-white">verse</span><span className="text-cyan-400">.</span>
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight mb-4 leading-tight text-white font-display">
              One home for your entire financial life.
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Track multi-asset net worth, bank cashflows, health & term insurance adequacy, and plan your FIRE journey with automated AI insights.
            </p>

            <div className="space-y-3.5">
              <div className="flex items-center gap-3 text-xs text-slate-300 font-medium">
                <div className="p-1.5 bg-aurora-600/20 rounded-lg border border-aurora-500/20">
                  <TrendingUp className="w-4 h-4 text-aurora-400" />
                </div>
                <span>Real-time Assets, Stocks, Mutual Funds & Loan EMIs</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 font-medium">
                <div className="p-1.5 bg-cyan-600/20 rounded-lg border border-cyan-500/20">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                </div>
                <span>Essentials Health Check: 25x Term cover & Emergency Runway</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 font-medium">
                <div className="p-1.5 bg-amber-600/20 rounded-lg border border-amber-500/20">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
                <span>Interactive FIRE Calculator & AI-driven Wealth Advisor</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-white/[0.06] text-[11px] text-slate-500 flex items-center justify-between">
            <span>Financial independence workspace</span>
            <span>Secure local or cloud data layer</span>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-[#0f1629]/60 border-l border-white/[0.04]">
          <div className="mb-6">
            <div className="flex bg-white/[0.04] p-1 rounded-xl mb-6 border border-white/[0.06]">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                  isLogin ? 'aurora-gradient text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                  !isLogin ? 'aurora-gradient text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>

            <h2 className="text-xl font-bold text-white font-display">
              {isLogin ? 'Welcome back' : 'Start your financial journey'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {isLogin ? 'Enter your credentials to access your dashboard.' : 'Fill in your profile details to get personalized FIRE projections.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Your full name"
                    className="w-full pl-9 pr-3 py-2 text-xs glass-input"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isLogin ? 'Username or Email' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type={isLogin ? "text" : "email"}
                  required
                  value={isLogin ? (formData.username || formData.email) : formData.email}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    email: e.target.value,
                    username: isLogin ? e.target.value : formData.username 
                  })}
                  placeholder={isLogin ? "Username or email" : "you@example.com"}
                  className="w-full pl-9 pr-3 py-2 text-xs glass-input"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. alex_smith"
                  className="w-full px-3 py-2 text-xs glass-input"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2 text-xs glass-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 btn-aurora flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Please wait...' : (isLogin ? 'Sign In to Finverse' : 'Create Account')}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
