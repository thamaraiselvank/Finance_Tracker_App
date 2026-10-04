import React, { useState } from 'react';
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

export default function Import({ setActiveTab }) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null);
  const [importType, setImportType] = useState('transactions');
  const [broker, setBroker] = useState('GROWW');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setParsedData(null);
      setImportSuccess(null);
    }
  };

  const handleUploadAndParse = async () => {
    if (!file) return;
    setParsing(true);
    setImportSuccess(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('import_type', importType);
      formData.append('broker', broker);
      const res = await api.post('/import/parse-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParsedData(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!parsedData || !parsedData.preview) return;
    setCommitting(true);
    try {
      let res;
      if (importType === 'stocks') {
        res = await api.post('/import/commit-assets', { assets: parsedData.preview });
      } else {
        const txs = parsedData.preview.map(row => ({
          date: row.date,
          time: row.time || undefined,
          description: row.description,
          amount: row.amount,
          type: row.type,
          category: row.category || row.category_name || undefined,
          subcategory: row.subcategory || undefined,
          notes: row.category_name || row.category || undefined
        }));
        res = await api.post('/import/commit', { transactions: txs });
      }
      setImportSuccess(res.data.message);
      setParsedData(null);
      setFile(null);
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
            onClick={() => { setImportType('transactions'); setParsedData(null); setFile(null); }}
            className={`text-left p-4 rounded-xl border transition-colors ${importType === 'transactions' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
          >
            <p className="text-xs font-bold text-slate-900">Income & Expenses</p>
            <p className="text-xs text-slate-500 mt-1">Bank statements and transaction exports</p>
          </button>
          <button
            type="button"
            onClick={() => { setImportType('stocks'); setParsedData(null); setFile(null); }}
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
      </div>

      {/* Upload Box */}
      <div className="bg-white border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-8 text-center transition-colors">
        <input
          type="file"
          id="statement-file"
          accept=".csv,.xlsx,.xls"
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
              {importType === 'stocks' ? 'Supports broker holdings exports in CSV or Excel format' : 'Supports CSV, Excel (.xlsx, .xls) files from all Indian & Global banks'}
            </p>
          </div>
        </label>

        {file && (
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleUploadAndParse}
              disabled={parsing}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {parsing ? "Parsing columns..." : `Analyze & Preview ${importType === 'stocks' ? 'Holdings' : 'Statement'}`}
              <Sparkles className="w-4 h-4" />
            </button>
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
            </div>
            <button
              onClick={handleCommitImport}
              disabled={committing}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              {committing ? "Importing..." : `Confirm & Import ${parsedData.parsed_rows_count} ${importType === 'stocks' ? 'Holdings' : 'Transactions'}`}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 sticky top-0 font-semibold border-b border-slate-100">
                <tr>
                  {importType === 'stocks' ? (
                    <>
                      <th className="py-2.5 px-4">Stock</th>
                      <th className="py-2.5 px-4 text-right">Quantity</th>
                      <th className="py-2.5 px-4 text-right">Buy Avg (₹)</th>
                      <th className="py-2.5 px-4 text-right">Current Value (₹)</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4 text-right">Amount (₹)</th>
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
                        <td className="py-2.5 px-4 text-right text-slate-700">₹{row.buy_price.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-800">₹{row.current_value.toLocaleString('en-IN')}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-2.5 px-4 font-medium text-slate-700">{row.date}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{row.category ? `${row.category}${row.subcategory ? ` | ${row.subcategory}` : ''}` : (row.description || '—')}</td>
                        <td className="py-2.5 px-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.type === 'INCOME' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{row.type}</span></td>
                        <td className={`py-2.5 px-4 text-right font-bold ${row.type === 'INCOME' ? 'text-emerald-800' : 'text-slate-900'}`}>{row.type === 'INCOME' ? '+' : '-'}₹{row.amount.toLocaleString('en-IN')}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
