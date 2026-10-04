import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  ArrowRight,
  Bot,
  User,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';

export default function AIAdvisor({ setActiveTab, hideAmounts }) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: "Hello! I am your Finverse AI Financial Advisor. I have analyzed your transactions, net worth, insurance, and retirement timeline. Ask me anything about optimizing your savings, term insurance coverage, or reaching FIRE!"
    }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/audit');
      setAudit(res.data);
    } catch (err) {
      console.error('Failed to load AI audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await api.post('/ai/chat', { question: userMsg });
      setChatMessages((prev) => [
        ...prev,
        { sender: 'ai', text: res.data.answer, actions: res.data.suggested_actions }
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'ai', text: "I'm having trouble analyzing that question right now. Please try again." }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Financial Advisor</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated intelligence auditing your spending, insurance, debt payoff, and early retirement readiness.
          </p>
        </div>
        <button
          onClick={fetchAudit}
          className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors cursor-pointer"
          title="Re-run AI Audit"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* AI Health Rating Card */}
      <div className="bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              Overall Financial Health: {audit?.overall_health_rating || 'Good'}
            </span>
            <span className="text-2xl font-black text-emerald-300">
              {audit?.score || 0} / 10
            </span>
          </div>

          <p className="text-sm md:text-base text-emerald-100 leading-relaxed max-w-3xl">
            {audit?.summary_paragraph || "Auditing your financial data..."}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-emerald-800/60 text-xs">
            <div>
              <p className="font-bold text-emerald-300 uppercase text-[10px] mb-1.5">Key Strengths</p>
              <ul className="space-y-1 text-emerald-100/90">
                {(audit?.key_strengths || []).map((s, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-bold text-amber-300 uppercase text-[10px] mb-1.5">Vulnerabilities to Address</p>
              <ul className="space-y-1 text-emerald-100/90">
                {(audit?.top_vulnerabilities || []).map((v, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Categorized AI Insight Cards */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">Tailored AI Recommendations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(audit?.insights || []).map((card, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border transition-all ${
                card.severity === 'danger' ? 'bg-red-50/60 border-red-200' :
                card.severity === 'warning' ? 'bg-amber-50/60 border-amber-200' :
                'bg-white border-slate-200/90 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {card.category}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  card.severity === 'danger' ? 'bg-red-100 text-red-800' :
                  card.severity === 'warning' ? 'bg-amber-100 text-amber-800' :
                  'bg-emerald-100 text-emerald-800'
                }`}>
                  {card.severity.toUpperCase()}
                </span>
              </div>

              <h3 className="font-bold text-slate-900 text-sm mb-1.5">{card.title}</h3>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">{card.summary}</p>

              <div className="p-3 bg-white/90 border border-slate-200/70 rounded-xl text-xs space-y-1">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  Actionable Advice:
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">{card.actionable_advice}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive AI Chat Assistant */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col h-[480px]">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-white font-bold text-xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-xs">Finverse Financial Copilot</h3>
            <p className="text-[10px] text-slate-400">Trained on wealth management, tax planning & FIRE models</p>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  AI
                </div>
              )}
              <div
                className={`max-w-xl p-3.5 rounded-2xl leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-emerald-800 text-white rounded-tr-xs'
                    : 'bg-slate-100 text-slate-800 rounded-tl-xs'
                }`}
              >
                <p>{msg.text}</p>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                    {msg.actions.map((act, actIdx) => (
                      <span key={actIdx} className="bg-white text-emerald-950 font-semibold px-2 py-0.5 rounded text-[10px] border border-emerald-200 shadow-2xs">
                        → {act}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] shrink-0 animate-pulse">
                AI
              </div>
              <div className="bg-slate-100 p-3 rounded-2xl text-slate-400 text-xs animate-pulse">
                Thinking & analyzing your portfolio...
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask about your financial health, 25x term insurance, emergency runway, or FIRE..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || chatLoading}
            className="p-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
