import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  ArrowRight,
  Bot,
  Plus,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';
import AIResponse from '../components/AIResponse';
import PageGuide from '../components/PageGuide';

export default function AIAdvisor({ setActiveTab, hideAmounts }) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [quota, setQuota] = useState(null);
  const [conversationLoading, setConversationLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
    api.get('/ai/quota').then(({ data }) => setQuota(data)).catch(() => {});
    let mounted = true;
    api.get('/ai/conversations/current')
      .then(({ data }) => {
        if (!mounted) return;
        setConversationId(data.id || null);
        const restored = (data.messages || []).map((message) => ({
          sender: message.role === 'user' ? 'user' : 'ai',
          text: message.content,
          actions: message.actions || [],
        }));
        setChatMessages(restored.length ? restored : [{
          sender: 'ai',
          text: "Hi! I’m your Finverse financial assistant. Ask about your spending, savings, debt, investments, insurance, or goals. I’ll use the financial information saved in your account to help answer.",
        }]);
      })
      .catch(() => {
        if (mounted) setChatMessages([{ sender: 'ai', text: "Hi! I’m your Finverse financial assistant. Ask about your spending, savings, debt, investments, insurance, or goals." }]);
      })
      .finally(() => { if (mounted) setConversationLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!quota?.resets_at) return undefined;
    const refresh = () => api.get('/ai/quota').then(({ data }) => setQuota(data)).catch(() => {});
    const msUntilReset = new Date(quota.resets_at).getTime() - Date.now() + 1000;
    const timer = window.setTimeout(refresh, Math.max(1000, Math.min(msUntilReset, 2147483647)));
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [quota?.resets_at]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages, chatLoading, conversationLoading]);

  const sendQuestion = async (question) => {
    if (!question.trim() || chatLoading || conversationLoading) return;
    const userMsg = question.trim();
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await api.post('/ai/chat', { question: userMsg, conversation_id: conversationId });
      setConversationId(res.data.conversation_id || conversationId);
      if (res.data.quota) setQuota(res.data.quota);
      setChatMessages((prev) => [
        ...prev,
        { sender: 'ai', text: res.data.answer, actions: res.data.suggested_actions }
      ]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.quota) setQuota(detail.quota);
      const errorMessage = detail?.code === 'chat_rate_limited' && detail?.retry_after_seconds
        ? `${detail.message} Try again in ${detail.retry_after_seconds} seconds.`
        : detail?.message || "I'm having trouble analyzing that question right now. Please try again.";
      setChatMessages((prev) => [
        ...prev,
        { sender: 'ai', text: errorMessage }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    sendQuestion(chatInput);
  };

  const handleNewChat = async () => {
    if (chatLoading || conversationLoading) return;
    setConversationLoading(true);
    try {
      const { data } = await api.post('/ai/conversations');
      setConversationId(data.id);
      setChatMessages([{ sender: 'ai', text: "Hi! I’m your Finverse financial assistant. Ask about your spending, savings, debt, investments, insurance, or goals." }]);
    } catch {
      setChatMessages((prev) => [...prev, { sender: 'ai', text: "I couldn’t start a new conversation. Please try again." }]);
    } finally {
      setConversationLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto flex flex-col gap-8">
      {/* Top Header */}
      <div className="order-1 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Financial Advisor</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ask about your finances, goals, spending, debt, and savings. Your conversation is saved to your account.
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

      <PageGuide
        className="order-2"
        title="AI Advisor: ask about your saved financial records"
        summary="The assistant can explain recorded spending, goals, wealth, debt, and insurance. If details are missing, it may ask a follow-up."
        steps={['Ask one clear question, such as “How did my spending change last month?”', 'Use a follow-up to explore the answer.', 'Check important figures against your saved records; estimates are not guarantees.']}
      />

      {/* AI Health Rating Card */}
      <div className="order-4 bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
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
      <div className="order-5 space-y-4">
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
      <div className="ai-chat-panel order-3 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col h-[560px]">
        <div className="ai-chat-header px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-white font-bold text-xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-xs">Finverse Financial Copilot</h3>
            <p className="text-[10px] text-slate-400">Answers finance questions using your account’s saved summaries</p>
          </div>
          <button type="button" onClick={handleNewChat} disabled={chatLoading || conversationLoading} className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50" title="Start a new conversation">
            <Plus className="h-3.5 w-3.5" /> New chat
          </button>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
          {conversationLoading && <p className="text-center text-slate-400">Loading your conversation…</p>}
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
                    ? 'ai-chat-user-bubble bg-emerald-800 text-white rounded-tr-xs'
                  : 'ai-chat-assistant-bubble bg-slate-100 text-slate-800 rounded-tl-xs'
                }`}
              >
                {msg.sender === 'ai' ? <AIResponse text={msg.text} /> : <p>{msg.text}</p>}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
                    {msg.actions.map((act, actIdx) => (
                      <button key={actIdx} type="button" onClick={() => sendQuestion(act)} disabled={chatLoading || conversationLoading} className="ai-chat-action bg-white text-emerald-950 font-semibold px-2 py-0.5 rounded text-[10px] border border-emerald-200 shadow-2xs disabled:opacity-50">
                        → {act}
                      </button>
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
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSendMessage} className="ai-chat-composer p-4 bg-white border-t border-slate-100 flex items-center gap-2">
          <input
            type="text"
            maxLength={1200}
            placeholder="Ask about spending, savings, a goal, debt, or financial health..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || chatLoading || conversationLoading}
            className="p-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        {quota && (
          <div className="ai-quota-status px-4 pb-2" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="font-semibold">AI questions: {quota.used} of {quota.limit} used</span>
              <span>{quota.remaining} left today</span>
            </div>
            <div className="ai-quota-track mt-1 h-1.5 overflow-hidden rounded-full" role="progressbar" aria-label="Daily AI questions used" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={quota.used}>
              <div className={`ai-quota-fill h-full rounded-full transition-all ${quota.remaining === 0 ? 'is-exhausted' : ''}`} style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[10px]">Resets at {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: quota.timezone }).format(new Date(quota.resets_at))}</p>
          </div>
        )}
        <p className="ai-chat-disclosure px-4 pb-3 text-[10px] text-slate-400">For financial guidance only. Relevant account summaries are sent securely from the backend to Vertex AI to answer your question.</p>
      </div>
    </div>
  );
}
