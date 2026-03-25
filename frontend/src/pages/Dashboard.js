import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllUploads } from '../services/api';
import { toast } from 'react-toastify';

/* ─── Icons ─── */
function UploadIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}
function ChartIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function FileIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function CheckIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function ArrowRightIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}
function RefreshIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
function ClockIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

/* ─── Helpers ─── */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Stat Card ─── */
function StatCard({ label, value, icon, gradientFrom, gradientTo, iconBg, textColor, borderColor, sub }) {
  return (
    <div className={`card card-hover p-6 relative overflow-hidden`} style={{ borderColor }}>
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`, color: '#fff' }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-3xl font-black leading-none" style={{ color: textColor }}>{value}</div>
          <div className="text-sm font-semibold text-slate-600 mt-1.5">{label}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        </div>
      </div>
      <div
        className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-5"
        style={{ background: gradientTo }}
      />
    </div>
  );
}

/* ─── Quick Start Card ─── */
function QuickCard({ step, title, desc, icon, action, onAction, dotColor }) {
  return (
    <div className="card card-hover p-5 flex gap-4 relative">
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm"
          style={{ background: dotColor || 'linear-gradient(135deg, #1d4ed8, #3b82f6)' }}
        >
          {step}
        </div>
        {step < 3 && (
          <div className="w-0.5 h-8 border-l-2 border-dashed border-blue-200 mt-1" />
        )}
      </div>
      <div className="flex-1 pt-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-blue-600">{icon}</span>
          <div className="text-sm font-bold text-slate-800">{title}</div>
        </div>
        <div className="text-xs text-slate-500 leading-relaxed mb-3">{desc}</div>
        {action && (
          <button
            onClick={onAction}
            className="btn-primary text-xs px-3.5 py-2"
          >
            {action} <ArrowRightIcon size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUploads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await getAllUploads();
      // BUG FIX: backend returns array nested under res.data.data
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setUploads(data);
    } catch (err) {
      if (!silent) toast.error('Failed to load uploads. Is the backend running?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  /* Derived stats — using correct field names from backend */
  const totalUploads = uploads.length;
  // BUG FIX: status field is 'validated' string, there is no report_id on upload
  const totalValidations = uploads.filter(u => u.status === 'validated').length;

  const recent = [...uploads]
    .sort((a, b) => new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0))
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-8">

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-blue-700 rounded-3xl p-8 text-white overflow-hidden relative shadow-xl shadow-blue-900/20">
        {/* Decorative blobs */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 right-24 w-44 h-44 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
        <div className="absolute top-8 -left-10 w-32 h-32 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3.5 py-1 text-xs font-semibold mb-4 tracking-wide backdrop-blur-sm">
            <span className="text-yellow-300">✦</span> Data Quality Assurance Platform
          </div>
          <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-3 tracking-tight">
            Welcome to QA Testing Platform
          </h1>
          <p className="text-base text-white/70 max-w-lg leading-relaxed mb-7">
            Upload your data files, configure validation rules, and instantly detect data quality issues across your datasets.
          </p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => navigate('/upload')}
              className="bg-white text-blue-800 hover:bg-blue-50 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-200 active:scale-95 shadow-lg shadow-black/20 text-sm"
            >
              <UploadIcon size={16} /> Upload New File
            </button>
            <button
              onClick={() => fetchUploads(true)}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/25 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-200 active:scale-95 text-sm backdrop-blur-sm"
            >
              <RefreshIcon size={14} /> {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Uploads"
          value={totalUploads}
          icon={<FileIcon size={22} />}
          gradientFrom="#1d4ed8"
          gradientTo="#3b82f6"
          textColor="#1d4ed8"
          borderColor="#bfdbfe"
          sub="All time"
        />
        <StatCard
          label="Validations Run"
          value={totalValidations}
          icon={<ChartIcon size={22} />}
          gradientFrom="#7c3aed"
          gradientTo="#a78bfa"
          textColor="#6d28d9"
          borderColor="#ddd6fe"
          sub="With validated status"
        />
        <StatCard
          label="Pending Validation"
          value={totalUploads - totalValidations}
          icon={<ClockIcon size={22} />}
          gradientFrom="#d97706"
          gradientTo="#fbbf24"
          textColor="#b45309"
          borderColor="#fde68a"
          sub="Awaiting validation"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

        {/* ── Recent Uploads ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-slate-800">Recent Uploads</h2>
              <p className="text-xs text-slate-400 mt-0.5">Last {recent.length} files uploaded</p>
            </div>
            <button
              onClick={() => fetchUploads(true)}
              className="btn-secondary text-xs px-3.5 py-2"
            >
              <RefreshIcon size={13} /> Refresh
            </button>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-4 flex-col">
                <div className="spinner" />
                <span className="text-slate-400 text-sm font-medium">Loading uploads...</span>
              </div>
            ) : recent.length === 0 ? (
              <div className="text-center py-20 px-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-100 rounded-3xl flex items-center justify-center mx-auto mb-5 text-blue-400">
                  <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-slate-700 mb-2">No uploads yet</h3>
                <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
                  Upload your first CSV or Excel file to get started with data validation.
                </p>
                <button
                  onClick={() => navigate('/upload')}
                  className="btn-primary mx-auto"
                >
                  <UploadIcon size={15} /> Upload Your First File
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-100">
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">File Name</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Upload Date</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Rows</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cols</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((upload) => {
                      // BUG FIX: status is a string 'validated'|'uploaded', no report_id on upload
                      const isValidated = upload.status === 'validated';
                      const ext = (upload.originalName || '').split('.').pop().toLowerCase();
                      const isExcel = ext === 'xlsx' || ext === 'xls';
                      return (
                        <tr key={upload._id} className="hover:bg-blue-50/30 transition-colors border-b border-slate-50">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black ${isExcel ? 'bg-emerald-100 text-emerald-700' : 'bg-green-100 text-green-700'}`}>
                                {ext.toUpperCase() || 'FILE'}
                              </div>
                              <div>
                                {/* BUG FIX: correct field name is originalName */}
                                <div className="font-semibold text-slate-800 text-sm leading-tight truncate max-w-[180px]">
                                  {upload.originalName || 'Unknown'}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {formatFileSize(upload.fileSize)}
                                </div>
                              </div>
                            </div>
                          </td>
                          {/* BUG FIX: correct field name is uploadDate */}
                          <td className="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">
                            {formatDate(upload.uploadDate)}
                          </td>
                          {/* BUG FIX: correct field name is totalRows */}
                          <td className="px-5 py-4 font-semibold text-slate-700 text-sm">
                            {upload.totalRows?.toLocaleString() ?? '—'}
                          </td>
                          <td className="px-5 py-4 text-slate-700 text-sm">
                            {upload.headers?.length ?? '—'}
                          </td>
                          <td className="px-5 py-4">
                            {isValidated ? (
                              <span className="badge-pass">
                                <svg width="9" height="9" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>
                                Validated
                              </span>
                            ) : (
                              <span className="badge-warn">
                                <svg width="9" height="9" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {/* BUG FIX: navigate using upload._id; no report_id; show Re-validate if validated */}
                            <button
                              onClick={() => navigate(`/validate/${upload._id}`)}
                              className={isValidated ? 'btn-secondary text-xs px-3 py-1.5' : 'btn-primary text-xs px-3 py-1.5'}
                            >
                              <ChartIcon size={12} />
                              {isValidated ? 'Re-validate' : 'Validate'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Start Guide ── */}
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-black text-slate-800">Quick Start</h2>
            <p className="text-xs text-slate-400 mt-0.5">Get started in 3 easy steps</p>
          </div>
          <div className="flex flex-col gap-0">
            <QuickCard
              step="1"
              icon={<UploadIcon size={15} />}
              title="Upload Your File"
              desc="Drag & drop a CSV or Excel file. We'll detect headers and row count automatically."
              action="Upload Now"
              onAction={() => navigate('/upload')}
              dotColor="linear-gradient(135deg, #1d4ed8, #3b82f6)"
            />
            <QuickCard
              step="2"
              icon={<ChartIcon size={15} />}
              title="Configure Rules"
              desc="Select columns and define validation rules — data types, ranges, formats, and more."
              dotColor="linear-gradient(135deg, #7c3aed, #a78bfa)"
            />
            <QuickCard
              step="3"
              icon={<CheckIcon size={15} />}
              title="View Results"
              desc="See pass/fail stats, per-row errors, and download a full validation report."
              dotColor="linear-gradient(135deg, #059669, #34d399)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
