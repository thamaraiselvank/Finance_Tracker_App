import React, { useState } from 'react';
import { BookOpen, CheckCircle2, ChevronRight, Circle, X } from 'lucide-react';

export default function GettingStarted({ userId, transactions, hasGoal, hasWealth, setActiveTab }) {
  const storageKey = `finverse_getting_started_dismissed_${userId || 'account'}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(storageKey) === 'true');
  const steps = [
    { id: 'money', title: 'Record your first income or expense', detail: 'Start with one transaction or import a statement.', complete: transactions, tab: 'money' },
    { id: 'goal', title: 'Create a savings goal', detail: 'Choose a target amount and a date that matters to you.', complete: hasGoal, tab: 'goals' },
    { id: 'wealth', title: 'Explore your net worth view', detail: 'Add an account, asset, or debt if you want to track it. This step is optional.', complete: hasWealth, tab: 'wealth' },
  ];
  const completed = steps.filter((step) => step.complete).length;

  if (dismissed || completed === steps.length) return null;

  return (
    <section className="mb-4 rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 p-4 shadow-sm dark:border-teal-900/60 dark:from-teal-950/40 dark:to-slate-900" aria-labelledby="get-started-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-teal-800 dark:text-teal-300">A quick start · {completed} of {steps.length}</p>
          <h2 id="get-started-title" className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Make Finverse useful at your pace</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">You can skip any step. You do not need to invest or connect a bank account to get started.</p>
        </div>
        <button type="button" onClick={() => { localStorage.setItem(storageKey, 'true'); setDismissed(true); }} className="rounded-md p-1 text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Dismiss quick start">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {steps.map((step) => (
          <button key={step.id} type="button" onClick={() => setActiveTab(step.tab)} className="group flex min-w-0 items-start gap-2.5 rounded-lg border border-white/80 bg-white/75 p-3 text-left transition hover:border-teal-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]">
            {step.complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">{step.title}</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{step.detail}</span>
            </span>
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-teal-700" />
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setActiveTab('learn')} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:underline dark:text-teal-300">
        <BookOpen className="h-3.5 w-3.5" /> Learn the basics
      </button>
    </section>
  );
}
