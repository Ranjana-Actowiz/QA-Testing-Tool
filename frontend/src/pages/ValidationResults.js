import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import DataTable from 'react-data-table-component';
import { getReport, getDownloadUrl, getColumnDownloadUrl } from '../services/api';
import { ChartIcon, CheckCircleIcon, ChevronRightIcon, DatabaseIcon, DownloadIcon, HomeIcon, UploadIcon, XCircleIcon, XIcon, FileSpreadsheetIcon } from '../icon/icon';
import { COLORS } from '../utlis/utlis';
import { Loader } from '../components/Loader';


/* -------------------- Modal Component – displays column rows with VALID / INVALID status ---------------------------- */
function ErrorModal({ isOpen, onClose, columnName, rows, totalRows }) {
  if (!isOpen) return null;

  // Rows that have at least one error for this column (INVALID)
  const invalidRows = rows.filter(row => {
    const errors = row.errors || row.error_details || [];
    if (!Array.isArray(errors)) return false;
    return errors.some(err =>
      typeof err === 'object' && (err.column || err.field) === columnName
    );
  });

  const invalidCount = invalidRows.length;
  const validCount = totalRows - invalidCount;

  // grouping for counts and error details
  const groupedErrors = {};

  invalidRows.forEach(row => {
    const rowNum = row.row_number;
    const errors = row.errors || row.error_details || [];

    errors.forEach(err => {
      if (
        typeof err === 'object' &&
        (err.column || err.field) === columnName
      ) {
        const rule = err.rule || err.rule_type || 'validation';
        const value = (err.value ?? '(empty)').toString();
        const message = err.message || err.error || 'Invalid value';

        // 🔑 group key
        const key = `${rule}__${value}__${message}`;

        if (!groupedErrors[key]) {
          groupedErrors[key] = {
            rule,
            value,
            message,
            rows: [],
            count: 0,
          };
        }

        groupedErrors[key].rows.push(rowNum);
        groupedErrors[key].count += 1;
      }
    });
  });

  // convert to array
  const groupedList = Object.values(groupedErrors);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-rose-50 bg-red-500/80 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <XCircleIcon size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Column Validation Report</h3>
              <p className="text-sm text-rose-100 font-mono mt-0.5 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white/80"></span>
                {columnName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-all duration-200 group"
          >
            <XIcon size={20} className="text-white/90 group-hover:text-white" />
          </button>
        </div>

        {/* Summary Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-6 text-sm">
          <span className="text-slate-500">Total rows: <strong className="text-slate-800">{totalRows}</strong></span>
          <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
            <CheckCircleIcon size={14} className="text-emerald-500" />
            {validCount} Valid
          </span>
          <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
            <XCircleIcon size={14} className="text-rose-500" />
            {invalidCount} Invalid
          </span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
          {/* Valid rows summary card */}
          {validCount > 0 && (
            <div className="bg-white rounded-xl border-l-4 border-emerald-500 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700">
                  <CheckCircleIcon size={16} />
                </div>
                <div>
                  <span className="text-sm font-semibold text-emerald-800">
                    {validCount} row{validCount !== 1 ? 's' : ''} — VALID
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Passed all validation rules for this column</p>
                </div>
                <span className="ml-auto px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                  VALID
                </span>
              </div>
            </div>
          )}

          {/* Invalid rows */}
          {invalidRows.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircleIcon size={28} className="text-emerald-600" />
              </div>
              <p className="text-slate-600 font-medium">No errors found for this column</p>
              <p className="text-slate-400 text-sm mt-1">All validations passed successfully</p>
            </div>
          ) : (
            groupedList
              .sort((a, b) => b.count - a.count)
              .map((group, idx) => {
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                  >
                    {/* Top Section */}
                    <div className="flex items-start gap-4 p-5 border-l-4 border-rose-500 bg-gradient-to-r from-rose-50/40 to-transparent">

                      {/* Icon */}
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-rose-100 text-rose-700 font-bold text-sm">
                        !
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-2">

                        {/* Rule + Value */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-200 text-slate-700 uppercase tracking-wide">
                            {group.rule}
                          </span>

                          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200">
                            {group.value}
                          </span>
                          {/* Count Badge */}
                        <div className="flex items-center gap-2 align-self-end">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                            {group.count} occurrence{group.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        </div>

                        {/* Message */}
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {group.message}
                        </p>

                        
                      </div>
                    </div>

                    {/* Row Numbers Section */}
                    <div className="px-5 pb-4">
                      <div className="text-xs text-slate-500 mb-2 font-medium">
                        Affected Rows
                      </div>

                      <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
                        {group.rows.map((rowNum, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200 hover:bg-rose-50 hover:border-rose-200 transition"
                          >
                            {rowNum}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-between items-center">
          <span className="text-xs text-slate-500">
            {invalidCount} invalid row{invalidCount !== 1 ? 's' : ''} · {validCount} valid row{validCount !== 1 ? 's' : ''}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------  Circular Progress Component ------------------------------------- */
function CircularProgress({ percentage, size = 60, strokeWidth = 6, color }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-slate-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-sm font-bold text-slate-700">{percentage}%</span>
    </div>
  );
}

/* ---------------------------------------------------  StatsPanels – Records + Headers (Enhanced with visual differentiation) ------------------------ */
function StatsPanels({ records, headers }) {
  const recRateColor = records.passRate >= 90 ? COLORS.success[600] : records.passRate >= 70 ? COLORS.warning[600] : COLORS.error[600];
  const hdrRateColor = headers.passRate >= 90 ? COLORS.success[600] : headers.passRate >= 70 ? COLORS.warning[600] : COLORS.error[600];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Records Card - Blue theme */}
      <div className="relative bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden group hover:shadow-xl transition-all duration-300">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-500 to-slate-400"></div>
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl text-blue-600">
              <DatabaseIcon size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Records Summary</h3>
              <p className="text-xs text-slate-500 mt-0.5">Data row validation results</p>
            </div>
          </div>
          <CircularProgress percentage={records.passRate} color={recRateColor} />
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="relative p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Records</span>
              <div className="text-3xl font-black text-slate-800 mt-1 tracking-tight">{records.total.toLocaleString()}</div>
              <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-500"></div>
            </div>

            <div className="relative p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Valid Records</span>
              <div className="text-3xl font-black text-emerald-700 mt-1 tracking-tight">{records.valid.toLocaleString()}</div>
              <CheckCircleIcon size={16} className="absolute top-4 right-4 text-emerald-500" />
            </div>

            <div className="relative p-4 bg-rose-50 rounded-xl border border-rose-100 col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Invalid Records</span>
                  <div className={`text-2xl font-black mt-1 tracking-tight ${records.invalid > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                    {records.invalid.toLocaleString()}
                  </div>
                </div>
                {records.invalid > 0 && (
                  <div className="px-3 py-1.5 rounded-lg bg-rose-100 border border-rose-200">
                    <span className="text-xs font-bold text-rose-700">
                      {Math.round((records.invalid / records.total) * 100)}% of total
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Headers Card - Indigo theme */}
      <div className="relative bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden group hover:shadow-xl transition-all duration-300">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-500 to-slate-400"></div>
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
              <ChartIcon size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Headers Summary</h3>
              <p className="text-xs text-slate-500 mt-0.5">Column validation results</p>
            </div>
          </div>
          <CircularProgress percentage={headers.passRate} color={hdrRateColor} />
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="relative p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Headers</span>
              <div className="text-3xl font-black text-slate-800 mt-1 tracking-tight">{headers.total.toLocaleString()}</div>
              <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-500"></div>
            </div>

            <div className="relative p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Valid Headers</span>
              <div className="text-3xl font-black text-emerald-700 mt-1 tracking-tight">{headers.valid.toLocaleString()}</div>
              <CheckCircleIcon size={16} className="absolute top-4 right-4 text-emerald-500" />
            </div>

            <div className="relative p-4 bg-rose-50 rounded-xl border border-rose-100 col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Invalid Headers</span>
                  <div className={`text-2xl font-black mt-1 tracking-tight ${headers.invalid > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                    {headers.invalid.toLocaleString()}
                  </div>
                </div>
                {headers.invalid > 0 && (
                  <div className="px-3 py-1.5 rounded-lg bg-rose-100 border border-rose-200">
                    <span className="text-xs font-bold text-rose-700">
                      {Math.round((headers.invalid / headers.total) * 100)}% of total
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- Column Rules Table (react-data-table-component) -------------------------------------------- */
const columnTableCustomStyles = {
  headRow: {
    style: {
      backgroundColor: '#f8fafc',
      borderBottom: '1px solid #e2e8f0',
    },
  },
  headCells: {
    style: {
      fontSize: '11px',
      fontWeight: '700',
      color: '#475569',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      paddingLeft: '20px',
      paddingRight: '20px',
    },
  },
  rows: {
    style: {
      fontSize: '13px',
      paddingTop: '4px',
      paddingBottom: '4px',
      borderBottom: '1px solid #f1f5f9',
      '&:hover': { backgroundColor: '#f8fafc' },
    },
  },
  cells: {
    style: {
      paddingLeft: '20px',
      paddingRight: '20px',
    },
  },
};

const ColumnRulesTable = React.memo(function ColumnRulesTable({ summary, onViewColumnModal, onExportColumn }) {
  if (!summary || !Array.isArray(summary) || summary.length === 0) return null;

  const grouped = [];
  const indexMap = {};
  summary.forEach((item) => {
    const col = item.column || item.col || '—';
    const fail = item.failCount ?? item.fail_count ?? item.failed ?? 0;
    const rule = item.rule || item.rule_type || 'validation';
    if (indexMap[col] === undefined) {
      indexMap[col] = grouped.length;
      grouped.push({ col, rules: [{ name: rule, fail }], totalFail: fail });
    } else {
      grouped[indexMap[col]].rules.push({ name: rule, fail });
      grouped[indexMap[col]].totalFail += fail;
    }
  });

  const columns = [
    {
      name: 'No.',
      width: '70px',
      cell: (_, idx) => (
        <span className="text-xs font-mono font-bold text-slate-400">{idx + 1}</span>
      ),
    },
    {
      name: 'Column Name',
      selector: (row) => row.col,
      cell: (row) => (
        <div className="flex items-center gap-3 py-1">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${row.totalFail > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
          <span className="font-semibold text-slate-800 font-mono text-sm">{row.col}</span>
        </div>
      ),
    },
    {
      name: 'Applied Rules',
      grow: 2,
      cell: (row) => (
        <div className="flex flex-wrap gap-1.5 py-2">
          {row.rules.map((rule, i) => (
            <span
              key={i}
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                rule.fail > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {rule.name}
            </span>
          ))}
        </div>
      ),
    },
    {
      name: 'Status',
      selector: (row) => row.totalFail,
      cell: (row) =>
        row.totalFail > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-rose-600 tabular-nums">{row.totalFail.toLocaleString()}</span>
            <span className="text-xs text-rose-500">invalid rows</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircleIcon size={14} />
            <span className="text-sm font-semibold">All Valid</span>
          </div>
        ),
    },
    {
      name: 'Actions',
      right: true,
      cell: (row) => (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => onExportColumn(row.col)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-500 hover:bg-green-600 transition-colors"
          >
            <DownloadIcon size={14} />
            Export
          </button>
          {row.totalFail > 0 && (
            <>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => onViewColumnModal(row.col)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200 transition-colors"
              >
                <XCircleIcon size={14} />
                View Errors
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 bg-[#3f4d67] text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
            <FileSpreadsheetIcon size={20} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Column Validation Summary</h3>
            <p className="text-xs text-slate-400 mt-0.5">Per-column validation results and error distribution</p>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20 backdrop-blur-sm">
          {grouped.length} columns
        </span>
      </div>
      <DataTable
        columns={columns}
        data={grouped}
        customStyles={columnTableCustomStyles}
        pagination
        paginationPerPage={10}
        paginationRowsPerPageOptions={[10, 25, 50]}
        highlightOnHover
        responsive
        noDataComponent={<div className="py-8 text-slate-400 text-sm">No column data available.</div>}
      />
    </div>
  );
});

/* -------------------------------------------- Main Component – ValidationResults (Enhanced Layout) -------------------------------- */
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
  const passedCount = report?.passedRows ?? report?.passed_rows ??  rows.filter(r => r.status === 'pass' || r.passed === true).length;
  const failedCount = report?.failedRows ?? report?.failed_rows ?? rows.filter(r => r.status === 'fail' || r.passed === false).length;
  const passRate = totalRows > 0 ? Math.round((passedCount / totalRows) * 100) : 0;

  const summary = report?.summary || [];
  const filename = report?.originalName || report?.uploadId?.originalName || report?.filename || '';

  const headerStats = useMemo(() => {
    const colFails = {};
    summary.forEach((item) => {
      const col = item.column || item.col || '—';
      const fail = item.failCount ?? item.fail_count ?? item.failed ?? 0;
      colFails[col] = (colFails[col] || 0) + fail;
    });
    const total = Object.keys(colFails).length;
    const invalid = Object.values(colFails).filter(f => f > 0).length;
    const valid = total - invalid;
    const passRate = total > 0 ? Math.round((valid / total) * 100) : 100;
    return { total, invalid, valid, passRate };
  }, [summary]);


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

  const closeModal = () => setModalOpen(false);

  if (loading) {
    return (
      <Loader />
    );
  }

  if (!report) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto space-y-8">

        {/* Enhanced Header Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-slate-500">
                <button onClick={() => navigate('/')} className="flex items-center gap-1.5 hover:text-blue-600 transition-colors font-medium">
                  <HomeIcon size={14} />
                  Upload
                </button>
                <ChevronRightIcon size={14} className="text-slate-400" />
                <span className="text-blue-600 font-semibold flex items-center gap-1.5">
                  <ChartIcon size={14} />
                  Validation Results
                </span>
              </nav>

              <div className="flex items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Validation Report</h1>
                {passRate === 100 ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircleIcon size={12} />
                    Perfect Score
                  </span>
                ) : passRate >= 90 ? (
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">
                    Good
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
                    Needs Attention
                  </span>
                )}
              </div>

              {filename && (
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 w-fit">
                  <DatabaseIcon size={16} className="text-blue-500" />
                  <span className="font-medium text-sm truncate max-w-md">{filename}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={getDownloadUrl(reportId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-slate-700 text-sm font-bold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 shadow-sm"
              >
                <DownloadIcon size={16} />
                Download Report
              </a>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3F4D67] text-white text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
              >
                <UploadIcon size={16} />
                New Validation
              </button>
            </div>
          </div>
        </div>

        {/* Stats Panels */}
        <StatsPanels
          records={{ total: totalRows, invalid: failedCount, valid: passedCount, passRate }}
          headers={headerStats}
        />

        {/* Column Rules Table */}
        <ColumnRulesTable
          summary={summary}
          reportId={reportId}
          rows={rows}
          onViewColumnModal={handleViewColumnModal}
          onExportColumn={handleColumnExport}
        />
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={modalOpen}
        onClose={closeModal}
        columnName={selectedColumnForModal}
        rows={rows}
        totalRows={totalRows}
      />
    </div>
  );
}