import React, { useState } from 'react';
import { BookOpenText, ChevronDown, ChevronUp } from 'lucide-react';

export default function PageGuide({ title = 'How this page works', summary, steps = [], terms = [], className = '' }) {
  const [open, setOpen] = useState(false);

  return (
    <section className={`page-guide rounded-xl border border-sky-200/80 bg-sky-50/70 p-3.5 dark:border-sky-900/60 dark:bg-sky-950/20 ${className}`}>
      <div className="flex items-start gap-3">
        <BookOpenText className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{title}</p>
          {summary && <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{summary}</p>}
          {open && (
            <div className="mt-3 grid gap-3 border-t border-sky-200/70 pt-3 dark:border-sky-900/60 sm:grid-cols-2">
              {steps.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Try this</p>
                  <ol className="mt-1 list-inside list-decimal space-y-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {steps.map((step, index) => <li key={index}>{step}</li>)}
                  </ol>
                </div>
              )}
              {terms.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Key terms</p>
                  <ul className="mt-1 space-y-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {terms.map((term) => <li key={term.term}><strong className="text-slate-700 dark:text-slate-100">{term.term}:</strong> {term.definition}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 dark:text-sky-200 dark:hover:bg-sky-900/40">
          {open ? 'Less' : 'How it works'}
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
    </section>
  );
}
