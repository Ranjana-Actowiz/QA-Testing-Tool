export function getRateColor(rate) {
  if (rate >= 90) return '#10b981';
  if (rate >= 70) return '#f59e0b';
  return '#ef4444';
}

export function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}


export const RULE_TYPES = [
  { value: 'has_empty', label: 'Required', desc: 'Checks whether the field is required or can be left empty', color: 'bg-red-100 text-red-700 border-red-200' },
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

export const modeOpts = [
  { value: 'range', label: 'Min / Max Range' }, { value: 'fix_length', label: 'Exact Length' },
];

export const opts = [
  { value: 'str', label: 'String (str)' }, { value: 'int', label: 'Integer (int)' },
  { value: 'float', label: 'Float / Decimal' }, { value: 'bool', label: 'Boolean (bool)' },
  { value: 'date', label: 'Date' },
];


export const matchOpts = [
  { value: 'true', label: 'Must match (contains pattern)' },
  { value: 'false', label: 'Must NOT match' },
];


export const COND_OPTIONS = [
  { value: 'not_empty', label: 'Not Empty' },
  { value: 'empty', label: 'Empty' },
  { value: 'equals', label: 'Equals Value' },
];
export const getFileExtension = (name) => name?.split('.').pop().toUpperCase() || '?';

// ── Shared rule-reuse helpers ────────────────────────────────────────────────

const _KNOWN_COND = ['not_empty', 'empty'];

// ─── parseDateInput ──────────────────────────────────────────────────────────
// Accepts either a sample date (e.g. "22-10-2025") OR a moment format token
// string (e.g. "DD-MM-YYYY"). Returns { format, error }: `format` is the
// detected moment format string, ready to send to the backend as-is.
// Ambiguous hyphenated dates resolve to DD-MM-YYYY.

// const _SUPPORTED_FORMATS = [
//   'YYYY-MM-DDTHH:mm:ss.SSSZ',
//   'YYYY-MM-DDTHH:mm:ssZ',
//   'YYYY-MM-DDTHH:mm:ss',
//   'YYYY-MM-DDTHH:mm',
//   'YYYY-MM-DD',
//   'MM-DD-YYYY',
//   'DD-MM-YYYY',
//   'DD-MM-YY',
// ];


const _SUPPORTED_FORMATS = [
  // ISO formats (recommended standard)
  'YYYY-MM-DDTHH:mm:ss.SSSZ',
  'YYYY-MM-DDTHH:mm:ssZ',
  'YYYY-MM-DDTHH:mm:ss',
  'YYYY-MM-DDTHH:mm',
  'YYYY-MM-DD',

  // With space instead of T
  'YYYY-MM-DD HH:mm:ss.SSSZ',
  'YYYY-MM-DD HH:mm:ssZ',
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm',

  // US formats
  'MM-DD-YYYY',
  'MM/DD/YYYY',
  'MM-DD-YY',
  'MM/DD/YY',

  // European / Indian formats
  'DD-MM-YYYY',
  'DD/MM/YYYY',
  'DD-MM-YY',
  'DD/MM/YY',

  // Year first with slashes
  'YYYY/MM/DD',
  'YYYY/MM/DD HH:mm:ss',
  'YYYY/MM/DD HH:mm',

  // Textual month formats
  // 'DD MMM YYYY',        // 25 Jan 2025
  // 'DD MMMM YYYY',       // 25 January 2025
  // 'MMM DD YYYY',        // Jan 25 2025
  // 'MMMM DD YYYY',       // January 25 2025
];
function _validDateParts(y, m, d) {
  if (m < 1 || m > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function _validTimeParts(h, mi, s = 0, ms = 0) {
  return h >= 0 && h < 24 && mi >= 0 && mi < 60 && s >= 0 && s < 60 && ms >= 0 && ms < 1000;
}


export function parseDateInput(raw) {
  const s = (raw || '').trim();
  if (!s) return { format: null, error: null };

  // Direct format match
  if (_SUPPORTED_FORMATS.includes(s)) {
    return { format: s, error: null };
  }

  let match;

  // Helper to parse numbers safely
  const toNums = (arr) => arr.map((x, i) => (i === 0 ? x : parseInt(x, 10)));

  // ───────────────── YYYY-MM-DD WITH T OR SPACE SEPARATOR ─────────────────

  const isoPatterns = [
    // T-separator (ISO 8601)
    {
      regex: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/,
      format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
      validate: ([, y, m, d, h, mi, se, ms]) => _validDateParts(y, m, d) && _validTimeParts(h, mi, se, ms),
    },
    {
      regex: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/,
      format: 'YYYY-MM-DDTHH:mm:ssZ',
      validate: ([, y, m, d, h, mi, se]) => _validDateParts(y, m, d) && _validTimeParts(h, mi, se),
    },
    {
      regex: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
      format: 'YYYY-MM-DDTHH:mm:ss',
      validate: ([, y, m, d, h, mi, se]) => _validDateParts(y, m, d) && _validTimeParts(h, mi, se),
    },
    {
      regex: /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
      format: 'YYYY-MM-DDTHH:mm',
      validate: ([, y, m, d, h, mi]) => _validDateParts(y, m, d) && _validTimeParts(h, mi),
    },
    // Space-separator variants (e.g. "2025-07-25 14:30:00")
    {
      regex: /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/,
      format: 'YYYY-MM-DD HH:mm:ss.SSSZ',
      validate: ([, y, m, d, h, mi, se, ms]) => _validDateParts(y, m, d) && _validTimeParts(h, mi, se, ms),
    },
    {
      regex: /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})Z$/,
      format: 'YYYY-MM-DD HH:mm:ssZ',
      validate: ([, y, m, d, h, mi, se]) => _validDateParts(y, m, d) && _validTimeParts(h, mi, se),
    },
    {
      regex: /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
      format: 'YYYY-MM-DD HH:mm:ss',
      validate: ([, y, m, d, h, mi, se]) => _validDateParts(y, m, d) && _validTimeParts(h, mi, se),
    },
    {
      regex: /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/,
      format: 'YYYY-MM-DD HH:mm',
      validate: ([, y, m, d, h, mi]) => _validDateParts(y, m, d) && _validTimeParts(h, mi),
    },
    // Date only
    {
      regex: /^(\d{4})-(\d{2})-(\d{2})$/,
      format: 'YYYY-MM-DD',
      validate: ([, y, m, d]) => _validDateParts(y, m, d),
    },
  ];

  for (const { regex, format, validate } of isoPatterns) {
    match = s.match(regex);
    if (match) {
      const parts = toNums(match);
      return validate(parts) ? { format, error: null } : { format: null, error: 'Invalid date: day, month or time out of range.' };
    }
  }

  // ───────────────── YYYY/MM/DD (slash, year-first) ─────────────────

  match = s.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, y, m, d, h, mi, se] = toNums(match);
    if (!_validDateParts(y, m, d) || !_validTimeParts(h, mi, se)) return { format: null, error: 'Invalid date: day, month or time out of range.' };
    return { format: 'YYYY/MM/DD HH:mm:ss', error: null };
  }

  match = s.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/);
  if (match) {
    const [, y, m, d, h, mi] = toNums(match);
    if (!_validDateParts(y, m, d) || !_validTimeParts(h, mi)) return { format: null, error: 'Invalid date: day, month or time out of range.' };
    return { format: 'YYYY/MM/DD HH:mm', error: null };
  }

  match = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (match) {
    const [, y, m, d] = toNums(match);
    if (!_validDateParts(y, m, d)) return { format: null, error: 'Invalid date: day or month out of range.' };
    return { format: 'YYYY/MM/DD', error: null };
  }

  // ───────────────── LOCAL FORMATS (hyphen) ─────────────────

  // DD-MM-YYYY or MM-DD-YYYY
  match = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    const [, a, b, y] = toNums(match);
    if (_validDateParts(y, b, a)) return { format: 'DD-MM-YYYY', error: null };
    if (_validDateParts(y, a, b)) return { format: 'MM-DD-YYYY', error: null };
    return { format: null, error: 'Invalid date: day or month out of range.' };
  }

  // DD-MM-YY or MM-DD-YY
  match = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (match) {
    const [, a, b, yy] = toNums(match);
    const y = yy >= 50 ? 1900 + yy : 2000 + yy;
    if (_validDateParts(y, b, a)) return { format: 'DD-MM-YY', error: null };
    if (_validDateParts(y, a, b)) return { format: 'MM-DD-YY', error: null };
    return { format: null, error: 'Invalid date: day or month out of range.' };
  }

  // ───────────────── LOCAL FORMATS (slash) ─────────────────

  // DD/MM/YYYY or MM/DD/YYYY
  match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, a, b, y] = toNums(match);
    if (_validDateParts(y, b, a)) return { format: 'DD/MM/YYYY', error: null };
    if (_validDateParts(y, a, b)) return { format: 'MM/DD/YYYY', error: null };
    return { format: null, error: 'Invalid date: day or month out of range.' };
  }

  // DD/MM/YY or MM/DD/YY
  match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (match) {
    const [, a, b, yy] = toNums(match);
    const y = yy >= 50 ? 1900 + yy : 2000 + yy;
    if (_validDateParts(y, b, a)) return { format: 'DD/MM/YY', error: null };
    if (_validDateParts(y, a, b)) return { format: 'MM/DD/YY', error: null };
    return { format: null, error: 'Invalid date: day or month out of range.' };
  }

  // ───────────────── FALLBACK ─────────────────
  return {
    format: null,
    error: `Unsupported format. Type a sample date (e.g. 25-07-2025, 25/07/2025, 2025-07-25, 2025-07-25 14:30:00) or paste a format token directly (e.g. DD-MM-YYYY, YYYY/MM/DD).`,
  };
}

/**
 * Converts a backend report.rules payload (strftime dates, flat strings)
 * back into the UI columnRules format used by FileUpload's rule builder.
 */
export function parseReportRules(reportRules) {
  const columnRules = {};
  for (const [col, rules] of Object.entries(reportRules || {})) {
    const ruleList = [];
    for (const [key, val] of Object.entries(rules || {})) {
      switch (key) {
        case 'has_empty':
          ruleList.push({ type: 'has_empty', config: { required: val === 'true' } });
          break;
        case 'data_type': {
          const types = String(val).split(',').map(t => t.trim()).filter(Boolean);
          ruleList.push({ type: 'data_type', config: { type: types } });
          break;
        }
        case 'data_length': {
          if (val.specific === 'true') {
            ruleList.push({ type: 'data_length', config: { mode: 'specific', length: Number(val.fix_length) } });
          } else {
            ruleList.push({ type: 'data_length', config: { mode: 'range', min: Number(val.grater_length), max: Number(val.less_length) } });
          }
          break;
        }
        case 'greater_than':
          ruleList.push({ type: 'greater_than', config: { threshold: Number(val) } });
          break;
        case 'less_than':
          ruleList.push({ type: 'less_than', config: { threshold: Number(val) } });
          break;
        case 'in_between': {
          const [mn, mx] = String(val).split(',').map(p => Number(p.trim()));
          ruleList.push({ type: 'in_between', config: { min: mn, max: mx } });
          break;
        }
        case 'date_format': {
          // Legacy reports stored strftime tokens (%Y, %m, etc.) — decode back to moment tokens.
          // New reports store moment tokens directly, so the replace is a no-op.
          const fmt = String(val).replace(/%Y/g, 'YYYY').replace(/%y/g, 'YY').replace(/%m/g, 'MM').replace(/%d/g, 'DD').replace(/%H/g, 'HH').replace(/%M/g, 'mm').replace(/%S/g, 'ss');
          // rawInput gets the format itself so the input redisplays cleanly and re-parses to the same format.
          ruleList.push({ type: 'date_format', config: { rawInput: fmt, format: fmt } });
          break;
        }
        case 'fix_header':
          ruleList.push({ type: 'fix_header', config: { values: String(val) } });
          break;
        case 'cell_contains':
          ruleList.push({ type: 'cell_contains', config: { contains: val.contains !== 'false', pattern: val.value || '' } });
          break;
        case 'cell_value_start_end_with':
          ruleList.push({ type: 'cell_value_start_end_with', config: { start_with: val.start_with || '', end_with: val.end_with || '' } });
          break;
        case 'data_redundant':
          ruleList.push({ type: 'data_redundant', config: { value: val.value || '', threshold: Number(val.Threshold || 0) } });
          break;
        case 'not_match_found':
          ruleList.push({ type: 'not_match_found', config: { value: String(val) } });
          break;
        case 'depend_header': {
          const entries = Object.entries(val);
          if (entries.length < 1) break;
          const [triggerCol, triggerVal] = entries[0];
          const triggerCondition = _KNOWN_COND.includes(triggerVal) ? triggerVal : 'equals';
          const triggerEqualsValue = triggerCondition === 'equals' ? triggerVal : '';
          const dependents = entries.slice(1).map(([depCol, depVal]) => {
            const depCond = _KNOWN_COND.includes(depVal) ? depVal : 'equals';
            return { col: depCol, conditionType: depCond, equalsValue: depCond === 'equals' ? depVal : '' };
          });
          ruleList.push({ type: 'depend_header', config: { triggerCol, triggerCondition, triggerEqualsValue, dependents } });
          break;
        }
        default: break;
      }
    }
    if (ruleList.length > 0) columnRules[col] = ruleList;
  }
  return columnRules;
}



// ─── validateRuleConfig ───────────────────────────────────────────────────────
export function validateRuleConfig(ruleType, config) {
  switch (ruleType) {
    case 'has_empty': return null;
    case 'data_type': {
      const types = Array.isArray(config.type) ? config.type : (config.type ? [config.type] : ['str']);
      if (types.length === 0) return 'Data Type: please select at least one data type.';
      return null;
    }
    case 'data_length': {
      const mode = config.mode || 'range';
      if (mode === 'fix_length' || mode === 'specific') {
        if (config.length === undefined || config.length === null || config.length === '') return 'Data Length: please enter an exact length.';
        if (Number(config.length) < 1) return 'Data Length: exact length must be at least 1.';
      } else {
        const hasMin = config.min !== undefined && config.min !== '';
        const hasMax = config.max !== undefined && config.max !== '';
        if (!hasMin || !hasMax) return 'Data Length: both Min and Max values are required.';
        const min = Number(config.min);
        const max = Number(config.max);
        if (min < 0) return 'Data Length: Min length cannot be negative.';
        if (max < 0) return 'Data Length: Max length cannot be negative.';
        if (max <= min) return 'Data Length: Max length must be greater than Min length.';
      }
      return null;
    }
    case 'greater_than':
      if (config.threshold === '' || config.threshold === undefined) return 'Greater Than: please enter a threshold value.';
      return null;
    case 'less_than':
      if (config.threshold === '' || config.threshold === undefined || config.threshold < 0) return 'Less Than: please enter a valid threshold value.';
      return null;
    case 'in_between': {
      const hasMin = config.min !== '' && config.min !== undefined;
      const hasMax = config.max !== '' && config.max !== undefined;
      if (!hasMin || !hasMax) return 'In Between: both Minimum and Maximum values are required.';
      if (Number(config.min) >= Number(config.max)) return 'In Between: Minimum must be less than Maximum.';
      return null;
    }
    case 'date_format': {
      if (!config.rawInput?.trim()) return 'Date Format: please enter a sample date or format.';
      if (!config.format) return 'Date Format: unrecognized — use one of the supported formats.';
      return null;
    }
    case 'fix_header': {
      const vals = (config.values || '').split(',').map(v => v.trim()).filter(Boolean);
      if (vals.length === 0) return 'Fixed Values: enter at least one allowed value.';
      return null;
    }
    case 'cell_contains':
      if (!config.pattern || !config.pattern.trim()) return 'Cell Contains: please enter a regex pattern.';
      try { new RegExp(config.pattern); } catch { return 'Cell Contains: invalid regex pattern.'; }
      return null;
    case 'cell_value_start_end_with':
      if (!config.start_with?.trim() && !config.end_with?.trim()) return 'Start/End With: enter at least a "Starts With" or "Ends With" value.';
      return null;
    case 'data_redundant':
      if (config.threshold === '' || config.threshold === undefined) return 'Data Redundancy: please enter a max allowed redundancy percentage.';
      if (Number(config.threshold) < 0 || Number(config.threshold) > 100) return 'Data Redundancy: threshold must be between 0 and 100.';
      return null;
    case 'not_match_found':
      if (!config.value || !config.value.trim()) return 'Not Match Found: please enter a forbidden value.';
      return null;
    case 'depend_header': {
      if (config.triggerCondition === 'equals' && !config.triggerEqualsValue?.trim())
        return 'Dependent Column: enter the expected value for the trigger condition.';
      const trigger = (config.triggerCol || '').trim();
      const deps = (config.dependents || []).filter(d => d.col?.trim());
      if (deps.length === 0) return 'Dependent Column: add at least one dependent (THEN) column.';
      const dupDep = deps.find(d => d.col.trim() === trigger);
      if (dupDep) return `Dependent Column: "${dupDep.col}" cannot be both the trigger and a dependent.`;
      const depCols = deps.map(d => d.col.trim());
      if (new Set(depCols).size !== depCols.length) return 'Dependent Column: duplicate dependent columns are not allowed.';
      const missingEquals = deps.find(d => d.conditionType === 'equals' && !d.equalsValue?.trim());
      if (missingEquals) return `Dependent Column: enter the expected value for "${missingEquals.col}".`;
      return null;
    }
    default: return null;
  }
}


const _MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};


export const COLORS = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    900: '#1e3a8a',
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  }
};