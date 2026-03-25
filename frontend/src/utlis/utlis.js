export function getRateColor(rate) {
  if (rate >= 90) return '#10b981';
  if (rate >= 70) return '#f59e0b';
  return '#ef4444';
}



export const RULE_TYPES = [
  { value: 'has_empty', label: 'Required (No Empty)', desc: 'Field must not be empty', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'data_type', label: 'Data Type', desc: 'Validate the data type', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'data_length', label: 'Data Length', desc: 'Min/max or exact length', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'greater_than', label: 'Greater Than', desc: 'Value must be > threshold', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'less_than', label: 'Less Than', desc: 'Value must be < threshold', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { value: 'in_between', label: 'In Between', desc: 'Value within a range', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { value: 'date_format', label: 'Date Format', desc: 'Validate date format string', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'fix_header', label: 'Fixed Values', desc: 'Only allowed values', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'cell_contains', label: 'Cell Contains', desc: 'Regex pattern match', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'cell_value_start_end_with', label: 'Start/End With', desc: 'Prefix/suffix check', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'data_redundant', label: 'Data Redundancy', desc: 'Duplicate threshold check', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { value: 'not_match_found', label: 'Not Match Found', desc: 'Value must not appear', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'depend_header', label: 'Dependent Column', desc: 'Conditional column rules', color: 'bg-slate-100 text-slate-700 border-slate-200' },
];  



 export  function formatFileSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  }

export const getFileExtension = (name) => name?.split('.').pop().toUpperCase() || '?';  