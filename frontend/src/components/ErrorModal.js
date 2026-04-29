import React from 'react';
import { CheckCircleIcon, XCircleIcon, XIcon } from '../icon/icon';

export function ErrorModal({ isOpen, onClose, columnName, rows, totalRows }) {
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
              <p className="text-sm text-rose-100 mt-0.5">{columnName}</p>
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
                    {group.values.filter(v => v !== '' && v !== null && v !== undefined).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {group.values.filter(v => v !== '' && v !== null && v !== undefined).map((v, i) => (
                          <span key={i} className="px-2.5 py-0.5 rounded-md text-xs bg-amber-50 text-amber-800 border border-amber-200">{v}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-slate-700 leading-relaxed">{group.message}</p>
                  </div>
                </div>
                <div className="px-5 pb-4">
                  <div className="text-xs text-slate-500 mb-2 font-medium">Affected Rows</div>
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                    {group.rows.map((rowNum, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md text-xs bg-slate-100 text-slate-700 border border-slate-200">{rowNum}</span>
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
