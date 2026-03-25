import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getReport, getDownloadUrl } from '../services/api';
import { ChartIcon, CheckCircleIcon, ChevronDownIcon, DatabaseIcon, DownloadIcon, HomeIcon, SearchIcon, UploadIcon, XCircleIcon } from '../icon/icon';



/* Helpers */
function getRateColor(rate) {
  if (rate >= 90) return '#10b981';
  if (rate >= 70) return '#f59e0b';
  return '#ef4444';
}

function RateBar({ value, max = 100 }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = getRateColor(pct);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold min-w-[36px]" style={{ color }}>{pct}%</span>
    </div>
  );
}

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0];
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xl text-sm">
        <strong style={{ color: payload[0].payload.color }}>{name}</strong>
        <div className="mt-1 text-slate-700 font-semibold">{value.toLocaleString()} rows</div>
      </div>
    );
  }
  return null;
};

/* Pass Rate Ring (SVG circle) */
function PassRateRing({ rate }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;
  const color = getRateColor(rate);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
      <circle cx="36" cy="36" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={radius} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dashoffset 0.7s ease' }}
      />
      <text x="36" y="36" textAnchor="middle" dy="0.35em" fontSize="11" fontWeight="800" fill={color}>{rate}%</text>
    </svg>
  );
}

/* Summary Stat Card */
function SummaryCard({ label, value, sub, colorCls, bgGradient, borderColor, icon, passRate }) {
  return (
    <div className="card card-hover p-5 relative overflow-hidden" style={{ borderColor }}>
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: bgGradient, color: '#fff' }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-2xl font-black ${colorCls} leading-none`}>{value}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">{label}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        </div>
        {passRate !== undefined && (
          <PassRateRing rate={passRate} />
        )}
      </div>
    </div>
  );
}

/* Expandable Result Row */
function ResultRow({ rowData, rowNum }) {
  const [expanded, setExpanded] = useState(false);
  const isPassed = rowData.status === 'pass' || rowData.passed === true;
  const errors = rowData.errors || rowData.error_details || [];
  const errorCount = Array.isArray(errors) ? errors.length : 0;

  return (
    <>
      <tr className={`border-b border-slate-100 transition-colors ${expanded ? 'bg-red-50/40' : isPassed ? 'hover:bg-emerald-50/20' : 'hover:bg-red-50/20'}`}>
        <td className="px-5 py-3">
          <span className="text-xs font-bold text-slate-400 tabular-nums">#{rowNum}</span>
        </td>
        <td className="px-5 py-3">
          {isPassed ? (
            <span className="badge-pass">
              <CheckCircleIcon size={11} /> Pass
            </span>
          ) : (
            <span className="badge-fail">
              <XCircleIcon size={11} /> Fail
            </span>
          )}
        </td>
        <td className="px-5 py-3">
          {isPassed ? (
            <span className="text-xs text-slate-400 italic">All checks passed</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {Array.isArray(errors) && errors.slice(0, 3).map((err, i) => {
                const msg = typeof err === 'string' ? err : (err.message || err.error || JSON.stringify(err));
                const col = typeof err === 'object' ? (err.column || err.field || '') : '';
                return (
                  <span key={i} className="bg-red-50 border border-red-200 rounded-lg px-2 py-0.5 text-xs text-red-800 max-w-[200px] truncate">
                    {col ? <strong>{col}: </strong> : ''}{msg}
                  </span>
                );
              })}
              {errorCount > 3 && (
                <span className="badge-fail text-[10px]">+{errorCount - 3} more</span>
              )}
            </div>
          )}
        </td>
        <td className="px-5 py-3">
          {!isPassed && errorCount > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="btn-secondary text-xs px-2.5 py-1.5"
            >
              <span className={`inline-flex transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                <ChevronDownIcon size={11} />
              </span>
              {expanded ? 'Hide' : 'Details'}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-red-50/50">
          <td colSpan={4} className="px-6 py-4">
            <div className="text-xs font-bold text-red-700 mb-3 flex items-center gap-1.5">
              <XCircleIcon size={13} />
              Error Details for Row {rowNum}:
            </div>
            <div className="flex flex-col gap-2">
              {Array.isArray(errors) ? errors.map((err, i) => {
                const msg = typeof err === 'string' ? err : (err.message || err.error || JSON.stringify(err));
                const col = typeof err === 'object' ? (err.column || err.field || '') : '';
                const rule = typeof err === 'object' ? (err.rule || err.rule_type || '') : '';
                return (
                  <div key={i} className="bg-white border border-red-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-red-800 shadow-sm">
                    <XCircleIcon size={13} />
                    <div className="flex-1">
                      {col && <strong className="mr-1.5 text-red-900">[{col}]</strong>}
                      {rule && <em className="mr-1.5 text-red-600 not-italic font-semibold">{rule}:</em>}
                      {msg}
                    </div>
                  </div>
                );
              }) : (
                <div className="text-xs text-red-800">{typeof errors === 'string' ? errors : JSON.stringify(errors)}</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* Per-Column Summary — groups multiple rules for the same column into one row */
function ColumnSummaryTable({ summary }) {
  if (!summary || !Array.isArray(summary) || summary.length === 0) return null;

  // Group by column name, preserving order of first appearance
  const grouped = [];
  const indexMap = {};
  summary.forEach((item) => {
    const col = item.column || item.col || '—';
    const pass = item.passCount ?? item.pass_count ?? item.passed ?? 0;
    const fail = item.failCount ?? item.fail_count ?? item.failed ?? 0;
    const rule = item.rule || item.rule_type || 'validation';
    if (indexMap[col] === undefined) {
      indexMap[col] = grouped.length;
      grouped.push({ col, rules: [{ rule, pass, fail }] });
    } else {
      grouped[indexMap[col]].rules.push({ rule, pass, fail });
    }
  });

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-100 flex items-center gap-2">
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-blue-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <h3 className="text-sm font-bold text-slate-700">Validation Rules Summary</h3>
        <span className="ml-auto badge-info">{summary.length} rule{summary.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-100">
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-40">Column</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Rule</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Passes</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Fails</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[160px]">Pass Rate</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((group, gIdx) => {
              const totalPass = group.rules.reduce((s, r) => s + r.pass, 0);
              const totalFail = group.rules.reduce((s, r) => s + r.fail, 0);
              const total = totalPass + totalFail;
              const passRate = total > 0 ? Math.round((totalPass / total) * 100) : 100;
              return (
                <tr key={gIdx} className="border-b border-slate-100 hover:bg-blue-50/20 transition-colors">
                  <td className="px-5 py-3 font-semibold text-xs text-slate-700 align-middle">
                    <span className="border-l-2 border-blue-400 pl-2">{group.col}</span>
                  </td>
                  <td className="px-5 py-3 align-middle">
                    <div className="flex flex-wrap gap-1.5">
                      {group.rules.map((r, i) => (
                        <span key={i} className={`badge-info text-[11px] ${r.fail > 0 ? 'bg-red-50 border-red-200 text-red-700' : ''}`}>
                          {r.rule}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-bold text-emerald-600 text-sm align-middle">{totalPass.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm align-middle">
                    <span className={totalFail > 0 ? 'font-bold text-red-600' : 'text-slate-400'}>{totalFail.toLocaleString()}</span>
                  </td>
                  <td className="px-5 py-3 min-w-[160px] align-middle">
                    <RateBar value={passRate} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Main Component */
export default function ValidationResults() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  //! getting the report data 
  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await getReport(reportId);
        // BUG FIX: report is under res.data.data
        const report = res.data?.data || res.data;
        setReport(report);
      } catch (err) {
        toast.error(err.displayMessage || 'Failed to load report.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [reportId, navigate]);

  /* Derived data —  use correct field names from backend */
  const rows = useMemo(() => {
    if (!report) return [];
    return report.results || report.rows || report.data || [];
  }, [report]);

  // BUG FIX: correct field names: totalRows, passedRows, failedRows
  const totalRows = report?.totalRows ?? report?.total_rows ?? rows.length;
  const passedCount = report?.passedRows ?? report?.passed_rows ??
    rows.filter(r => r.status === 'pass' || r.passed === true).length;
  const failedCount = report?.failedRows ?? report?.failed_rows ?? rows.filter(r => r.status === 'fail' || r.passed === false).length;
  const passRate = totalRows > 0 ? Math.round((passedCount / totalRows) * 100) : 0;

  // BUG FIX: report.summary is the per-column array; report.uploadId?.originalName for filename
  const summary = report?.summary || [];
  const filename = report?.uploadId?.originalName || report?.filename || '';

  // Derived summary stats
  const uniqueColumns = useMemo(() => new Set(summary.map(s => s.column)).size, [summary]);
  const uniqueRules = useMemo(() => new Set(summary.map(s => s.rule)).size, [summary]);
  const totalErrors = useMemo(() => summary.reduce((acc, s) => acc + (s.failCount ?? s.fail_count ?? 0), 0), [summary]);

  // Per-column pass rate for summary chart (group by column)
  const columnPassRates = useMemo(() => {
    const map = {};
    summary.forEach(s => {
      const col = s.column || '—';
      const pass = s.passCount ?? s.pass_count ?? 0;
      const fail = s.failCount ?? s.fail_count ?? 0;
      if (!map[col]) map[col] = { pass: 0, fail: 0 };
      map[col].pass += pass;
      map[col].fail += fail;
    });
    return Object.entries(map)
      .filter(([, { fail }]) => fail > 0)          // only columns with failures
      .map(([col, { pass, fail }]) => {
        const total = pass + fail;
        return { col, pass, fail, rate: total > 0 ? Math.round((pass / total) * 100) : 0 };
      })
      .sort((a, b) => a.rate - b.rate);             // worst first
  }, [summary]);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const isPassed = row.status === 'pass' || row.passed === true;
      if (filter === 'pass' && !isPassed) return false;
      if (filter === 'fail' && isPassed) return false;
      if (search) {
        const rowIdx = String(row.row_number ?? row.row ?? row.index ?? '');
        const errStr = JSON.stringify(row.errors || row.error_details || '').toLowerCase();
        const s = search.toLowerCase();
        if (!rowIdx.includes(s) && !errStr.includes(s)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = useCallback((f) => { setFilter(f); setPage(1); }, []);
  const handleSearch = useCallback((e) => { setSearch(e.target.value); setPage(1); }, []);

  const pieData = [
    { name: 'Passed', value: passedCount, color: '#10b981' },
    { name: 'Failed', value: failedCount, color: '#ef4444' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 flex-col gap-4">
        <div className="spinner" />
        <span className="text-slate-500 text-sm font-medium">Loading validation report...</span>
      </div>
    );
  }

  if (!report) return null;

  const passRateGradient =
    passRate >= 90 ? 'linear-gradient(135deg, #059669, #34d399)' :
      passRate >= 70 ? 'linear-gradient(135deg, #d97706, #fbbf24)' :
        'linear-gradient(135deg, #dc2626, #f87171)';
  const passRateColor =
    passRate >= 90 ? 'text-emerald-700' :
      passRate >= 70 ? 'text-amber-700' : 'text-red-700';
  const passRateBorder =
    passRate >= 90 ? '#a7f3d0' :
      passRate >= 70 ? '#fde68a' : '#fecaca';

  return (
    <div className="flex flex-col gap-6 px-6 pt-6 pb-2  ">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4 px-3">
        <div>
          <div className="flex items-center gap-1.5 mb-3 text-xs">
            <button onClick={() => navigate('/')} className="text-slate-400 hover:text-blue-600 transition-colors bg-transparent border-none cursor-pointer p-0 font-medium flex items-center gap-1">
              <HomeIcon size={12} /> Dashboard
            </button>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-slate-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-blue-600 font-semibold">Validation Results</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800">Validation Report</h1>
          <p className="text-slate-500 text-sm mt-1">
            {/* <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{reportId}</span> */}
            {filename && <> &middot; <span className="font-semibold text-slate-700">{filename}</span></>}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <a
            href={getDownloadUrl(reportId)}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary no-underline"
          >
            <DownloadIcon size={14} /> Download Report
          </a>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            <UploadIcon size={14} /> New Validation
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Rows"
          value={totalRows.toLocaleString()}
          sub="Processed"
          colorCls="text-blue-800"
          bgGradient="linear-gradient(135deg, #1d4ed8, #3b82f6)"
          borderColor="#bfdbfe"
          icon={<DatabaseIcon size={18} />}
        />
        <SummaryCard
          label="Rows Passed"
          value={passedCount.toLocaleString()}
          sub={`${passRate}% of total`}
          colorCls={passedCount > 0 ? 'text-emerald-700' : 'text-slate-400'}
          bgGradient={passedCount > 0 ? 'linear-gradient(135deg, #059669, #34d399)' : 'linear-gradient(135deg, #94a3b8, #cbd5e1)'}
          borderColor={passedCount > 0 ? '#a7f3d0' : '#e2e8f0'}
          icon={<CheckCircleIcon size={18} />}
        />
        <SummaryCard
          label="Rows Failed"
          value={failedCount.toLocaleString()}
          sub={`${100 - passRate}% of total`}
          colorCls={failedCount > 0 ? 'text-red-700' : 'text-emerald-700'}
          bgGradient={failedCount > 0 ? 'linear-gradient(135deg, #dc2626, #f87171)' : 'linear-gradient(135deg, #059669, #34d399)'}
          borderColor={failedCount > 0 ? '#fecaca' : '#a7f3d0'}
          icon={<XCircleIcon size={18} />}
        />
        <SummaryCard
          label="Pass Rate"
          value={`${passRate}%`}
          sub={passRate >= 90 ? 'Excellent quality' : passRate >= 70 ? 'Acceptable' : 'Needs attention'}
          colorCls={passRateColor}
          bgGradient={passRateGradient}
          borderColor={passRateBorder}
          icon={<ChartIcon size={18} />}
          passRate={passRate}
        />
      </div>

      {/* Chart + stats row */}
      {/* <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
        <div className="card p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            <h3 className="text-sm font-bold text-slate-700">Pass / Fail Distribution</h3>
          </div>
          {totalRows > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={58}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={10}
                  formatter={(value, entry) => (
                    <span className="text-xs font-semibold text-slate-700">
                      {value} ({entry.payload.value.toLocaleString()})
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-slate-400 text-sm py-10">No data to display</div>
          )}
        </div>

        <div className="card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            <h3 className="text-sm font-bold text-slate-700">Validation Summary</h3>
          </div> */}


          {/* 4 stat chips */}
          {/* <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Passed Rows', value: passedCount, gradient: 'from-emerald-50 to-green-50', border: '#a7f3d0', text: 'text-emerald-700' },
              { label: 'Failed Rows', value: failedCount, gradient: 'from-red-50 to-rose-50', border: '#fecaca', text: failedCount > 0 ? 'text-red-600' : 'text-slate-400' },
              { label: 'Columns Checked', value: uniqueColumns, gradient: 'from-blue-50 to-indigo-50', border: '#bfdbfe', text: 'text-blue-700' },
              { label: 'Rule Types', value: uniqueRules, gradient: 'from-purple-50 to-violet-50', border: '#ddd6fe', text: 'text-purple-700' },
            ].map(({ label, value, gradient, border, text }) => (
              <div key={label} className={`bg-gradient-to-br ${gradient} border rounded-xl p-3 text-center`} style={{ borderColor: border }}>
                <div className={`text-xl font-black leading-none ${text}`}>{value.toLocaleString()}</div>
                <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div> */}

          {/* Per-column pass rate breakdown */}
          {/* {columnPassRates.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Failing Columns</div>
              <div className="flex flex-col gap-2">
                {columnPassRates.map(({ col, pass, fail, rate }) => (
                  <div key={col}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-slate-700 truncate max-w-[55%]">{col}</span>
                      <span className="text-[11px] text-slate-500 flex-shrink-0">
                        <span className="text-emerald-600 font-bold">{pass}</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className={fail > 0 ? 'text-red-500 font-bold' : 'text-slate-400'}>{fail} fail</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${rate}%`, background: getRateColor(rate) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )} */}

          {/* Total errors chip */}
          {/* {totalErrors > 0 && (
            <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
              <span className="text-xs font-semibold text-red-700">Total Rule Violations</span>
              <span className="text-sm font-black text-red-600">{totalErrors.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div> */}

      {/* Per-column summary */}
      <ColumnSummaryTable summary={summary} />

      {/* Row results table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Row-by-Row Results</h3>
            <p className="text-xs text-slate-400 mt-0.5">{filteredRows.length.toLocaleString()} rows shown</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Filter tabs */}
            <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
              {[
                { val: 'all', label: `All (${rows.length})` },
                { val: 'pass', label: `Passed (${passedCount})` },
                { val: 'fail', label: `Failed (${failedCount})` },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => handleFilterChange(val)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 ${filter === val
                      ? val === 'fail'
                        ? 'bg-red-600 text-white shadow-sm'
                        : val === 'pass'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon size={12} />
              </div>
              <input
                type="text"
                value={search}
                onChange={handleSearch}
                placeholder="Search row / error..."
                className="pl-8 pr-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48 bg-white"
              />
            </div>
          </div>
        </div>

        {pagedRows.length === 0 ? (
          failedCount === 0 && rows.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-400">
                <CheckCircleIcon size={28} />
              </div>
              <p className="text-emerald-600 font-bold text-sm">All {totalRows.toLocaleString()} rows passed validation!</p>
              <p className="text-slate-400 text-xs mt-1">No errors found — only failing rows are stored for review.</p>
            </div>
          ) : filter === 'pass' ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-400">
                <CheckCircleIcon size={28} />
              </div>
              <p className="text-emerald-700 font-bold text-sm">{passedCount.toLocaleString()} rows passed validation</p>
              <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
                Passed rows are not stored individually — only failing rows are saved to keep report sizes manageable.
              </p>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-sm">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-300">
                <SearchIcon size={22} />
              </div>
              No rows match the current filter.
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Row</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24"></th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, i) => {
                  const rowNum = row.row_number ?? row.row ?? row.index ?? ((page - 1) * PAGE_SIZE + i + 1);
                  return <ResultRow key={i} rowData={row} rowNum={rowNum} />;
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3 bg-slate-50/50">
            <span className="text-xs text-slate-500 font-medium">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              <span className="text-slate-400"> ({filteredRows.length.toLocaleString()} rows)</span>
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &larr; Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs font-bold rounded-lg transition-all ${p === page
                        ? 'bg-blue-700 text-white shadow-sm'
                        : 'bg-white hover:bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New validation CTA */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => navigate('/')}
          className="btn-primary py-3 px-8 text-base"
        >
          <UploadIcon size={17} /> Start New Validation
        </button>
      </div>
    </div>
  );
}
