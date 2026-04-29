import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getReport, getDownloadUrl, getColumnDownloadUrl, saveRuleSet, updateRuleSet, listSavedRules } from '../services/api';
import { ChartIcon, CheckCircleIcon, CopyIcon, DatabaseIcon, DownloadIcon, UploadIcon, XCircleIcon, XIcon } from '../icon/icon';
import { Loader } from '../components/Loader';
import { ErrorModal } from '../components/ErrorModal';
import { parseReportRules } from '../utlis/utlis';

/* ------------------------------------------------------------------ QA Report Table ------------------------------------------------------------------ */

const QAReportTable = React.memo(function QAReportTable({ summary, rows, totalRows, onViewErrors, onExport }) {
  if (!summary || !Array.isArray(summary) || summary.length === 0) return null;

  // 1. Derive column order and basic rule info from summary
  const { columnOrder, colMap } = useMemo(() => {
    const order = [];
    const map = {};
    summary.forEach(item => {
      const col = item.column || item.col || '—';
      const rule = item.rule || 'validation';
      const failCount = item.failCount ?? item.fail_count ?? 0;
      const passCount = item.passCount ?? item.pass_count ?? 0;
      if (!map[col]) {
        order.push(col);
        map[col] = { name: col, rules: [], blankRows: 0, hasEmptyRule: false };
      }
      map[col].rules.push({ rule, failCount, passCount });
      if (rule === 'has_empty') {
        map[col].hasEmptyRule = true;
        map[col].blankRows = failCount;
      }
    });
    return { columnOrder: order, colMap: map };
  }, [summary]);

  // 2. Compute per-column unique % from summary.uniqueCount
  // The engine tracks a Set per column during streaming and stores the distinct
  // count in each summary entry — no need to read row.data here.
  const uniqueStats = useMemo(() => {
    if (!summary || summary.length === 0 || columnOrder.length === 0) return {};
    const stats = {};
    for (const col of columnOrder) {
      const entry = summary.find(s => (s.column || s.col) === col);
      const uniqueCount = entry?.uniqueCount ?? 0;
      const pct = totalRows > 0 ? (uniqueCount / totalRows) * 100 : 0;
      stats[col] = pct.toFixed(2);
    }
    return stats;
  }, [summary, columnOrder, totalRows]);

  // 3. Compute failure row IDs per column and per rule
  const colFailData = useMemo(() => {
    const failData = {};
    columnOrder.forEach(col => { failData[col] = { failRowIds: [], byRule: {} }; });

    for (const row of rows) {
      const errors = row.errors || row.error_details || [];
      if (!Array.isArray(errors)) continue;
      const seenColRule = new Set();
      const seenCol = new Set();
      for (const err of errors) {
        if (typeof err !== 'object') continue;
        const col = err.column || err.field;
        const rule = err.rule || 'validation';
        if (!col || !failData[col]) continue;

        if (!seenCol.has(col)) {
          seenCol.add(col);
          failData[col].failRowIds.push(row.row_number);
        }
        const ruleKey = `${col}::${rule}`;
        if (!seenColRule.has(ruleKey)) {
          seenColRule.add(ruleKey);
          if (!failData[col].byRule[rule]) failData[col].byRule[rule] = [];
          failData[col].byRule[rule].push(row.row_number);
        }
      }
    }
    return failData;
  }, [rows, columnOrder]);

  // 4. Build final table rows
  const tableData = useMemo(() => {
    return columnOrder.map((col, idx) => {
      const data = colMap[col];
      const failRowIds = colFailData[col]?.failRowIds || [];
      const byRule = colFailData[col]?.byRule || {};
      const qcFail = failRowIds.length;
      const qcPass = totalRows - qcFail;
      const rulesWithFailures = data.rules.filter(r => r.failCount > 0).length;
      const failPct = data.rules.length > 0 ? ((rulesWithFailures / data.rules.length) * 100).toFixed(2) : '0.00';
      const reasons = data.rules.map(r => r.rule);
      const blankRows = data.hasEmptyRule ? data.blankRows : null;
      const isPass = qcFail === 0;
      const uniquePercent = uniqueStats[col] || '0.00';

      return {
        id: idx + 1,
        col,
        total: totalRows,
        qcPass,
        qcFail,
        blankRows,
        reasons,
        isPass,
        failPct,
        uniquePercent,
        allRowIds: failRowIds,
        sampleRowIds: failRowIds.slice(0, 3),
        hasMoreRowIds: failRowIds.length > 3,
        rules: data.rules,
        byRule,
      };
    });
  }, [columnOrder, colMap, colFailData, totalRows, uniqueStats]);

  const handleSingleColumnExport = (row) => {
    let txt = `Headers  -  ${row.col}\n`;
    row.rules.forEach(({ rule, failCount }) => {
      if (failCount > 0) {
        const ids = (row.byRule[rule] || []).join(', ');
        txt += `${rule}  ${failCount}  [${ids}]\n`;
      }
    });
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${row.col}_validation.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  //!  Export all columns' errors as TXT in a single file (used for "Export All" button) 
  const handleExportAll = () => {
    let txt = '';
    tableData.forEach((row, i) => {
      if (i > 0) txt += '\n';
      txt += `Headers  -  ${row.col}\n`;
      if (row.isPass) {
        txt += `Status: QA Pass (no failures)\n`;
      } else {
        row.rules.forEach(({ rule, failCount }) => {
          if (failCount > 0) {
            const ids = (row.byRule[rule] || []).join(', ');
            txt += `${rule}  ${failCount}  [${ids}]\n`;
          }
        });
      }
    });
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'validation_report_all.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Export All bar */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <p className="text-xs text-slate-400">
          {tableData.filter(r => !r.isPass).length} column{tableData.filter(r => !r.isPass).length !== 1 ? 's' : ''} with failures
        </p>
        <button onClick={handleExportAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#3F4D67] hover:bg-[#2e3a50] transition-colors shadow-sm">
          <DownloadIcon size={13} />
          Export All as TXT
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: '#2c4a6e' }}>
              {['ID', 'Headers', 'Total', 'QC Pass', 'QC Fail', 'Blank Rows', 'Reasons', 'Unique %', 'Status', 'QC Fail %', 'No. of Row ID', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap border-r border-white/10 last:border-r-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.map(row => (
              <tr key={row.col} className="border-b border-slate-200 hover:brightness-95 transition-all">
                <td className="px-4 py-2.5 text-slate-500 text-xs">{row.id}</td>
                <td className="px-4 py-2.5 text-slate-800 whitespace-nowrap">{row.col}</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{row.total.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-emerald-700 tabular-nums">{row.qcPass.toLocaleString()}</td>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: row.qcFail > 0 ? '#dc2626' : '#64748b' }}>
                  {row.qcFail.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                  {row.blankRows !== null ? row.blankRows.toLocaleString() : <span className="text-slate-300">0</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-600 text-xs max-w-[200px]">
                  {row.reasons.length > 0 ? <span>[{row.reasons.join(', ')}]</span> : <span className="text-slate-300">-</span>}
                </td>
                {/* Unique % — from summary.uniqueCount tracked by the engine */}
                <td className="px-4 py-2.5 text-slate-700 tabular-nums text-xs font-medium">
                  {row.uniquePercent}%
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-block px-2.5 py-1 rounded text-xs font-bold text-white whitespace-nowrap" style={{ backgroundColor: row.isPass ? '#16a34a' : '#dc2626' }}>
                    {row.isPass ? 'QA Pass' : 'QA Fail'}
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-xs" style={{ color: row.qcFail > 0 ? '#dc2626' : '#64748b' }}>
                  {row.failPct}%
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[180px]">
                  {row.sampleRowIds.length > 0 ? <span>[{row.sampleRowIds.join(', ')}{row.hasMoreRowIds ? '...' : ''}]</span> : <span className="text-slate-300">[]</span>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={row.isPass}
                      onClick={() => handleSingleColumnExport(row)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${row.isPass ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' : 'text-white bg-green-500 hover:bg-green-600'}`}
                    >
                      <DownloadIcon size={12} />
                      Export
                    </button>
                    {row.qcFail > 0 && (
                      <button
                        onClick={() => onViewErrors(row.col)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200 transition-colors whitespace-nowrap"
                      >
                        <XCircleIcon size={12} />
                        Errors
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
/* ------------------------------------------------------------------ Main Component ------------------------------------------------------------------ */
export default function ValidationResults() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const rulesUnchanged = location.state?.rulesUnchanged === true;
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const filterInitialized = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedColumnForModal, setSelectedColumnForModal] = useState('');
  // Save Rules modal
  const [saveStep, setSaveStep] = useState(null); // null | 'confirm' | 'name'
  const [feedName, setFeedName] = useState('');
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await getReport(reportId);
        const data = res.data?.data || res.data;
        setReport(data);
      } catch (err) {
        toast.error(err.displayMessage || 'Failed to load report.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [reportId, navigate]);

  useEffect(() => {
    if (!report || filterInitialized.current) return;
    filterInitialized.current = true;
    const fc = report?.failedRows ?? report?.failed_rows ?? 0;
    setFilter(fc > 0 ? 'fail' : 'all');
  }, [report]);

  const rows = useMemo(() => {
    if (!report) return [];
    return report.results || report.rows || report.data || [];
  }, [report]);

  const totalRows = report?.totalRows ?? report?.total_rows ?? rows.length;
  // const passedCount = report?.passedRows ?? report?.passed_rows ?? rows.filter(r => r.status === 'pass' || r.passed === true).length;
  // const failedCount = report?.failedRows ?? report?.failed_rows ?? rows.filter(r => r.status === 'fail' || r.passed === false).length;
  const summary = report?.summary || [];

  // Column-based QA stats (used in the summary cards)
  const uniqueColumns = [...new Set(summary.map(s => s.column || s.col).filter(Boolean))];
  const totalColumns = uniqueColumns.length;
  const failingColumns = uniqueColumns.filter(col =>
    summary.some(s => (s.column || s.col) === col && (s.failCount ?? 0) > 0)
  ).length;
  const passingColumns = totalColumns - failingColumns;
  const duplicateRowCount = report?.duplicateRowCount ?? 0;
  const filename = report?.originalName || report?.uploadId?.originalName || report?.filename || '';

  const handleViewColumnModal = useCallback((col) => {
    setSelectedColumnForModal(col);
    setModalOpen(true);
  }, []);

  const handleColumnExport = useCallback((col) => {
    const link = document.createElement('a');
    link.href = getColumnDownloadUrl(reportId, col);
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [reportId]);

  const handleConfirmSaveRules = async () => {
    if (!feedName.trim()) { toast.error('Please enter a feed name.'); return; }
    setSavingRules(true);
    try {
      const uiRules = parseReportRules(report.rules || {});
      const name = feedName.trim();
      const { data: feedsRes } = await listSavedRules();
      const existing = (feedsRes?.data || []).find(f => f.feedName === name);
      if (existing) {
        await updateRuleSet(existing._id, { rules: uiRules });
        toast.success(`Feed "${name}" updated successfully!`);
      } else {
        await saveRuleSet({ feedName: name, rules: uiRules });
        toast.success(`Feed "${name}" saved successfully!`);
      }
      setSaveStep(null);
      setFeedName('');
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to save rules.');
    } finally {
      setSavingRules(false);
    }
  };

  if (loading) return <Loader />;
  if (!report) return null;

  // const passRate = totalRows > 0 ? Math.round((passedCount / totalRows) * 100) : 0;
  const passRate = totalColumns > 0 ? Math.round((passingColumns / totalColumns) * 100) : 0;

  return (
    <div className=" h-full bg-[#f1f5f9] py-6 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* ── Page Header ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-[#3F4D67] via-blue-500 to-cyan-400" />
          <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-2">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1 text-sm text-slate-500">
                <Link to="/" className="font-medium text-[#3F4D67] hover:opacity-75 transition-opacity">
                  Upload File
                </Link>
                <span className="text-slate-400 px-1">/</span>
                <span className="text-slate-600 font-medium">Validation Results</span>
              </nav>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Validation Report</h1>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
                  style={passRate === 100 ? { background: '#dcfce7', color: '#15803d', borderColor: '#bbf7d0' } : passRate >= 70 ? { background: '#fef9c3', color: '#a16207', borderColor: '#fde68a' } : { background: '#fee2e2', color: '#b91c1c', borderColor: '#fecaca' }}
                >
                  {passRate}% pass rate
                </span>
              </div>

              {filename && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-fit">
                  <DatabaseIcon size={14} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-600 truncate max-w-sm">{filename}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {report.rules && Object.keys(report.rules).length > 0 && (
                <div className="relative group">
                  <button
                    onClick={() => !rulesUnchanged && setSaveStep('confirm')}
                    disabled={rulesUnchanged}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:border-[#3F4D67] hover:text-[#3F4D67] hover:bg-slate-50 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save Rules
                  </button>
                  {rulesUnchanged && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Rules are unchanged from the imported feed
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3F4D67] text-white text-sm font-semibold shadow hover:bg-[#2e3a50] transition-all"
              >
                <UploadIcon size={15} /> New Validation
              </button>
            </div>
          </div>
        </div>

        {/* ── Column Summary Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Columns */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-slate-100 flex-shrink-0">
              <DatabaseIcon size={20} className="text-slate-500" />
            </div>
            <div>
              {/* old: Total Records — totalRows */}
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Columns</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums leading-tight">{totalColumns.toLocaleString()}</p>
            </div>
          </div>

          {/* QA Pass */}
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm px-6 py-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50 flex-shrink-0">
              <CheckCircleIcon size={20} className="text-emerald-500" />
            </div>
            <div>
              {/* old: Valid Records — passedCount */}
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">QA Pass</p>
              <p className="text-2xl font-black text-emerald-600 tabular-nums leading-tight">{passingColumns.toLocaleString()}</p>
            </div>
          </div>

          {/* QA Fail */}
          <div className={`bg-white rounded-2xl shadow-sm px-6 py-5 flex items-center gap-4 ${failingColumns > 0 ? 'border border-rose-200' : 'border border-slate-200'}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${failingColumns > 0 ? 'bg-rose-50' : 'bg-slate-100'}`}>
              <XCircleIcon size={20} className={failingColumns > 0 ? 'text-rose-500' : 'text-slate-400'} />
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${failingColumns > 0 ? 'text-rose-400' : 'text-slate-400'}`}>QA Fail</p>
              <p className={`text-2xl font-black tabular-nums leading-tight ${failingColumns > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{failingColumns.toLocaleString()}</p>
            </div>
          </div>

          {/* Duplicate Rows */}
          <div className={`bg-white rounded-2xl shadow-sm px-6 py-5 flex items-center gap-4 ${duplicateRowCount > 0 ? 'border border-amber-200' : 'border border-slate-200'}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${duplicateRowCount > 0 ? 'bg-amber-50' : 'bg-slate-100'}`}>
              <CopyIcon size={20} className={duplicateRowCount > 0 ? 'text-amber-500' : 'text-slate-400'} />
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${duplicateRowCount > 0 ? 'text-amber-500' : 'text-slate-400'}`}>Duplicate Rows</p>
              <p className={`text-2xl font-black tabular-nums leading-tight ${duplicateRowCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{duplicateRowCount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* ── QA Report Table ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#3F4D67]/10 flex items-center justify-center">
                <ChartIcon size={16} className="text-[#3F4D67]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Column Validation Summary</h2>
                <p className="text-xs text-slate-400">Per-column QA results and error breakdown</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#3F4D67]/10 text-[#3F4D67]">
              {summary.length > 0 ? `${[...new Set(summary.map(s => s.column || s.col))].length} columns` : '0 columns'}
            </span>
          </div>
          <QAReportTable
            summary={summary}
            rows={rows}
            totalRows={totalRows}
            onViewErrors={handleViewColumnModal}
            onExport={handleColumnExport}
          />
        </div>
      </div>

      <ErrorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        columnName={selectedColumnForModal}
        rows={rows}
        totalRows={totalRows}
      />

      {/* ── Save Rules Modal ── */}
      {saveStep !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#3F4D67] to-slate-400" />
            {saveStep === 'confirm' ? (
              <div className="p-6">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-[#3F4D67]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#3F4D67" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Save Rules as Feed?</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Save the validation rules from this report so you can reuse them on future files.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setSaveStep(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors bg-white cursor-pointer">
                    Cancel
                  </button>
                  <button onClick={() => setSaveStep('name')} className="flex-1 py-2.5 rounded-xl bg-[#3F4D67] hover:bg-[#344057] text-white text-sm font-semibold transition-colors cursor-pointer border-none">
                    Continue →
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="mb-5">
                  <h3 className="text-base font-bold text-slate-800 mb-1">Name This Feed</h3>
                  <p className="text-sm text-slate-500">Enter a descriptive name so you can find these rules later.</p>
                </div>
                <div className="mb-5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Feed Name</label>
                  <input
                    type="text"
                    value={feedName}
                    onChange={e => setFeedName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleConfirmSaveRules()}
                    placeholder="e.g. Product Catalogue Rules"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setSaveStep('confirm')} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors bg-white cursor-pointer">
                    ← Back
                  </button>
                  <button
                    onClick={handleConfirmSaveRules}
                    disabled={!feedName.trim() || savingRules}
                    className="flex-1 py-2.5 rounded-xl bg-[#3F4D67] hover:bg-[#344057] text-white text-sm font-semibold transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingRules ? 'Saving...' : 'Save Feed'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
