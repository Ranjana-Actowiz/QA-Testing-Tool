import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getReport, getDownloadUrl, getColumnDownloadUrl } from '../services/api';
import { ChartIcon, CheckCircleIcon, ChevronRightIcon, DatabaseIcon, DownloadIcon, HomeIcon, UploadIcon, XCircleIcon, XIcon } from '../icon/icon';
import { Loader } from '../components/Loader';

/* ------------------------------------------------------------------ ErrorModal ------------------------------------------------------------------ */
function ErrorModal({ isOpen, onClose, columnName, rows, totalRows }) {
  if (!isOpen) return null;
  const invalidRows = rows.filter(row => {
    const errors = row.errors || row.error_details || [];
    if (!Array.isArray(errors)) return false;
    return errors.some(err => typeof err === 'object' && (err.column || err.field) === columnName);
  });

  const invalidCount = invalidRows.length;
  const validCount = totalRows - invalidCount;

  const groupedErrors = {};
  invalidRows.forEach(row => {
    const rowNum = row.row_number;
    const errors = row.errors || row.error_details || [];
    errors.forEach(err => {
      if (typeof err === 'object' && (err.column || err.field) === columnName) {
        const rule = err.rule || err.rule_type || 'validation';
        const value = (err.value ?? '(empty)').toString();
        const rawMessage = err.message || err.error || 'Invalid value';
        const message = rawMessage.replace(/\.\s*Got:\s*"[^"]*"\.?$/, '');
        const key = rule;
        if (!groupedErrors[key]) {
          groupedErrors[key] = { rule, values: [], _valueSet: new Set(), message, rows: [], count: 0 };
        }
        if (!groupedErrors[key]._valueSet.has(value)) {
          groupedErrors[key].values.push(value);
          groupedErrors[key]._valueSet.add(value);
        }
        groupedErrors[key].rows.push(rowNum);
        groupedErrors[key].count += 1;
      }
    });
  });

  const groupedList = Object.values(groupedErrors);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-200" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-rose-50 bg-[#3f4d67] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg"><XCircleIcon size={20} className="text-white" /></div>
            <div>
              <h3 className="text-lg font-bold text-white">Column Validation Report</h3>
              <p className="text-sm text-rose-100 font-mono mt-0.5">{columnName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-all">
            <XIcon size={20} className="text-white/90" />
          </button>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-6 text-sm">
          <span className="text-slate-500">Total rows: <strong className="text-slate-800">{totalRows}</strong></span>
          <span className="flex items-center gap-1.5 text-emerald-700 font-semibold"><CheckCircleIcon size={14} className="text-emerald-500" />{validCount} Valid</span>
          <span className="flex items-center gap-1.5 text-rose-700 font-semibold"><XCircleIcon size={14} className="text-rose-500" />{invalidCount} Invalid</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
          {validCount > 0 && (
            <div className="bg-white rounded-xl border-l-4 border-emerald-500 shadow-sm px-5 py-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700"><CheckCircleIcon size={16} /></div>
              <span className="text-sm font-semibold text-emerald-800">{validCount} row{validCount !== 1 ? 's' : ''} — VALID</span>
            </div>
          )}
          {groupedList.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3"><CheckCircleIcon size={28} className="text-emerald-600" /></div>
              <p className="text-slate-600 font-medium">No errors found for this column</p>
            </div>
          ) : (
            groupedList.sort((a, b) => b.count - a.count).map((group, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-start gap-4 p-5 border-l-4 border-rose-500 bg-gradient-to-r from-rose-50/40 to-transparent">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-rose-100 text-rose-700 font-bold text-sm">!</div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-200 text-slate-700 uppercase">{group.rule}</span>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">{group.count} occurrence{group.count !== 1 ? 's' : ''}</span>
                    </div>
                    {group.values.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {group.values.map((v, i) => <span key={i} className="px-2.5 py-0.5 rounded-md text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200">{v}</span>)}
                      </div>
                    )}
                    <p className="text-sm text-slate-700 leading-relaxed">{group.message}</p>
                  </div>
                </div>
                <div className="px-5 pb-4">
                  <div className="text-xs text-slate-500 mb-2 font-medium">Affected Rows</div>
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                    {group.rows.map((rowNum, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">{rowNum}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-between items-center">
          <span className="text-xs text-slate-500">{invalidCount} invalid · {validCount} valid</span>
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#3f4d67] text-white hover:bg-[#0A1935] transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ QA Report Table ------------------------------------------------------------------ */
const TABLE_HEADER_BG = '#2c4a6e';

const QAReportTable = React.memo(function QAReportTable({ summary, rows, totalRows, onViewErrors, onExport }) {
  if (!summary || !Array.isArray(summary) || summary.length === 0) return null;

  // Build per-column data from summary + rows
  const columnOrder = [];
  const colMap = {};

  summary.forEach(item => {
    const col = item.column || item.col || '—';
    const rule = item.rule || 'validation';
    const failCount = item.failCount ?? item.fail_count ?? 0;
    const passCount = item.passCount ?? item.pass_count ?? 0;

    if (!colMap[col]) {
      columnOrder.push(col);
      colMap[col] = { name: col, rules: [], blankRows: 0, hasEmptyRule: false };
    }

    colMap[col].rules.push({ rule, failCount, passCount });

    if (rule === 'has_empty') {
      colMap[col].hasEmptyRule = true;
      colMap[col].blankRows = failCount;
    }
  });

  // Compute per-column AND per-rule fail row IDs from the results array
  const colFailData = {};
  columnOrder.forEach(col => { colFailData[col] = { failRowIds: [], byRule: {} }; });

  rows.forEach(row => {
    const errors = row.errors || row.error_details || [];
    if (!Array.isArray(errors)) return;
    const seenColRule = new Set();
    const seenCol = new Set();
    errors.forEach(err => {
      if (typeof err !== 'object') return;
      const col = err.column || err.field;
      const rule = err.rule || 'validation';
      if (!col || !colFailData[col]) return;

      // per-column (unique rows)
      if (!seenCol.has(col)) {
        seenCol.add(col);
        colFailData[col].failRowIds.push(row.row_number);
      }
      // per-rule (unique rows per rule)
      const ruleKey = `${col}::${rule}`;
      if (!seenColRule.has(ruleKey)) {
        seenColRule.add(ruleKey);
        if (!colFailData[col].byRule[rule]) colFailData[col].byRule[rule] = [];
        colFailData[col].byRule[rule].push(row.row_number);
      }
    });
  });

  // Build table data for rendering + export
  const tableData = columnOrder.map((col, idx) => {
    const data = colMap[col];
    const failRowIds = colFailData[col]?.failRowIds || [];
    const byRule = colFailData[col]?.byRule || {};
    const qcFail = failRowIds.length;
    const qcPass = totalRows - qcFail;
    const failPct = totalRows > 0 ? ((qcFail / totalRows) * 100).toFixed(2) : '0.00';
    const reasons = data.rules.map(r => r.rule);
    const blankRows = data.hasEmptyRule ? data.blankRows : null;
    const isPass = qcFail === 0;

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
      allRowIds: failRowIds,
      sampleRowIds: failRowIds.slice(0, 3),
      hasMoreRowIds: failRowIds.length > 3,
      rules: data.rules,        // full rule list with failCount
      byRule,                   // { rule -> [rowIds] } used for TXT export
    };
  });

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
  // ! Export a single column's errors as TXT (used for per-row "Export" button)
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

  return (
    <div>
      {/* Export All bar */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <p className="text-xs text-slate-400">
          {tableData.filter(r => !r.isPass).length} column{tableData.filter(r => !r.isPass).length !== 1 ? 's' : ''} with failures
        </p>
        <button onClick={handleExportAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#3F4D67] hover:bg-[#2e3a50] transition-colors shadow-sm"
        >
          <DownloadIcon size={13} />
          Export All as TXT
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: TABLE_HEADER_BG }}>
              {['ID', 'Headers', 'Total', 'QC Pass', 'QC Fail', 'Blank Rows', 'Reasons', 'Unique %', 'Status', 'QC Fail %', 'No. of Row ID', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider whitespace-nowrap border-r border-white/10 last:border-r-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => (
              <tr key={row.col} className="border-b border-slate-200 hover:brightness-95 transition-all">
                {/* ID */}
                <td className="px-4 py-2.5 text-slate-500 font-mono text-xs font-semibold">{row.id}</td>
                {/* Headers */}
                <td className="px-4 py-2.5 font-semibold text-slate-800 font-mono whitespace-nowrap">{row.col}</td>
                {/* Total */}
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{row.total.toLocaleString()}</td>
                {/* QC Pass */}
                <td className="px-4 py-2.5 text-emerald-700 font-semibold tabular-nums">{row.qcPass.toLocaleString()}</td>
                {/* QC Fail */}
                <td className="px-4 py-2.5 font-semibold tabular-nums" style={{ color: row.qcFail > 0 ? '#dc2626' : '#64748b' }}>
                  {row.qcFail.toLocaleString()}
                </td>
                {/* Blank Rows */}
                <td className="px-4 py-2.5 text-slate-500 tabular-nums">
                  {row.blankRows !== null ? row.blankRows.toLocaleString() : <span className="text-slate-300">-</span>}
                </td>
                {/* Reasons */}
                <td className="px-4 py-2.5 text-slate-600 text-xs max-w-[200px]"> {row.reasons.length > 0 ? <span>[{row.reasons.join(', ')}]</span> : <span className="text-slate-300">-</span>}
                </td>
                {/* Unique % */}
                <td className="px-4 py-2.5 text-slate-400 text-xs">
                  <span className="text-slate-300">-</span>
                </td>
                {/* Status */}
                <td className="px-4 py-2.5">
                  <span className="inline-block px-2.5 py-1 rounded text-xs font-bold text-white whitespace-nowrap" style={{ backgroundColor: row.isPass ? '#16a34a' : '#dc2626' }}   >
                    {row.isPass ? 'QA Pass' : 'QA Fail'}
                  </span>
                </td>
                {/* QC Fail % */}
                <td className="px-4 py-2.5 tabular-nums font-mono text-xs" style={{ color: row.qcFail > 0 ? '#dc2626' : '#64748b' }}>
                  {row.failPct}
                </td>
                {/* No. of Row ID */}
                <td className="px-4 py-2.5 font-mono text-xs text-slate-600 max-w-[180px]">
                  {row.sampleRowIds.length > 0 ? <span>[{row.sampleRowIds.join(', ')}{row.hasMoreRowIds ? '...' : ''}]</span> : <span className="text-slate-300">[]</span>}
                </td>
                {/* Actions */}
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
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const filterInitialized = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedColumnForModal, setSelectedColumnForModal] = useState('');

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
  const passedCount = report?.passedRows ?? report?.passed_rows ?? rows.filter(r => r.status === 'pass' || r.passed === true).length;
  const failedCount = report?.failedRows ?? report?.failed_rows ?? rows.filter(r => r.status === 'fail' || r.passed === false).length;
  const summary = report?.summary || [];
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

  if (loading) return <Loader />;
  if (!report) return null;

  const passRate = totalRows > 0 ? Math.round((passedCount / totalRows) * 100) : 0;

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
              <nav className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <button onClick={() => navigate('/')} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                  <HomeIcon size={13} /> Upload
                </button>
                <ChevronRightIcon size={12} className="text-slate-300" />
                <span className="text-[#3F4D67] font-semibold flex items-center gap-1">
                  <ChartIcon size={13} /> Validation Results
                </span>
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
              {/* <a
                href={getDownloadUrl(reportId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
              >
                <DownloadIcon size={15} /> Download Report
              </a> */}
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3F4D67] text-white text-sm font-semibold shadow hover:bg-[#2e3a50] transition-all"
              >
                <UploadIcon size={15} /> New Validation
              </button>
            </div>
          </div>
        </div>

        {/* ── Records Summary ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-slate-100 flex-shrink-0">
              <DatabaseIcon size={20} className="text-slate-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Records</p>
              <p className="text-2xl font-black text-slate-800 tabular-nums leading-tight">{totalRows.toLocaleString()}</p>
            </div>
          </div>

          {/* Valid */}
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm px-6 py-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-50 flex-shrink-0">
              <CheckCircleIcon size={20} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Valid Records</p>
              <p className="text-2xl font-black text-emerald-600 tabular-nums leading-tight">{passedCount.toLocaleString()}</p>
            </div>
          </div>

          {/* Invalid */}
          <div className={`bg-white rounded-2xl shadow-sm px-6 py-5 flex items-center gap-4 ${failedCount > 0 ? 'border border-rose-200' : 'border border-slate-200'}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${failedCount > 0 ? 'bg-rose-50' : 'bg-slate-100'}`}>
              <XCircleIcon size={20} className={failedCount > 0 ? 'text-rose-500' : 'text-slate-400'} />
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>Invalid Records</p>
              <p className={`text-2xl font-black tabular-nums leading-tight ${failedCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{failedCount.toLocaleString()}</p>
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
    </div>
  );
}
