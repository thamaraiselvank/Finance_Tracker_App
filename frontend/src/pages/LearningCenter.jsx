import React, { useMemo, useState } from 'react';
import { BookOpen, Calculator, ChevronRight, Search } from 'lucide-react';

const topics = [
  { tab: 'money', title: 'Money and transactions', what: 'Record income, spending, transfers, accounts, and monthly budgets.', first: 'Add one recent income or expense. You can also import a statement and review it before saving.' },
  { tab: 'goals', title: 'Goals', what: 'Track a future target, how much you have set aside, and the date you hope to reach it.', first: 'Choose a name, target amount, current savings, and target date. A goal is a plan, not a guarantee.' },
  { tab: 'wealth', title: 'Wealth and net worth', what: 'See the value of things you own alongside debts you owe.', first: 'Add an account or asset if you want to track it. Net worth is total assets minus total liabilities.' },
  { tab: 'debts', title: 'Debts', what: 'Track balances, interest rates, monthly payments, and payoff plans.', first: 'Enter the current balance and rate from your loan statement. Compare payoff strategies before choosing one.' },
  { tab: 'insurance', title: 'Insurance', what: 'Keep policy types, coverage amounts, premiums, and renewal dates together.', first: 'Add the details shown on your policy documents. Coverage estimates are useful for review, not a guarantee of suitability.' },
  { tab: 'essentials', title: 'Financial essentials', what: 'Review basics such as emergency savings, cash flow, and coverage information.', first: 'Check that your profile income, expenses, age, and dependents are current before using the estimates.' },
  { tab: 'import', title: 'Import files', what: 'Bring in transaction statements or investment holdings from supported files.', first: 'Download a sample template if needed, upload a file, then review the preview and correct flagged rows before committing.' },
  { tab: 'calculators', title: 'Calculators', what: 'Explore estimates for loans, returns, retirement, and withdrawals.', first: 'Try sample values first. Results depend on the assumptions you enter and are not promised outcomes.' },
  { tab: 'ai-advisor', title: 'AI advisor', what: 'Ask questions about the financial information you have saved in Finverse.', first: 'Try: “How much did I spend last month?” or “How is my goal progressing?” Answers depend on the records available.' },
];

const terms = [
  ['Asset', 'Something you own that has financial value, such as a bank balance, investment, or property.'],
  ['Liability', 'Money you owe, such as a loan or credit-card balance.'],
  ['Net worth', 'The value of your assets minus the value of your liabilities.'],
  ['Allocation', 'How your tracked assets are divided among types such as cash, funds, or property.'],
  ['Cash flow', 'Money coming in compared with money going out during a period.'],
  ['Budget', 'A spending limit you set for a category and month. It is a planning guide, not a bank restriction.'],
  ['Goal', 'A target amount and date you choose to plan for.'],
  ['Premium', 'The amount paid to keep an insurance policy active.'],
  ['Sum insured', 'The maximum coverage amount stated for an insurance policy, subject to its terms.'],
  ['EMI', 'A fixed periodic loan payment that generally includes principal and interest.'],
  ['SIP', 'A plan to invest a set amount at regular intervals. Returns are not guaranteed.'],
  ['CAGR', 'A smoothed annual growth rate between a starting value and ending value.'],
  ['XIRR', 'An annualized return estimate that accounts for investments made on different dates.'],
  ['SWP', 'A plan to withdraw a chosen amount from an investment periodically. The balance can rise or fall.'],
  ['FIRE', 'Financial Independence, Retire Early: a planning approach based on expenses, savings, and assumptions.'],
];

export default function LearningCenter({ setActiveTab }) {
  const [query, setQuery] = useState('');
  const visibleTerms = useMemo(() => terms.filter(([term, definition]) => `${term} ${definition}`.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Finverse · Learn</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Money basics, in plain language</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">You don’t need investing experience to use Finverse. Start with the information you know, skip anything you’re not ready to add, and come back to these guides whenever you need them.</p>
      </header>

      <section>
        <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-white">What each area is for</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {topics.map((topic) => (
            <article key={topic.tab} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{topic.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{topic.what}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400"><strong className="text-slate-700 dark:text-slate-200">First step:</strong> {topic.first}</p>
              <button type="button" onClick={() => setActiveTab(topic.tab)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline dark:text-teal-300">Open {topic.title} <ChevronRight className="h-3.5 w-3.5" /></button>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-teal-700 dark:text-teal-300" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Calculator names</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['SIP', 'Estimate the future value of regular contributions using an assumed return.'],
            ['Lumpsum', 'Estimate how a one-time investment could grow under an assumed return.'],
            ['CAGR', 'Calculate the smoothed annual growth rate between two values.'],
            ['XIRR', 'Estimate annualized returns when cash flows happen on different dates.'],
            ['EMI', 'Estimate a loan’s regular payment and the interest implied by the inputs.'],
            ['SWP', 'Explore how periodic withdrawals and assumptions affect a portfolio over time.'],
            ['FIRE / Retirement', 'Estimate a target corpus and savings path from expenses and assumptions.'],
          ].map(([name, description]) => <div key={name} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]"><p className="text-xs font-bold text-slate-800 dark:text-slate-100">{name}</p><p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{description}</p></div>)}
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Calculator outputs are estimates based on inputs you choose; actual returns and costs can differ.</p>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-teal-700 dark:text-teal-300" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Glossary</h2>
        </div>
        <label className="relative block max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a term, like net worth or EMI" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-white" />
        </label>
        <dl className="mt-3 grid gap-2 md:grid-cols-2">
          {visibleTerms.map(([term, definition]) => <div key={term} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]"><dt className="text-xs font-bold text-slate-800 dark:text-slate-100">{term}</dt><dd className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{definition}</dd></div>)}
          {!visibleTerms.length && <p className="text-xs text-slate-500">No matching term. Try a shorter search.</p>}
        </dl>
      </section>
    </div>
  );
}
