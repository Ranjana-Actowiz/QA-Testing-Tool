import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Select from 'react-select';
import { toast } from 'react-toastify';
import { runValidation, getUpload, listSavedRules, saveRuleSet, listReports } from '../services/api';
import { ChevronDownIcon, CodeIcon, ColumnsIcon, DownloadIcon, FileSpreadsheetIcon, PlayIcon, PlusIcon, SearchIcon, UploadCloudIcon, UploadIcon, XIcon } from '../icon/icon';
import { COND_OPTIONS, DATE_FORMAT_OPTIONS, fmtDate, matchOpts, modeOpts, opts, RULE_TYPES, validateRuleConfig } from '../utlis/utlis';

// ─── Shared input styles ────────────────────────────────────────────────────
const inputCls = 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white';
const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5';

const selectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: '12px',
    borderColor: state.isFocused ? '#3B82F6' : '#E2E8F0',
    backgroundColor: '#FFFFFF',
    boxShadow: state.isFocused ? '0 0 0 1px #3B82F6' : 'none',
    '&:hover': { borderColor: '#CBD5E1' },
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #E2E8F0',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
  }),
  menuList: (base) => ({ ...base, backgroundColor: '#FFFFFF', padding: '4px' }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#EFF6FF' : state.isFocused ? '#F1F5F9' : 'transparent',
    color: '#1E293B',
    cursor: 'pointer',
    borderRadius: '8px',
    '&:active': { backgroundColor: '#DBEAFE' },
  }),
  singleValue: (base) => ({ ...base, color: '#1E293B' }),
  placeholder: (base) => ({ ...base, color: '#94A3B8' }),
  dropdownIndicator: (base) => ({ ...base, color: '#64748B', '&:hover': { color: '#3B82F6' } }),
  indicatorSeparator: () => ({ display: 'none' }),
  input: (base) => ({ ...base, color: '#1E293B' }),
};

// ─── Toggle ──────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      {label && <span className="text-sm text-slate-700 font-medium">{label}</span>}
    </div>
  );
}

// ─── RuleFields ───────────────────────────────────────────────────────────────
function RuleFields({ ruleType, value, onChange, columnName, headers = [] }) {
  const update = (key, val) => onChange({ ...value, [key]: val });

  switch (ruleType) {
    case 'has_empty': {
      const isRequired = value.required !== false;
      return (
        <div className="flex flex-col gap-2">
          <Toggle checked={isRequired} onChange={v => update('required', v)}
            label={isRequired ? 'Required — empty values will fail' : 'Optional — empty values are allowed'} />
          <p className="text-xs text-slate-400 ml-14">
            {isRequired ? 'Rows where this column is blank will be marked as failed.' : 'Rows with blank values in this column will still pass.'}
          </p>
        </div>
      );
    }

    case 'data_type': {
      const selectedTypes = Array.isArray(value.type) ? value.type : (value.type ? [value.type] : ['str']);
      return (
        <div>
          <label className={labelCls}>Expected Data Types (multiple allowed)</label>
          <Select
            isMulti
            options={opts}
            value={opts.filter(o => selectedTypes.includes(o.value))}
            onChange={sel => update('type', sel ? sel.map(o => o.value) : [])}
            styles={{
              ...selectStyles,
              control: (base, state) => ({
                ...base,
                borderRadius: '12px',
                borderColor: state.isFocused ? '#3B82F6' : '#E2E8F0',
                backgroundColor: '#FFFFFF',
                boxShadow: state.isFocused ? '0 0 0 1px #3B82F6' : 'none',
                '&:hover': { borderColor: '#CBD5E1' },
                minHeight: '42px',
              }),
              multiValue: (base) => ({ ...base, backgroundColor: '#EFF6FF', borderRadius: '8px', padding: '2px 6px' }),
              multiValueLabel: (base) => ({ ...base, color: '#1E40AF', fontSize: '12px', fontWeight: '500' }),
              multiValueRemove: (base) => ({ ...base, color: '#3B82F6', '&:hover': { backgroundColor: '#DBEAFE', color: '#1E3A8A' } }),
            }}
            className="text-sm"
            placeholder="Select one or more data types..."
            noOptionsMessage={() => 'No data types available'}
          />
          <p className="mt-1.5 text-xs text-slate-400">Select multiple data types that are acceptable for this column.</p>
        </div>
      );
    }

    case 'data_length': {
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Length Mode</label>
            <Select options={modeOpts} value={modeOpts.find(o => o.value === (value.mode || 'range'))} onChange={o => update('mode', o.value)} styles={selectStyles} className="text-sm" />
          </div>
          {(value.mode === 'range' || !value.mode) && (
            <div className="grid grid-cols-2 gap-2.5">
              <div><label className={labelCls}>Min Length</label>
                <input type="number" min="0" className={inputCls} value={value.min ?? ''} placeholder="e.g. 1"
                  onChange={e => update('min', e.target.value ? Number(e.target.value) : undefined)} /></div>
              <div><label className={labelCls}>Max Length</label>
                <input type="number" min="0" className={inputCls} value={value.max ?? ''} placeholder="e.g. 100"
                  onChange={e => update('max', e.target.value ? Number(e.target.value) : undefined)} /></div>
            </div>
          )}
          {(value.mode === 'fix_length' || value.mode === 'specific') && (
            <div><label className={labelCls}>Exact Length</label>
              <input type="number" min="0" className={inputCls} value={value.length ?? ''} placeholder="e.g. 10"
                onChange={e => update('length', e.target.value ? Number(e.target.value) : undefined)} /></div>
          )}
        </div>
      );
    }

    case 'greater_than':
      return (<div><label className={labelCls}>Value must be greater than</label>
        <input type="number" className={inputCls} value={value.threshold ?? ''} placeholder="e.g. 0"
          onChange={e => update('threshold', (e.target.value !== '' && e.target.value >= 0) ? Number(e.target.value) : '')} /></div>);

    case 'less_than':
      return (<div><label className={labelCls}>Value must be less than</label>
        <input type="number" className={inputCls} value={value.threshold ?? ''} placeholder="e.g. 1000"
          onChange={e => update('threshold', e.target.value !== '' ? Number(e.target.value) : '')} /></div>);

    case 'in_between':
      return (
        <div className="grid grid-cols-2 gap-2.5">
          <div><label className={labelCls}>Minimum Value</label>
            <input type="number" className={inputCls} value={value.min ?? ''} placeholder="e.g. 0"
              onChange={e => update('min', e.target.value !== '' ? Number(e.target.value) : '')} /></div>
          <div><label className={labelCls}>Maximum Value</label>
            <input type="number" className={inputCls} value={value.max ?? ''} placeholder="e.g. 100"
              onChange={e => update('max', e.target.value !== '' ? Number(e.target.value) : '')} /></div>
        </div>
      );

    case 'date_format': {
      const isCustom = value._customMode === true;
      const dropdownValue = isCustom
        ? DATE_FORMAT_OPTIONS.find(o => o.value === '__custom__')
        : (DATE_FORMAT_OPTIONS.find(o => o.value === (value.format || '')) || null);
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Select Date Format</label>
            <Select
              options={DATE_FORMAT_OPTIONS}
              value={dropdownValue}
              onChange={(opt) => {
                if (opt.value === '__custom__') {
                  onChange({ ...value, _customMode: true, format: '' });
                } else {
                  onChange({ ...value, _customMode: false, format: opt.value });
                }
              }}
              styles={selectStyles}
              placeholder="Choose a format..."
              className="text-sm"
            />
          </div>
          {isCustom && (
            <div>
              <input type="text" className={`${inputCls} font-mono`} value={value.format || ''}
                placeholder="e.g. YYYY-MM-DD" onChange={e => update('format', e.target.value)} autoFocus />
              <p className="mt-1.5 text-xs text-slate-400">Tokens: YYYY MM DD HH mm ss</p>
            </div>
          )}
        </div>
      );
    }

    case 'fix_header':
      return (<div><label className={labelCls}>Allowed Values (comma-separated)</label>
        <input type="text" className={inputCls} value={value.values || ''} placeholder="e.g. Male,Female,Other"
          onChange={e => update('values', e.target.value)} />
        <p className="mt-1.5 text-xs text-slate-400">Only these exact values will be accepted.</p></div>);

    case 'cell_contains':
      return (
        <div className="flex flex-col gap-3">
          <div><label className={labelCls}>Regex Pattern</label>
            <input type="text" className={inputCls} value={value.pattern || ''} placeholder="e.g. ^[A-Z].*" onChange={e => update('pattern', e.target.value)} /></div>
          <div><label className={labelCls}>Match Mode</label>
            <Select options={matchOpts} value={matchOpts.find(o => o.value === String(value.contains !== false))} onChange={o => update('contains', o.value === 'true')} styles={selectStyles} className="text-sm" /></div>
        </div>
      );

    case 'cell_value_start_end_with':
      return (
        <div className="flex flex-col gap-3">
          <div><label className={labelCls}>Starts With</label>
            <input type="text" className={inputCls} value={value.start_with || ''} placeholder="e.g. ID_" onChange={e => update('start_with', e.target.value)} /></div>
          <div><label className={labelCls}>Ends With (optional)</label>
            <input type="text" className={inputCls} value={value.end_with || ''} placeholder="e.g. _END" onChange={e => update('end_with', e.target.value)} /></div>
        </div>
      );

    case 'data_redundant':
      return (
        <div className="flex flex-col gap-3">
          <div><label className={labelCls}>Check Value (optional)</label>
            <input type="text" className={inputCls} value={value.value || ''} placeholder="Specific value to check"
              onChange={e => update('value', e.target.value)} /></div>
          <div><label className={labelCls}>Max Allowed Redundancy (%)</label>
            <input type="number" min="0" max="100" className={inputCls} value={value.threshold ?? ''} placeholder="e.g. 20"
              onChange={e => update('threshold', e.target.value !== '' ? Number(e.target.value) : '')} />
            <p className="mt-1.5 text-xs text-slate-400">Fail if duplicates exceed this % of total rows.</p></div>
        </div>
      );

    case 'not_match_found':
      return (<div><label className={labelCls}>Forbidden Value</label>
        <input type="text" className={inputCls} value={value.value || ''} placeholder="e.g. NULL or N/A" onChange={e => update('value', e.target.value)} />
        <p className="mt-1.5 text-xs text-slate-400">Validation fails if any cell contains this exact value.</p></div>);

    case 'depend_header': {
      const condLabel = (ct, eq) =>
        ct === 'equals' ? `= "${eq || '?'}"` : ct === 'empty' ? 'is empty' : 'is not empty';
      const headerOptions = headers.map(h => ({ value: h, label: h }));
      const triggerCol = value.triggerCol || columnName || '';
      const triggerCondition = value.triggerCondition || 'not_empty';
      const dependents = value.dependents || [{ col: '', conditionType: 'not_empty', equalsValue: '' }];

      const updateDep = (idx, key, val) => {
        const updated = dependents.map((d, i) => i === idx ? { ...d, [key]: val } : d);
        onChange({ ...value, dependents: updated });
      };

      const filledDeps = dependents.filter(d => d.col);
      const preview = triggerCol
        ? `IF "${triggerCol}" ${condLabel(triggerCondition, value.triggerEqualsValue)} → THEN validate: ${filledDeps.length ? filledDeps.map(d => `"${d.col}" ${condLabel(d.conditionType, d.equalsValue)}`).join(', ') : '(no dependent columns yet)'}`
        : null;

      return (
        <div className="flex flex-col gap-0">
          {preview && (
            <div className="mb-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-400 uppercase tracking-wide text-[10px] block mb-0.5">Rule Preview</span>
              {preview}
            </div>
          )}
          <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest">IF</span>
              <span className="text-xs text-blue-700 font-medium">Trigger — this condition must be true</span>
            </div>
            <Select options={headerOptions} value={headerOptions.find(o => o.value === triggerCol) || null}
              onChange={o => onChange({ ...value, triggerCol: o.value })} isDisabled={true}
              styles={selectStyles} placeholder="Select trigger column..." className="text-sm" />
            <Select options={COND_OPTIONS} value={COND_OPTIONS.find(o => o.value === triggerCondition)}
              onChange={o => onChange({ ...value, triggerCondition: o.value })}
              styles={selectStyles} className="text-sm" />
            {triggerCondition === 'equals' && (
              <input type="text" className={inputCls} value={value.triggerEqualsValue || ''}
                placeholder="Expected value" onChange={e => update('triggerEqualsValue', e.target.value)} />
            )}
          </div>
          <div className="flex items-center justify-center py-1 select-none">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-px h-3 bg-slate-300" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-0.5 bg-white border border-slate-200 rounded-full">THEN</span>
              <div className="w-px h-3 bg-slate-300" />
            </div>
          </div>
          <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest">THEN</span>
              <span className="text-xs text-emerald-700 font-medium">These columns are validated only when IF fires</span>
            </div>
            {dependents.map((dep, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="mt-2 w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <Select options={headerOptions} value={headerOptions.find(o => o.value === dep.col) || null}
                    onChange={o => updateDep(idx, 'col', o.value)}
                    styles={selectStyles} placeholder="Select column..." className="text-sm" />
                </div>
                <div className="w-44 flex-shrink-0">
                  <Select options={COND_OPTIONS} value={COND_OPTIONS.find(o => o.value === (dep.conditionType || 'not_empty'))}
                    onChange={o => updateDep(idx, 'conditionType', o.value)}
                    styles={selectStyles} className="text-sm" />
                </div>
                {dep.conditionType === 'equals' && (
                  <input type="text" className={`${inputCls} w-28 flex-shrink-0`} value={dep.equalsValue || ''}
                    placeholder="Value" onChange={e => updateDep(idx, 'equalsValue', e.target.value)} />
                )}
                {dependents.length > 1 && (
                  <button type="button"
                    onClick={() => onChange({ ...value, dependents: dependents.filter((_, i) => i !== idx) })}
                    className="mt-1.5 flex-shrink-0 w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer">
                    <XIcon size={13} />
                  </button>
                )}
              </div>
            ))}
            <button type="button"
              onClick={() => onChange({ ...value, dependents: [...dependents, { col: '', conditionType: 'not_empty', equalsValue: '' }] })}
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-transparent border-none cursor-pointer p-0">
              <PlusIcon size={12} /> Add dependent column
            </button>
          </div>
        </div>
      );
    }

    default:
      return <div className="text-slate-400 text-sm">Select a rule type above.</div>;
  }
}


// ─── buildPayload ─────────────────────────────────────────────────────────────
function buildPayload(uploadId, columnRules) {
  const rules = {};
  Object.entries(columnRules).forEach(([col, ruleList]) => {
    if (!ruleList?.length) return;
    const merged = {};
    ruleList.forEach(({ type, config }) => {
      switch (type) {
        case 'has_empty': merged.has_empty = String(config.required !== false); break;
        case 'data_type': {
          const types = Array.isArray(config.type) ? config.type : [config.type || 'str'];
          merged.data_type = types.map(t => String(t).toLowerCase().trim()).filter(Boolean).join(',');
          break;
        }
        case 'data_length': {
          if (config.mode === 'fix_length' || config.mode === 'specific') {
            merged.data_length = { specific: 'true', fix_length: String(config.length) };
          } else {
            const obj = { specific: 'false' };
            if (config.min !== undefined) obj.grater_length = String(config.min);
            if (config.max !== undefined) obj.less_length = String(config.max);
            merged.data_length = obj;
          }
          break;
        }
        case 'greater_than': merged.greater_than = String(config.threshold); break;
        case 'less_than': merged.less_than = String(config.threshold); break;
        case 'in_between': merged.in_between = `${config.min}, ${config.max}`; break;
        case 'date_format': {
          const strftime = (config.format || '')
            .replace(/YYYY/g, '%Y').replace(/YY/g, '%y')
            .replace(/MM/g, '%m').replace(/DD/g, '%d')
            .replace(/HH/g, '%H').replace(/mm/g, '%M').replace(/ss/g, '%S');
          merged.date_format = strftime;
          break;
        }
        case 'fix_header': merged.fix_header = (config.values || '').split(',').map(v => v.trim()).filter(Boolean).join(', '); break;
        case 'cell_contains': merged.cell_contains = { contains: String(config.contains !== false), value: config.pattern || '' }; break;
        case 'cell_value_start_end_with': merged.cell_value_start_end_with = { start_end_with: 'no', start_with: config.start_with || '', end_with: config.end_with || '' }; break;
        case 'data_redundant': merged.data_redundant = { value: config.value || '', Threshold: String(config.threshold || 50) }; break;
        case 'not_match_found': merged.not_match_found = config.value; break;
        case 'depend_header': {
          const triggerCond = config.triggerCondition === 'equals' ? (config.triggerEqualsValue || '') : (config.triggerCondition || 'not_empty');
          const obj = { [(config.triggerCol || col).trim()]: triggerCond };
          (config.dependents || []).forEach(dep => {
            const name = (dep.col || '').trim();
            if (!name) return;
            obj[name] = dep.conditionType === 'equals' ? (dep.equalsValue || '') : (dep.conditionType || 'not_empty');
          });
          merged.depend_header = obj;
          break;
        }
        default: break;
      }
    });
    if (Object.keys(merged).length > 0) rules[col] = merged;
  });
  return { uploadId, rules };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RuleConfig() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  // Upload metadata
  const [headers, setHeaders] = useState([]);
  const [filename, setFilename] = useState('');
  const [totalRows, setTotalRows] = useState(0);
  const [loadingUpload, setLoadingUpload] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  // Rule configuration state
  const [selectedHeader, setSelectedHeader] = useState(null);
  const [columnRules, setColumnRules] = useState({});
  const [addingRule, setAddingRule] = useState(false);
  const [newRuleType, setNewRuleType] = useState('has_empty');
  const [newRuleConfig, setNewRuleConfig] = useState({ required: true });
  const [submitting, setSubmitting] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [searchHeaders, setSearchHeaders] = useState('');
  const [savedFeeds, setSavedFeeds] = useState([]);
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const importInputRef = useRef(null);
  const [editingRule, setEditingRule] = useState(null);
  const [editingConfig, setEditingConfig] = useState({});
  // Save Rules modal — step: null | 'confirm' | 'name'
  const [saveStep, setSaveStep] = useState(null);
  const [feedName, setFeedName] = useState('');
  const [savingRules, setSavingRules] = useState(false);

  //!  Fetch upload metadata on mount
  useEffect(() => {
    if (!uploadId) { navigate('/'); return; }
    setLoadingUpload(true);
    getUpload(uploadId)
      .then(res => {
        const data = res?.data?.data || res?.data;
        const hdrs = data?.headers || [];
        setHeaders(hdrs);
        setFilename(data?.originalName || data?.filename || '');
        setTotalRows(data?.totalRows || 0);
        setSelectedHeader(hdrs[0] || null);
      })
      .catch(err => {
        const msg = err.displayMessage || 'Failed to load upload data.';
        setFetchError(msg);
        toast.error(msg);
      })
      .finally(() => setLoadingUpload(false));

    // Fetch saved feeds for Load Previous Rules
    listSavedRules()
      .then(res => setSavedFeeds(res.data?.data || []))
      .catch(() => { });
  }, [uploadId, navigate]);

  // ? Listen for rules dispatched by Sidebar while on this page
  useEffect(() => {
    const handler = (e) => {
      const loaded = e.detail?.columnRules;
      if (!loaded || headers.length === 0) return;
      const headerSet = new Set(headers);
      const filtered = {};
      let count = 0;
      for (const [col, rules] of Object.entries(loaded)) {
        if (headerSet.has(col)) { filtered[col] = rules; count += rules.length; }
      }
      if (count === 0) { toast.warning('No matching columns between the loaded rules and this file.'); return; }
      setColumnRules(filtered);
      toast.success(`Applied ${count} rule${count !== 1 ? 's' : ''}.`);
    };
    window.addEventListener('qaToolRulesPreloaded', handler);
    return () => window.removeEventListener('qaToolRulesPreloaded', handler);
  }, [headers]);

  const handleAddRule = useCallback(() => {
    if (!selectedHeader) return;
    if ((columnRules[selectedHeader] || []).find(r => r.type === newRuleType)) {
      toast.warning(`Rule "${newRuleType}" already added for this column.`);
      return;
    }
    const err = validateRuleConfig(newRuleType, newRuleConfig);
    if (err) { toast.error(err); return; }
    setColumnRules(prev => ({ ...prev, [selectedHeader]: [...(prev[selectedHeader] || []), { type: newRuleType, config: { ...newRuleConfig } }] }));
    setNewRuleConfig({ required: true });
    setNewRuleType('has_empty');
    setAddingRule(false);
    toast.success(`Rule added to "${selectedHeader}"`);
  }, [selectedHeader, columnRules, newRuleType, newRuleConfig]);

  const handleRemoveRule = useCallback((header, index) => {
    setColumnRules(prev => ({ ...prev, [header]: prev[header].filter((_, i) => i !== index) }));
  }, []);

  const handleStartEdit = useCallback((header, idx, config) => {
    setEditingRule({ header, idx });
    setEditingConfig({ ...config });
    setAddingRule(false);
  }, []);

  const handleSaveRuleEdit = useCallback(() => {
    if (!editingRule) return;
    const { header, idx } = editingRule;
    const rule = (columnRules[header] || [])[idx];
    if (!rule) return;
    const err = validateRuleConfig(rule.type, editingConfig);
    if (err) { toast.error(err); return; }
    setColumnRules(prev => ({
      ...prev,
      [header]: prev[header].map((r, i) => i === idx ? { ...r, config: { ...editingConfig } } : r),
    }));
    setEditingRule(null);
    setEditingConfig({});
    toast.success('Rule updated.');
  }, [editingRule, editingConfig, columnRules]);

  const handleCancelEdit = useCallback(() => {
    setEditingRule(null);
    setEditingConfig({});
  }, []);

  const handleRunValidation = async () => {
    if (totalRules === 0) { toast.warning('Please add at least one validation rule.'); return; }
    setSubmitting(true);
    try {
      const res = await runValidation(payload);
      const reportId = res.data?.reportId || res.data?.report_id || res.data?.id;
      toast.success('Validation complete!');
      navigate(`/results/${reportId}`);
    } catch (err) {
      toast.error(err.displayMessage || 'Validation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportRules = useCallback(() => {
    const ruleCount = Object.values(columnRules).reduce((s, a) => s + a.length, 0);
    if (ruleCount === 0) { toast.warning('No rules to export.'); return; }
    const data = { exportedAt: new Date().toISOString(), sourceFile: filename, columnRules };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/\.[^/.]+$/, '')}_rules.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Rules exported!');
  }, [filename, columnRules]);

  const handleImportRules = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const raw = parsed.columnRules || parsed;
        const headerSet = new Set(headers);
        const filtered = {};
        let count = 0;
        for (const [col, rules] of Object.entries(raw)) {
          if (headerSet.has(col) && Array.isArray(rules) && rules.length > 0) {
            filtered[col] = rules;
            count += rules.length;
          }
        }
        if (count === 0) { toast.warning('No matching columns found in this JSON file.'); return; }
        setColumnRules(filtered);
        toast.success(`Imported ${count} rule${count !== 1 ? 's' : ''} from JSON.`);
      } catch {
        toast.error('Invalid JSON file.');
      }
      e.target.value = '';
    };
    reader.readAsText(f);
  }, [headers]);

  const handleLoadSavedFeed = useCallback((feed) => {
    const headerSet = new Set(headers);
    const filtered = {};
    let count = 0;
    for (const [col, rules] of Object.entries(feed.rules || {})) {
      if (headerSet.has(col) && Array.isArray(rules)) { filtered[col] = rules; count += rules.length; }
    }
    if (count === 0) { toast.warning('No matching columns between this feed and the current file.'); return; }
    setColumnRules(filtered);
    setShowLoadPanel(false);
    toast.success(`Loaded ${count} rule${count !== 1 ? 's' : ''} from "${feed.feedName}".`);
  }, [headers]);

  const handleConfirmSave = async () => {
    if (!feedName.trim()) { toast.error('Please enter a feed name.'); return; }
    setSavingRules(true);
    try {
      await saveRuleSet({ feedName: feedName.trim(), rules: columnRules });
      toast.success(`Feed "${feedName.trim()}" saved successfully!`);
      setSaveStep(null);
      setFeedName('');
      listReports();
    } catch (err) {
      toast.error(err.displayMessage || 'Failed to save rules.');
    } finally {
      setSavingRules(false);
    }
  };

  const totalRules = useMemo(() => Object.values(columnRules).reduce((s, a) => s + a.length, 0), [columnRules]);
  const columnsWithRules = useMemo(() => Object.keys(columnRules).filter(k => (columnRules[k] || []).length > 0).length, [columnRules]);
  const filteredHeaders = useMemo(() => headers.filter(h => h.toLowerCase().includes(searchHeaders.toLowerCase())), [headers, searchHeaders]);
  const currentRules = useMemo(() => selectedHeader ? (columnRules[selectedHeader] || []) : [], [selectedHeader, columnRules]);
  const payload = useMemo(() => buildPayload(uploadId, columnRules), [uploadId, columnRules]);

  // ── Loading / error states ──
  if (loadingUpload) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#3F4D67] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading file data...</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="px-3 sm:px-6 pt-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-semibold mb-2">Failed to load upload</p>
          <p className="text-red-500 text-sm mb-4">{fetchError}</p>
          <Link to="/" className="inline-flex items-center gap-2 bg-[#3F4D67] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#344057] transition-colors">
            ← Back to Upload
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="px-2 sm:px-6 pt-4 pb-2">
        <nav className="flex items-center gap-1 text-sm text-slate-500">
          <Link to="/" className="font-medium text-[#3F4D67] hover:opacity-75 transition-opacity">
            Upload File
          </Link>
          <span className="text-slate-400 px-1">/</span>
          <span className="text-slate-600 font-medium">Configure Rules</span>
        </nav>
      </div>

      <div className="px-3 sm:px-6 pb-6">
        {/* Header row */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Configure Validation Rules</h2>
            <p className="text-slate-500 text-sm mt-0.5">Add rules to validate your data. Rules are applied per column.</p>
          </div>
          <button onClick={handleRunValidation} disabled={submitting || totalRules === 0}
            className="btn-primary py-2.5 px-6 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center">
            <PlayIcon size={16} />
            {submitting ? 'Running...' : 'Run Validation'}
          </button>
        </div>

        {/* File info bar */}
        <div className="flex items-center gap-3 px-3 sm:px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm mb-6">
          <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
            <FileSpreadsheetIcon size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-slate-800 truncate block">{filename}</span>
            <span className="text-xs text-slate-400">
              {totalRows > 0 ? `${totalRows.toLocaleString()} rows` : 'Counting rows…'} &middot; {headers.length} columns
            </span>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-700 border border-slate-200 hover:border-red-200 bg-red-50 hover:bg-red-300 rounded-lg px-2 sm:px-3 py-1.5 transition-all flex-shrink-0"
          >
            <UploadCloudIcon size={12} /> <span className="hidden sm:inline">Change File</span>
          </Link>
        </div>

        {/* Rule Reuse Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {/* Load from previous report */}
          <div className="relative">
            <button
              onClick={() => setShowLoadPanel(p => !p)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#3F4D67] border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 rounded-lg px-3 py-1.5 transition-all cursor-pointer"
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Load Previous Rules
              <span className={`transition-transform duration-200 ${showLoadPanel ? 'rotate-180' : ''}`}>
                <ChevronDownIcon size={12} />
              </span>
            </button>

            {showLoadPanel && (
              <div className="absolute top-full left-0 mt-1.5 z-50 w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Saved Feeds</span>
                  <button onClick={() => setShowLoadPanel(false)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer p-0">
                    <XIcon size={12} />
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {savedFeeds.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">
                      No saved feeds yet. Use <span className="font-semibold text-slate-500">Save Rules</span> to save a feed.
                    </div>
                  ) : savedFeeds.map(feed => (
                    <div key={feed._id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-b-0">
                      <div className="w-7 h-7 rounded-lg bg-[#3F4D67]/10 flex items-center justify-center flex-shrink-0">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#3F4D67" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{feed.feedName}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {fmtDate(feed.createdAt)} &middot; {feed.totalRules} rule{feed.totalRules !== 1 ? 's' : ''} &middot; {feed.totalColumns} col{feed.totalColumns !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => handleLoadSavedFeed(feed)}
                        className="flex-shrink-0 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg px-2.5 py-1 transition-all cursor-pointer"
                      >
                        Load
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Save Rules */}
          <button
            onClick={() => { if (totalRules > 0) setSaveStep('confirm'); else toast.warning('Add at least one rule before saving.'); }}
            disabled={totalRules === 0}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#3F4D67] hover:bg-[#344057] border border-[#3F4D67] rounded-lg px-3 py-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Rules
          </button>

          {/* Export Rules */}
          <button
            onClick={handleExportRules}
            disabled={totalRules === 0}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#3F4D67] border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 rounded-lg px-3 py-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <DownloadIcon size={13} />
            Export Rules
          </button>

          {/* Import Rules */}
          {/* <button
            onClick={() => importInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#3F4D67] border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 rounded-lg px-3 py-1.5 transition-all cursor-pointer"
          >
            <UploadIcon size={13} />
            Import Rules
          </button> */}
          {/* <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImportRules} /> */}
        </div>

        {/* Columns + Rule editor */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
          {/* Column list */}
          <div className="card overflow-hidden lg:sticky lg:top-4">
            <div className="px-4 py-4 bg-[#3F4D67]">
              <div className="flex items-center gap-2 mb-3">
                <ColumnsIcon size={20} className="text-white" />
                <span className="font-bold text-sm text-white">Columns</span>
                <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{headers.length}</span>
              </div>
              <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60"><SearchIcon size={12} /></div>
                <input type="text" placeholder="Search columns..." value={searchHeaders}
                  onChange={e => setSearchHeaders(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-white/15 border border-white/25 rounded-xl text-white placeholder-white/50 text-xs focus:outline-none focus:ring-2 focus:ring-white/40" />
              </div>
            </div>
            <div className="max-h-48 sm:max-h-64 lg:max-h-[500px] overflow-y-auto">
              {filteredHeaders.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No columns found</div>
              ) : filteredHeaders.map(h => {
                const ruleCount = (columnRules[h] || []).length;
                const isSelected = selectedHeader === h;
                return (
                  <div key={h}
                    onClick={() => { setSelectedHeader(h); setAddingRule(false); setNewRuleType('has_empty'); setNewRuleConfig({ required: true }); handleCancelEdit(); }}
                    className={`flex items-center justify-between px-3.5 py-3 cursor-pointer transition-all duration-150 border-b border-slate-50 ${isSelected ? 'bg-[#6C7685] text-white' : ruleCount > 0 ? 'bg-[#3F4D67]/8 text-[#3F4D67] hover:bg-[#3F4D67]/12' : 'text-slate-700 hover:bg-slate-50'}`}>
                    <div className={`text-xs truncate flex-1 min-w-0 font-medium ${isSelected ? 'font-bold' : ''}`}>{h}</div>
                    {ruleCount > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black flex-shrink-0 ml-2 ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-700 text-white'}`}>
                        {ruleCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {totalRules > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                <div className="text-xs text-slate-500 font-semibold">
                  <span className="text-blue-600 font-black">{totalRules}</span> rule{totalRules !== 1 ? 's' : ''} on{' '}
                  <span className="text-blue-600 font-black">{columnsWithRules}</span> column{columnsWithRules !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>

          {/* Rule editor */}
          <div className="flex flex-col gap-4">
            {!selectedHeader ? (
              <div className="card p-16 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <ColumnsIcon size={32} />
                </div>
                <p className="text-slate-500 text-sm font-medium">Select a column from the left panel to configure rules.</p>
              </div>
            ) : (
              <>
                <div className="card p-0 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-slate-500 to-slate-400" />
                  <div className="p-5 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-lg font-black text-slate-800">{selectedHeader}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {currentRules.length > 0
                          ? <><span className="text-blue-600 font-bold">{currentRules.length}</span> rule{currentRules.length !== 1 ? 's' : ''} configured</>
                          : 'No rules yet — add one below'}
                      </p>
                    </div>
                    <button onClick={() => { setAddingRule(true); setNewRuleType('has_empty'); setNewRuleConfig({ required: true }); handleCancelEdit(); }}
                      className="btn-primary">
                      <PlusIcon size={14} /> Add Rule
                    </button>
                  </div>
                </div>

                {currentRules.length > 0 && (
                  <div className="card p-5">
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">Configured Rules</div>
                    <div className="flex flex-col gap-3">
                      {currentRules.map((rule, idx) => {
                        const rt = RULE_TYPES.find(r => r.value === rule.type);
                        const isEditing = editingRule?.header === selectedHeader && editingRule?.idx === idx;
                        return (
                          <div key={idx} className={`rounded-xl border p-3.5 transition-colors ${isEditing ? 'border-blue-200 bg-blue-50/40' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center border rounded-lg px-2.5 py-0.5 text-xs font-bold ${rt?.color || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                  {rt?.label || rule.type}
                                </span>
                                <span className="text-xs text-slate-400">{rt?.desc}</span>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {!isEditing ? (
                                  <button onClick={() => handleStartEdit(selectedHeader, idx, rule.config)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors border-none bg-transparent cursor-pointer"
                                    title="Edit rule">
                                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                ) : (
                                  <button onClick={handleCancelEdit}
                                    className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-colors border-none bg-transparent cursor-pointer"
                                    title="Cancel edit">
                                    <XIcon size={13} />
                                  </button>
                                )}
                                <button onClick={() => { handleCancelEdit(); handleRemoveRule(selectedHeader, idx); }}
                                  className="btn-danger p-1.5 rounded-lg">
                                  <XIcon size={12} />
                                </button>
                              </div>
                            </div>

                            {isEditing && (
                              <div className="mt-3">
                                <div className="bg-white rounded-xl p-3.5 border border-slate-100 mb-3">
                                  <RuleFields ruleType={rule.type} value={editingConfig} onChange={setEditingConfig}
                                    columnName={selectedHeader} headers={headers} />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={handleSaveRuleEdit} className="flex-1 btn-primary justify-center py-2">Save Changes</button>
                                  <button onClick={handleCancelEdit} className="btn-secondary px-4 py-2">Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {currentRules.length === 0 && !addingRule && (
                  <div className="card p-12 text-center border-2 border-dashed border-slate-200">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-300">
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-slate-400 text-sm font-medium mb-4">No rules yet for this column</p>
                    <button onClick={() => { setAddingRule(true); setNewRuleType('has_empty'); setNewRuleConfig({ required: true }); }}
                      className="btn-secondary mx-auto">
                      <PlusIcon size={14} /> Add First Rule
                    </button>
                  </div>
                )}

                {addingRule && (
                  <div className="card border-2 border-blue-200 p-0">
                    <div className="h-1 bg-gradient-to-r from-slate-500 via-slate-400 to-cyan-400" />
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-sm font-black text-slate-800">Add New Rule</h3>
                          <p className="text-xs text-slate-400 mt-0.5">for column: <span className="font-bold text-blue-600">{selectedHeader}</span></p>
                        </div>
                        <button onClick={() => setAddingRule(false)}
                          className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-lg flex items-center justify-center transition-colors border-none cursor-pointer">
                          <XIcon size={14} />
                        </button>
                      </div>
                      <div className="mb-4">
                        <label className={labelCls}>Rule Type</label>
                        <Select
                          options={RULE_TYPES.map(rt => ({ value: rt.value, label: rt.label, desc: rt.desc, color: rt.color }))}
                          value={RULE_TYPES.find(r => r.value === newRuleType)
                            ? { value: newRuleType, label: RULE_TYPES.find(r => r.value === newRuleType)?.label, desc: RULE_TYPES.find(r => r.value === newRuleType)?.desc, color: RULE_TYPES.find(r => r.value === newRuleType)?.color }
                            : null}
                          onChange={o => { setNewRuleType(o.value); setNewRuleConfig({ required: true }); }}
                          formatOptionLabel={o => (
                            <div className="flex items-center justify-between gap-3 py-0.5">
                              <span className="font-semibold text-slate-800 text-sm">{o.label}</span>
                              <span className="text-xs text-slate-400 truncate">{o.desc}</span>
                            </div>
                          )}
                          className="text-sm"
                          styles={selectStyles}
                        />
                      </div>

                      {(() => {
                        const rt = RULE_TYPES.find(r => r.value === newRuleType);
                        return rt ? (
                          <div className="mb-4 flex items-center gap-2.5 px-3.5 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                            <span className={`inline-flex items-center border rounded-lg px-2.5 py-0.5 text-xs font-bold flex-shrink-0 ${rt.color}`}>{rt.label}</span>
                            <span className="text-xs text-slate-600">{rt.desc}</span>
                          </div>
                        ) : null;
                      })()}

                      <div className="mb-5 bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <RuleFields ruleType={newRuleType} value={newRuleConfig} onChange={setNewRuleConfig}
                          columnName={selectedHeader} headers={headers} />
                      </div>
                      <div className="flex gap-3">
                        <button onClick={handleAddRule} className="flex-1 btn-primary justify-center py-2.5">
                          <PlusIcon size={14} /> Add Rule
                        </button>
                        <button onClick={() => setAddingRule(false)} className="btn-secondary px-4 py-2.5">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {totalRules > 0 && (
              <div className="card overflow-hidden">
                <button onClick={() => setJsonOpen(!jsonOpen)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors bg-transparent border-none cursor-pointer">
                  <div className="flex items-center gap-2 text-slate-600">
                    <CodeIcon size={15} />
                    <span>&#123; &#125; Preview Rules JSON</span>
                    <span className="badge-info">{totalRules} rule{totalRules !== 1 ? 's' : ''}</span>
                  </div>
                  <span className={`text-slate-400 transition-transform duration-200 ${jsonOpen ? 'rotate-180' : ''}`}>
                    <ChevronDownIcon size={15} />
                  </span>
                </button>
                {jsonOpen && (
                  <div className="px-5 pb-5">
                    <pre className="bg-slate-900 text-emerald-400 rounded-2xl p-4 text-xs overflow-x-auto font-mono leading-relaxed max-h-64">
                      {JSON.stringify(payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Save Rules Modal ── */}
      {saveStep !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Top accent */}
            <div className="h-1 bg-gradient-to-r from-[#3F4D67] to-slate-400" />

            {saveStep === 'confirm' ? (
              /* ── Step 1: Confirmation ── */
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
                      You have <span className="font-bold text-[#3F4D67]">{totalRules} rule{totalRules !== 1 ? 's' : ''}</span> across{' '}
                      <span className="font-bold text-[#3F4D67]">{columnsWithRules} column{columnsWithRules !== 1 ? 's' : ''}</span>.
                      Saving them lets you reuse this rule set for future files.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSaveStep(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors bg-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setSaveStep('name')}
                    className="flex-1 py-2.5 rounded-xl bg-[#3F4D67] hover:bg-[#344057] text-white text-sm font-semibold transition-colors cursor-pointer border-none"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            ) : (
              /* ── Step 2: Feed Name Input ── */
              <div className="p-6">
                <div className="mb-5">
                  <h3 className="text-base font-bold text-slate-800 mb-1">Name This Feed</h3>
                  <p className="text-sm text-slate-500">Enter a descriptive name so you can find these rules later.</p>
                </div>
                <div className="mb-5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                    Feed Name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={feedName}
                    onChange={e => setFeedName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmSave(); if (e.key === 'Escape') setSaveStep(null); }}
                    placeholder="e.g. Product Catalog Rules"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    maxLength={100}
                  />
                  <p className="text-xs text-slate-400 mt-1.5">{feedName.length}/100 characters</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setSaveStep('confirm'); setFeedName(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors bg-white cursor-pointer"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleConfirmSave}
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
      {(savingRules || submitting) && (
        <div className="h-screen fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center cursor-not-allowed">
          <div className="bg-white px-4 py-3 rounded-xl shadow text-sm font-medium text-slate-600 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            QA Running...
          </div>
        </div>
      )}
    </div>
  );
}
