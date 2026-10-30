import React, { useEffect, useState } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Trash2, 
  Sparkles,
  Download
} from 'lucide-react';
import api from '../services/api';
import useCurrency from '../utils/useCurrency';
import PageGuide from '../components/PageGuide';

export default function Import({ setActiveTab }) {
  const { formatCurrency, currencySymbol } = useCurrency();
  const [file, setFile] = useState(null);
  const [pdfPassword, setPdfPassword] = useState('');
  const [useGemini, setUseGemini] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null);
  const [importType, setImportType] = useState('transactions');
  const [broker, setBroker] = useState('GROWW');
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState('');

  useEffect(() => {
    api.get('/accounts')
      .then((response) => {
        const availableAccounts = Array.isArray(response.data) ? response.data : [];
        setAccounts(availableAccounts);
        setAccountId((current) => current || String(availableAccounts[0]?.id || ''));
      })
      .catch((error) => {
        console.error('Failed to load accounts for transaction import:', error);
        setAccountsError('Could not load accounts. Visit Money > Accounts, then return here to retry.');
      })
      .finally(() => {
        setAccountsLoading(false);
      });
  }, []);

  useEffect(() => {
    api.get('/categories')
      .then((response) => {
        setCategories(Array.isArray(response.data) ? response.data : []);
      })
      .catch((error) => {
        console.error('Failed to load categories for transaction import:', error);
        setCategoriesError('Could not load categories. Transactions will use the default category unless you choose one.');
      });
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPdfPassword('');
      setUseGemini(false);
      setParsedData(null);
      setParseError('');
      setImportSuccess(null);
    }
  };

  const updatePreviewRow = (rowIndex, updates) => {
    setParsedData((current) => ({
      ...current,
      preview: current.preview.map((row, index) => {
        if (index !== rowIndex) return row;
        const requiresRecheck = row.needs_review
          && Object.keys(updates).some((key) => (
            ['date', 'description', 'amount', 'type'].includes(key)
          ))
          && !Object.prototype.hasOwnProperty.call(updates, 'reviewed');
        return {
          ...row,
          ...updates,
          ...(requiresRecheck ? { reviewed: false } : {})
        };
      })
    }));
  };

  const transactionRows = parsedData?.preview || [];
  const includedTransactions = transactionRows.filter((row) => row.included !== false);
  const reviewableTransactions = transactionRows.filter((row) => row.needs_review);
  const unresolvedTransactions = includedTransactions.filter((row) => (
    !['INCOME', 'EXPENSE'].includes(row.type)
    || !/^\d{4}-\d{2}-\d{2}$/.test(row.date || '')
    || !String(row.description || '').trim()
    || !Number.isFinite(Number(row.amount))
    || Number(row.amount) <= 0
    || (row.needs_review && !row.reviewed)
  ));

  const updateAllTransactions = (updates) => {
    setParsedData((current) => current && ({
      ...current,
      preview: current.preview.map((row) => ({ ...row, ...updates }))
    }));
  };

  const handleUploadAndParse = async () => {
    if (!file) return;
    setParsing(true);
    setImportSuccess(null);
    setParseError('');
    setParsedData(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('import_type', importType);
      formData.append('broker', broker);
      if (file.name.toLowerCase().endsWith('.pdf') && pdfPassword) {
        formData.append('password', pdfPassword);
      }
      if (file.name.toLowerCase().endsWith('.pdf') && useGemini) {
        formData.append('use_gemini', 'true');
      }
      const res = await api.post('/import/parse-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParsedData(res.data);
      setPdfPassword('');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setParseError(typeof detail === 'string' ? detail : 'Could not parse this file. Check the file and try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!parsedData || !parsedData.preview) return;
    if (importType === 'transactions' && !accountId) {
      alert('Create or select an account before importing transactions.');
      return;
    }
    if (importType === 'transactions' && unresolvedTransactions.length > 0) {
      alert(
        `${unresolvedTransactions.length} included transaction(s) still need review. ` +
        'Correct the date, description, amount, and type, then mark them reviewed—or exclude them.'
      );
      return;
    }
    if (importType === 'transactions' && includedTransactions.length === 0) {
      alert('Select at least one transaction to import.');
      return;
    }
    setCommitting(true);
    try {
      let res;
      if (importType === 'stocks') {
        res = await api.post('/import/commit-assets', { assets: parsedData.preview });
      } else {
        const txs = includedTransactions.map(row => ({
          date: row.date,
          time: row.time || undefined,
          description: row.description,
          amount: row.amount,
          type: row.type,
          category: row.category || row.category_name || undefined,
          subcategory: row.subcategory || undefined,
          notes: row.category_name || row.category || undefined
        }));
        res = await api.post('/import/commit', { account_id: accountId, transactions: txs });
      }
      setImportSuccess(res.data.message);
      setParsedData(null);
      setFile(null);
      setPdfPassword('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Import failed');
    } finally {
      setCommitting(false);
    }
  };

  const handleDownloadSampleCSV = () => {
    const csvContent = importType === 'stocks'
      ? "data:text/csv;charset=utf-8,Stock Name,ISIN,Quantity,Buy Average,Buy Value,LTP,Current Value,Exchange\nReliance Industries,INE002A01018,10,2400,24000,2650,26500,NSE\n"
      : "data:text/csv;charset=utf-8,Date,Description,Amount,Type,Category\n2026-08-01,Monthly Salary,80000,INCOME,Salary\n2026-08-02,House Rent,20000,EXPENSE,Housing & Rent\n2026-08-05,Supermarket Groceries,4500,EXPENSE,Food & Groceries\n2026-08-10,Electricity Bill,1800,EXPENSE,Utilities & Bills\n2026-08-12,Freelance Project,30000,INCOME,Freelance / Business\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", importType === 'stocks' ? "finverse_sample_holdings.csv" : "finverse_sample_statement.csv");
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Import Data</h1>
          <p className="text-xs text-slate-500 mt-0.5">Import bank transactions or investment holdings from CSV and Excel files.</p>
        </div>
        <button
          onClick={handleDownloadSampleCSV}
          className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" /> Sample Template
        </button>
      </div>

      <PageGuide
        title="Import: preview before adding records"
        summary="Import a bank statement or broker holdings file. Finverse shows parsed rows so you can review and correct them before saving."
        steps={['Choose Income & Expenses or Stocks & Holdings.', 'Use the sample template if you are unsure about the file columns.', 'Review flagged rows and select the account before committing.']}
        terms={[{ term: 'Preview', definition: 'Rows parsed from your file; they are not saved until you confirm the import.' }, { term: 'Category', definition: 'A label used to group a transaction, such as housing or groceries.' }]}
      />

      {importSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>{importSuccess}</span>
          </div>
          <button
            onClick={() => setActiveTab('money')}
            className="px-3 py-1 bg-emerald-800 text-white rounded-lg text-xs font-semibold hover:bg-emerald-900"
          >
            View in Money
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">What are you importing?</h2>
          <p className="text-xs text-slate-500 mt-1">Choose the file type so Finverse classifies each row correctly.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setImportType('transactions'); setParsedData(null); setFile(null); setPdfPassword(''); }}
            className={`text-left p-4 rounded-xl border transition-colors ${importType === 'transactions' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
          >
            <p className="text-xs font-bold text-slate-900">Income & Expenses</p>
            <p className="text-xs text-slate-500 mt-1">Bank statements and transaction exports</p>
          </button>
          <button
            type="button"
            onClick={() => { setImportType('stocks'); setParsedData(null); setFile(null); setPdfPassword(''); }}
            className={`text-left p-4 rounded-xl border transition-colors ${importType === 'stocks' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
          >
            <p className="text-xs font-bold text-slate-900">Stocks & Holdings</p>
            <p className="text-xs text-slate-500 mt-1">Broker holdings from Groww, Zerodha, or another broker</p>
          </button>
        </div>
        {importType === 'stocks' && (
          <label className="block max-w-sm text-xs font-semibold text-slate-700">
            Broker export
            <select value={broker} onChange={(e) => setBroker(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500">
              <option value="GROWW">Groww</option>
              <option value="ZERODHA">Zerodha</option>
              <option value="UPSTOX">Upstox</option>
              <option value="ANGEL_ONE">Angel One</option>
              <option value="OTHER">Other / Generic CSV</option>
            </select>
          </label>
        )}
        {importType === 'transactions' && (
          <div className="space-y-2">
            {accounts.length > 0 ? (
              <label className="block max-w-sm text-xs font-semibold text-slate-700">
                Deposit transactions into account <span className="text-red-600">*</span>
                <select
                  required
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select an account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </label>
            ) : accountsLoading ? (
              <p className="text-xs text-slate-500">Loading accounts…</p>
            ) : accountsError ? (
              <p className="max-w-xl rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
                {accountsError}
              </p>
            ) : (
              <div className="import-account-notice max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                Create an account before importing transactions so each entry updates the correct balance.
                <button
                  type="button"
                  onClick={() => setActiveTab('money')}
                  className="ml-2 font-bold text-emerald-800 underline"
                >
                  Go to Money
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Box */}
      <div className="bg-white border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-8 text-center transition-colors">
        <input
          type="file"
          id="statement-file"
          accept={importType === 'stocks' ? '.csv,.xlsx,.xls' : '.csv,.xlsx,.xls,.pdf'}
          onChange={handleFileChange}
          className="hidden"
        />
        <label
          htmlFor="statement-file"
          className="cursor-pointer flex flex-col items-center justify-center space-y-3"
        >
          <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {file ? file.name : "Click to upload or drag and drop statement file"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {importType === 'stocks'
                ? 'Supports broker holdings exports in CSV or Excel format'
                : 'Supports CSV, Excel, and text-based or scanned PDF statements (up to 15 MB). PDF extraction uses local parsing/OCR, with optional Gemini assistance.'}
            </p>
          </div>
        </label>

        {importType === 'transactions' && file?.name.toLowerCase().endsWith('.pdf') && (
          <>
          <label className="mx-auto mt-5 block max-w-sm text-left text-xs font-semibold text-slate-700">
            PDF password <span className="font-normal text-slate-500">(leave blank if the file is not protected)</span>
            <input
              type="password"
              value={pdfPassword}
              onChange={(event) => setPdfPassword(event.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <span className="mt-1 block font-normal text-slate-500">The password is used only to read this upload and is not saved.</span>
          </label>
          <label className="mx-auto mt-4 flex max-w-sm items-start gap-2 text-left text-xs text-slate-700">
            <input
              type="checkbox"
              checked={useGemini}
              onChange={(event) => setUseGemini(event.target.checked)}
              className="mt-0.5 accent-emerald-700"
            />
            <span>
              <strong>Try Gemini PDF extraction</strong>
              <span className="mt-0.5 block text-slate-500">Sends an unencrypted PDF to Vertex AI for extraction. Review every row before importing. Password-protected PDFs use the existing local parser.</span>
            </span>
          </label>
          </>
        )}

        {file && (
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleUploadAndParse}
              disabled={parsing}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {parsing ? "Reading statement..." : `Analyze & Preview ${importType === 'stocks' ? 'Holdings' : 'Statement'}`}
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        )}
        {parseError && (
          <div className="mx-auto mt-4 flex max-w-xl items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-xs text-red-800" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span><strong>Import analysis failed.</strong> {parseError}</span>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {parsedData && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
                <h3 className="font-bold text-slate-900 text-sm">{importType === 'stocks' ? 'Holdings Preview' : 'Statement Preview'}</h3>
              <p className="text-xs text-slate-500">
                Detected {parsedData.parsed_rows_count} {importType === 'stocks' ? 'holdings' : 'transactions'} from {parsedData.filename}
              </p>
              {parsedData.detected_bank && (
                <p className="mt-1 text-xs text-emerald-800">
                  Bank suggested from statement: {parsedData.detected_bank}. Confirm the correct app account above.
                </p>
              )}
              {parsedData.review_notice && (
                <p className="mt-1 text-xs font-medium text-amber-700">{parsedData.review_notice}</p>
              )}
              {parsedData.parser === 'local_pdf_fallback' && (
                <p className="mt-1 text-xs text-amber-700" role="status">
                  Gemini extraction failed, so local parsing was used. {parsedData.gemini_fallback_reason}
                </p>
              )}
              {importType === 'transactions' && (
                <p className="mt-1 text-xs text-slate-500">
                  Check each row. Uncertain rows need a valid date, description, amount and type, plus explicit review—or exclude them.
                  {unresolvedTransactions.length > 0 && ` ${unresolvedTransactions.length} row(s) need attention.`}
                </p>
              )}
            </div>
            <button
              onClick={handleCommitImport}
              disabled={committing || (importType === 'transactions' && (
                !accountId || accounts.length === 0 || includedTransactions.length === 0
                || unresolvedTransactions.length > 0
              ))}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {committing ? "Importing..." : `Confirm & Import ${importType === 'stocks' ? parsedData.parsed_rows_count : includedTransactions.length} ${importType === 'stocks' ? 'Holdings' : 'Transactions'}`}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-96">
            {importType === 'transactions' && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">Selection</span>
                  <button type="button" onClick={() => updateAllTransactions({ included: true })} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Select all</button>
                  <button type="button" onClick={() => updateAllTransactions({ included: false })} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Deselect all</button>
                </div>
                {reviewableTransactions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">Review confirmations</span>
                    <button type="button" onClick={() => updateAllTransactions({ reviewed: true })} className="rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-slate-800 dark:text-emerald-300 dark:hover:bg-slate-700">Mark all reviewed</button>
                    <button type="button" onClick={() => updateAllTransactions({ reviewed: false })} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Clear review</button>
                  </div>
                )}
                <p className="w-full text-[10px] text-slate-500 dark:text-slate-400">Mark rows reviewed only after checking the dates, descriptions, amounts, and transaction types.</p>
              </div>
            )}
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 sticky top-0 font-semibold border-b border-slate-100">
                <tr>
                  {importType === 'stocks' ? (
                    <>
                      <th className="py-2.5 px-4">Stock</th>
                      <th className="py-2.5 px-4 text-right">Quantity</th>
                      <th className="py-2.5 px-4 text-right">Buy Avg ({currencySymbol})</th>
                      <th className="py-2.5 px-4 text-right">Current Value ({currencySymbol})</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2.5 px-4">Include</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Review</th>
                      <th className="py-2.5 px-4 text-right">Amount ({currencySymbol})</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(parsedData.preview || []).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {importType === 'stocks' ? (
                      <>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{row.name}</td>
                        <td className="py-2.5 px-4 text-right text-slate-700">{row.quantity}</td>
                        <td className="py-2.5 px-4 text-right text-slate-700">{formatCurrency(row.buy_price)}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-800">{formatCurrency(row.current_value)}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-4">
                          <input
                            type="checkbox"
                            aria-label={`Include ${row.description || `transaction ${idx + 1}`}`}
                            checked={row.included !== false}
                            onChange={(event) => updatePreviewRow(idx, { included: event.target.checked })}
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="date"
                            aria-label={`Date for ${row.description || `transaction ${idx + 1}`}`}
                            value={row.date || ''}
                            onChange={(event) => updatePreviewRow(idx, { date: event.target.value })}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            maxLength={255}
                            aria-label={`Description for transaction ${idx + 1}`}
                            value={row.description || ''}
                            onChange={(event) => updatePreviewRow(idx, { description: event.target.value })}
                            className="min-w-40 rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-900"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            aria-label={`Category for ${row.description || `transaction ${idx + 1}`}`}
                            value={row.category || ''}
                            onChange={(event) => {
                              const category = event.target.value;
                              updatePreviewRow(idx, { category });
                            }}
                            className="max-w-56 rounded-md border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800"
                          >
                            <option value="">Other / choose category</option>
                            {row.category && !categories.some((category) => (
                              category.name.toLowerCase() === row.category.toLowerCase()
                            )) && <option value={row.category}>{row.category}</option>}
                            {categories
                              .filter((category) => category.type === row.type)
                              .map((category) => (
                                <option key={category.id} value={category.name}>{category.name}</option>
                              ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            aria-label={`Transaction type for ${row.description || `transaction ${idx + 1}`}`}
                            value={row.type || ''}
                            onChange={(event) => {
                              const type = event.target.value;
                              const matchingCategory = categories.some((category) => (
                                category.type === type
                                && category.name.toLowerCase() === (row.category || '').toLowerCase()
                              ));
                              updatePreviewRow(idx, {
                                type,
                                category: !type
                                  ? ''
                                  : matchingCategory
                                  ? row.category
                                  : categories.find((category) => (
                                    category.type === type
                                    && category.name === (type === 'INCOME' ? 'Other Income' : 'Other Expenses')
                                  ))?.name || ''
                              });
                            }}
                            className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold ${row.type === 'INCOME' ? 'text-emerald-800' : 'text-red-800'}`}
                          >
                            <option value="">Select type</option>
                            <option value="INCOME">INCOME</option>
                            <option value="EXPENSE">EXPENSE</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-4">
                          {row.needs_review ? (
                            <label className="flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold text-amber-700">
                              <input
                                type="checkbox"
                                checked={Boolean(row.reviewed)}
                                onChange={(event) => updatePreviewRow(idx, { reviewed: event.target.checked })}
                              />
                              I checked this row
                            </label>
                          ) : (
                            <span className="text-[10px] text-slate-500">OK</span>
                          )}
                        </td>
                        <td className={`py-2.5 px-4 text-right font-bold ${row.type === 'INCOME' ? 'text-emerald-800' : 'text-slate-900'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {row.type && <span>{row.type === 'INCOME' ? '+' : '-'}</span>}
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              aria-label={`Amount for ${row.description || `transaction ${idx + 1}`}`}
                              value={row.amount ?? ''}
                              onChange={(event) => updatePreviewRow(idx, {
                                amount: event.target.value === '' ? '' : Number(event.target.value)
                              })}
                              className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1 text-right"
                            />
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {categoriesError && (
            <p className="text-xs text-amber-700" role="status">{categoriesError}</p>
          )}
        </div>
      )}
    </div>
  );
}
