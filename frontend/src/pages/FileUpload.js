import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import Select from 'react-select';
import { toast } from 'react-toastify';
import { uploadFile, runValidation } from '../services/api';
import { ChevronDownIcon, CodeIcon, ColumnsIcon, FileSpreadsheetIcon, HomeIcon, PlayIcon, PlusIcon, SearchIcon, UploadCloudIcon, XIcon } from '../icon/icon';
import { COND_OPTIONS, DATE_FORMAT_OPTIONS, formatFileSize, getFileExtension, matchOpts, modeOpts, opts, RULE_TYPES } from '../utlis/utlis';



// --------------------------------------  Shared styles (updated with light color variants) ------------------------------------
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
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  }),
  menuList: (base) => ({
    ...base,
    backgroundColor: '#FFFFFF',
    padding: '4px',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#EFF6FF' : state.isFocused ? '#F1F5F9' : 'transparent',
    color: '#1E293B',
    cursor: 'pointer',
    borderRadius: '8px',
    '&:active': {
      backgroundColor: '#DBEAFE',
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: '#1E293B',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#94A3B8',
  }),
  dropdownIndicator: (base) => ({
    ...base,
    color: '#64748B',
    '&:hover': { color: '#3B82F6' },
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  input: (base) => ({
    ...base,
    color: '#1E293B',
  }),
};

// ----------------------------------------------- Toggle (unchanged) -----------------------------------------------
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

// ---------------------------------- RuleFields (unchanged) ------------------------------------------------------
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
      // Handle multiple data types selection
      const selectedTypes = Array.isArray(value.type) ? value.type : (value.type ? [value.type] : ['str']);

      const dataTypeOptions = opts; // Your existing options array

      const handleDataTypeChange = (selectedOptions) => {
        const types = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
        update('type', types);
      };

      return (
        <div>
          <label className={labelCls}>Expected Data Types (multiple allowed)</label>
          <Select
            isMulti
            options={dataTypeOptions}
            value={dataTypeOptions.filter(opt => selectedTypes.includes(opt.value))}
            onChange={handleDataTypeChange}
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
              multiValue: (base) => ({
                ...base,
                backgroundColor: '#EFF6FF',
                borderRadius: '8px',
                padding: '2px 6px',
              }),
              multiValueLabel: (base) => ({
                ...base,
                color: '#1E40AF',
                fontSize: '12px',
                fontWeight: '500',
              }),
              multiValueRemove: (base) => ({
                ...base,
                color: '#3B82F6',
                '&:hover': {
                  backgroundColor: '#DBEAFE',
                  color: '#1E3A8A',
                },
              }),
            }}
            className="text-sm"
            placeholder="Select one or more data types..."
            noOptionsMessage={() => "No data types available"}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Select multiple data types that are acceptable for this column.
          </p>
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
      const dropdownValue = isCustom ? DATE_FORMAT_OPTIONS.find(o => o.value === '__custom__') : (DATE_FORMAT_OPTIONS.find(o => o.value === (value.format || '')) || null);

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
              <input
                type="text"
                className={`${inputCls} font-mono`}
                value={value.format || ''}
                placeholder="e.g. YYYY-MM-DD"
                onChange={e => update('format', e.target.value)}
                autoFocus
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Tokens: YYYY MM DD HH mm ss
              </p>
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

    case 'cell_contains': {
      return (
        <div className="flex flex-col gap-3">
          <div><label className={labelCls}>Regex Pattern</label>
            <input type="text" className={inputCls} value={value.pattern || ''} placeholder="e.g. ^[A-Z].*" onChange={e => update('pattern', e.target.value)} /></div>
          <div><label className={labelCls}>Match Mode</label>
            <Select options={matchOpts} value={matchOpts.find(o => o.value === String(value.contains !== false))} onChange={o => update('contains', o.value === 'true')} styles={selectStyles} className="text-sm" /></div>
        </div>
      );
    }

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

      // Live plain-English preview
      const filledDeps = dependents.filter(d => d.col);
      const preview = triggerCol
        ? `IF "${triggerCol}" ${condLabel(triggerCondition, value.triggerEqualsValue)} → THEN validate: ${filledDeps.length ? filledDeps.map(d => `"${d.col}" ${condLabel(d.conditionType, d.equalsValue)}`).join(', ') : '(no dependent columns yet)'}`
        : null;

      return (
        <div className="flex flex-col gap-0">
          {/* Plain-English preview */}
          {preview && (
            <div className="mb-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-400 uppercase tracking-wide text-[10px] block mb-0.5">Rule Preview</span>
              {preview}
            </div>
          )}

          {/* ── IF block ─────────────────────────────────────────── */}
          <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest">IF</span>
              <span className="text-xs text-blue-700 font-medium">Trigger — this condition must be true</span>
            </div>
            <Select
              options={headerOptions}
              value={headerOptions.find(o => o.value === triggerCol) || null}
              onChange={o => onChange({ ...value, triggerCol: o.value })}
              styles={selectStyles} placeholder="Select trigger column..." className="text-sm"
            />
            <Select
              options={COND_OPTIONS}
              value={COND_OPTIONS.find(o => o.value === triggerCondition)}
              onChange={o => onChange({ ...value, triggerCondition: o.value })}
              styles={selectStyles} className="text-sm"
            />
            {triggerCondition === 'equals' && (
              <input type="text" className={inputCls} value={value.triggerEqualsValue || ''}
                placeholder="Expected value" onChange={e => update('triggerEqualsValue', e.target.value)} />
            )}
          </div>

          {/* ── Connector arrow ───────────────────────────────────── */}
          <div className="flex items-center justify-center py-1 select-none">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-px h-3 bg-slate-300" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-0.5 bg-white border border-slate-200 rounded-full">
                THEN
              </span>
              <div className="w-px h-3 bg-slate-300" />
            </div>
          </div>

          {/* ── THEN block ───────────────────────────────────────── */}
          <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest">THEN</span>
              <span className="text-xs text-emerald-700 font-medium">These columns are validated only when IF fires</span>
            </div>
            {dependents.map((dep, idx) => (
              <div key={idx} className="flex items-start gap-2">
                {/* Row number badge */}
                <span className="mt-2 w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <Select
                    options={headerOptions}
                    value={headerOptions.find(o => o.value === dep.col) || null}
                    onChange={o => updateDep(idx, 'col', o.value)}
                    styles={selectStyles} placeholder="Select column..." className="text-sm"
                  />
                </div>
                <div className="w-44 flex-shrink-0">
                  <Select
                    options={COND_OPTIONS}
                    value={COND_OPTIONS.find(o => o.value === (dep.conditionType || 'not_empty'))}
                    onChange={o => updateDep(idx, 'conditionType', o.value)}
                    styles={selectStyles} className="text-sm"
                  />
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

// ----------------------------------------------- validateRuleConfig — returns an error string or null ---------------------------------
function validateRuleConfig(ruleType, config) {
  switch (ruleType) {
    case 'has_empty':
      return null; // No config needed, always valid
    // case 'data_type':
    //   return null;
    case 'data_type': {
      const types = Array.isArray(config.type) ? config.type : (config.type ? [config.type] : ['str']);
      if (types.length === 0) {
        return 'Data Type: please select at least one data type.';
      }
      return null;
    }

    case 'data_length': {
      const mode = config.mode || 'range';

      if (mode === 'fix_length' || mode === 'specific') {
        if (config.length === undefined || config.length === null || config.length === '') {
          return 'Data Length: please enter an exact length.';
        }
        if (Number(config.length) < 1) {
          return 'Data Length: exact length must be at least 1.';
        }
      } else {
        const hasMin = config.min !== undefined && config.min !== '';
        const hasMax = config.max !== undefined && config.max !== '';

        // 🔒 Force both values
        if (!hasMin || !hasMax) {
          return 'Data Length: both Min and Max values are required.';
        }

        const min = Number(config.min);
        const max = Number(config.max);

        if (min < 0) return 'Data Length: Min length cannot be negative.';
        if (max < 0) return 'Data Length: Max length cannot be negative.';

        // 🔥 Strict condition
        if (max <= min) {
          return 'Data Length: Max length must be greater than Min length.';
        }
      }

      return null;
    }

    case 'greater_than':
      if (config.threshold === '' || config.threshold === undefined) {
        return 'Greater Than: please enter a threshold value.';
      }
      return null;

    case 'less_than':
      if (config.threshold === '' || config.threshold === undefined || config.threshold < 0) {
        return 'Less Than: please enter a valid threshold value.';
      }
      return null;

    case 'in_between': {
      const hasMin = config.min !== '' && config.min !== undefined;
      const hasMax = config.max !== '' && config.max !== undefined;
      if (!hasMin || !hasMax) return 'In Between: both Minimum and Maximum values are required.';
      if (Number(config.min) >= Number(config.max)) {
        return 'In Between: Minimum must be less than Maximum.';
      }
      return null;
    }

    case 'date_format': {
      const fmt = (config.format || '').trim();
      if (!fmt) return 'Date Format: please enter a format string.';
      if (!['YYYY', 'YY', 'MM', 'DD', 'HH', 'mm', 'ss'].some(t => fmt.includes(t)))
        return 'Date Format: must include a valid token like YYYY, MM, or DD.';
      return null;
    }

    case 'fix_header': {
      const vals = (config.values || '').split(',').map(v => v.trim()).filter(Boolean);
      if (vals.length === 0) return 'Fixed Values: enter at least one allowed value.';
      return null;
    }

    case 'cell_contains':
      if (!config.pattern || !config.pattern.trim()) {
        return 'Cell Contains: please enter a regex pattern.';
      }
      try { new RegExp(config.pattern); } catch {
        return 'Cell Contains: invalid regex pattern.';
      }
      return null;

    case 'cell_value_start_end_with':
      if (!config.start_with?.trim() && !config.end_with?.trim()) {
        return 'Start/End With: enter at least a "Starts With" or "Ends With" value.';
      }
      return null;

    case 'data_redundant':
      if (config.threshold === '' || config.threshold === undefined) {
        return 'Data Redundancy: please enter a max allowed redundancy percentage.';
      }
      if (Number(config.threshold) < 0 || Number(config.threshold) > 100) {
        return 'Data Redundancy: threshold must be between 0 and 100.';
      }
      return null;

    case 'not_match_found':
      if (!config.value || !config.value.trim()) {
        return 'Not Match Found: please enter a forbidden value.';
      }
      return null;

    case 'depend_header': {
      const trigger = (config.triggerCol || '').trim();
      // if (!trigger) return 'Dependent Column: select a trigger (IF) column.';
      if (config.triggerCondition === 'equals' && !config.triggerEqualsValue?.trim()) {
        return 'Dependent Column: enter the expected value for the trigger condition.';
      }
      const deps = (config.dependents || []).filter(d => d.col?.trim());
      if (deps.length === 0) return 'Dependent Column: add at least one dependent (THEN) column.';
      const dupDep = deps.find(d => d.col.trim() === trigger);
      if (dupDep) return `Dependent Column: "${dupDep.col}" cannot be both the trigger and a dependent.`;
      const depCols = deps.map(d => d.col.trim());
      if (new Set(depCols).size !== depCols.length) {
        return 'Dependent Column: duplicate dependent columns are not allowed.';
      }
      const missingEquals = deps.find(d => d.conditionType === 'equals' && !d.equalsValue?.trim());
      if (missingEquals) {
        return `Dependent Column: enter the expected value for "${missingEquals.col}".`;
      }
      return null;
    }

    default:
      return null;
  }
}

// ------------------------  buildPayload ----------------------------------------------
function buildPayload(uploadId, columnRules) {
  const rules = {};
  Object.entries(columnRules).forEach(([col, ruleList]) => {
    if (!ruleList?.length) return;
    const merged = {};
    ruleList.forEach(({ type, config }) => {
      switch (type) {
        case 'has_empty': merged.has_empty = String(config.required !== false); break;
        // case 'data_type': merged.data_type = config.type || 'str'; break;
        case 'data_type': {
          const types = Array.isArray(config.type) ? config.type : [config.type || 'str'];

          merged.data_type = types
            .map(t => String(t).toLowerCase().trim())
            .filter(Boolean)
            .join(','); // no space (cleaner)

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
          // Convert friendly tokens (YYYY MM DD HH mm ss) → Python strftime (%Y %m %d %H %M %S)
          const strftime = (config.format || '').replace(/YYYY/g, '%Y').replace(/YY/g, '%y').replace(/MM/g, '%m').replace(/DD/g, '%d').replace(/HH/g, '%H').replace(/mm/g, '%M').replace(/ss/g, '%S');
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

// ---------------------------------------  Main component  ---------------------------------------
export default function FileUpload() {
  const navigate = useNavigate();
  const rowCountPollRef = useRef(null);

  // Stop polling when component unmounts
  useEffect(() => () => clearInterval(rowCountPollRef.current), []);

  // Upload state
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  // Uploaded file data
  const [uploadId, setUploadId] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [filename, setFilename] = useState('');
  const [totalRows, setTotalRows] = useState(0);

  // Rule configuration state
  const [selectedHeader, setSelectedHeader] = useState(null);
  const [columnRules, setColumnRules] = useState({});
  const [addingRule, setAddingRule] = useState(false);
  const [newRuleType, setNewRuleType] = useState('has_empty');
  const [newRuleConfig, setNewRuleConfig] = useState({ required: true });
  const [submitting, setSubmitting] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [searchHeaders, setSearchHeaders] = useState('');

  // Dropzone
  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error(`File rejected: ${rejected[0].errors?.[0]?.message || 'Invalid file type'}`);
      return;
    }
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setUploadError(null);
      setProgress(0);
      // Reset config when a new file is selected
      setUploadId(null);
      setHeaders([]);
      setColumnRules({});
      setSelectedHeader(null);
      setAddingRule(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/json': ['.json'],
      'text/json': ['.json'],
    },
    multiple: false,
  });

  // ?  Upload handler + API CALL
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await uploadFile(formData, pct => setProgress(pct));
      const data = res?.data;
      const id = data?.uploadId || data?._id;
      setUploadId(id);
      const hdrs = data?.headers || [];
      setHeaders(hdrs);
      setFilename(data?.filename || file.name);
      setTotalRows(data?.totalRows || 0);
      setSelectedHeader(hdrs[0] || null);
      setColumnRules({});
      toast.success('File uploaded! Now configure your rules.');
    } catch (err) {
      const msg = err.displayMessage || 'Upload failed. Please try again.';
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    clearInterval(rowCountPollRef.current);
    setFile(null);
    setUploadError(null);
    setProgress(0);
    setUploadId(null);
    setHeaders([]);
    setColumnRules({});
    setSelectedHeader(null);
    setAddingRule(false);
  };

  //  adding rules
  const handleAddRule = useCallback(() => {
    if (!selectedHeader) return;
    if ((columnRules[selectedHeader] || []).find(r => r.type === newRuleType)) {
      toast.warning(`Rule "${newRuleType}" already added for this column.`);
      return;
    }
    const validationError = validateRuleConfig(newRuleType, newRuleConfig);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setColumnRules(prev => ({ ...prev, [selectedHeader]: [...(prev[selectedHeader] || []), { type: newRuleType, config: { ...newRuleConfig } }] }));
    setNewRuleConfig({ required: true });
    setNewRuleType('has_empty');
    setAddingRule(false);
    toast.success(`Rule added to "${selectedHeader}"`);
  }, [selectedHeader, columnRules, newRuleType, newRuleConfig]);

  //  removing rules
  const handleRemoveRule = useCallback((header, index) => {
    setColumnRules(prev => ({ ...prev, [header]: prev[header].filter((_, i) => i !== index) }));
  }, []);


  //   validation check  + API CALL
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

  const totalRules = useMemo(() => Object.values(columnRules).reduce((s, a) => s + a.length, 0),
    [columnRules]
  );
  const columnsWithRules = useMemo(() => Object.keys(columnRules).filter(k => (columnRules[k] || []).length > 0).length,
    [columnRules]
  );
  const filteredHeaders = useMemo(() => headers.filter(h => h.toLowerCase().includes(searchHeaders.toLowerCase())),
    [headers, searchHeaders]
  );
  const currentRules = useMemo(() => selectedHeader ? (columnRules[selectedHeader] || []) : [],
    [selectedHeader, columnRules]
  );
  const payload = useMemo(() => buildPayload(uploadId, columnRules),
    [uploadId, columnRules]
  );


  return (
    <div>

      {/* ============================= BREADCRUMB ============================= */}
      <div className="px-2 sm:px-6 pt-4 pb-2">
        <nav className="flex items-center gap-1 text-sm text-slate-500">
          {!uploadId ? (
            <span className="text-slate-600 font-medium">Upload File</span>
          ) : (
            <>
              <button onClick={handleReset} className="font-medium text-[#3F4D67] hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer p-0 text-sm">
                Upload File
              </button>
              <span className="text-slate-400 px-1">/</span>
              <span className="text-slate-600 font-medium">Configure Rules</span>
            </>
          )}
        </nav>
      </div>
      {/* ============================= CONTENT ============================= */}
      <div className="px-3 sm:px-6 pb-6">
        {/* ============================= UPLOAD SECTION ============================= */}
        <div className="mb-6">
          {/* ── COLLAPSED: file already uploaded ── */}

          {/* ── EXPANDED: no file uploaded yet ── */}
          {!uploadId && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden  mt-4">
              {/* Top bar */}
              <div className="h-1 bg-gradient-to-r from-slate-500 via-slate-400 to-slate-400" />
              {/* Header */}
              <div className="px-6 pt-3 pb-1 flex items-center justify-between border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Upload Data File</h2>
                  <p className="text-xs text-slate-400 mt-0.5">CSV, Excel or JSON</p>
                </div>
                <div className="flex gap-1.5">
                  {['.csv', '.xlsx', '.xls', '.json'].map(ext => (
                    <span key={ext} className="bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-600">{ext}</span>
                  ))}
                </div>
              </div>

              {/* Dropzone */}
              <div className="p-6">
                <div {...getRootProps({
                  className: [
                    'border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-all duration-200 outline-none',
                    isDragReject ? 'border-red-400 bg-red-50' : isDragActive ? 'border-[#3F4D67] bg-[#3F4D67]/5' : 'border-slate-200 hover:border-[#3F4D67]/40 hover:bg-slate-50',
                  ].join(' '),
                })}>
                  <input {...getInputProps()} />
                  {isDragReject ? (
                    <div>
                      <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-red-100 flex items-center justify-center text-red-500">
                        <XIcon size={18} />
                      </div>
                      <p className="text-sm font-semibold text-red-500">Invalid file type</p>
                      <p className="text-xs text-red-400 mt-0.5">Only CSV, Excel, and JSON files accepted</p>
                    </div>
                  ) : isDragActive ? (
                    <div>
                      <div className="w-8 h-8 mx-auto mb-2 rounded-xl bg-[#3F4D67] flex items-center justify-center text-white">
                        <UploadCloudIcon size={18} />
                      </div>
                      <p className="text-sm font-semibold text-blue-600">Drop to upload</p>
                    </div>
                  ) : (
                    <div>
                      <div className="w-8 h-8 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                        <UploadCloudIcon size={18} />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mb-0.5">Drag &amp; drop your file here</p>
                      <p className="text-xs text-slate-400 mb-3">or click to browse</p>
                      <span className="inline-flex items-center gap-1.5 bg-[#3F4D67] hover:bg-[#344057] text-white rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors">
                        Browse Files
                      </span>
                    </div>
                  )}
                </div>

                {/* Selected file preview (before upload) */}
                {file && !uploading && !uploadId && (
                  <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                      <FileSpreadsheetIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{file.name}</div>
                      <div className="text-xs text-slate-400">{formatFileSize(file.size)} &middot; {getFileExtension(file.name)}</div>
                    </div>
                    <button onClick={handleReset} className="text-slate-400 hover:text-red-500 transition-colors">
                      <XIcon size={14} />
                    </button>
                  </div>
                )}

                {/* Upload progress */}
                {uploading && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-slate-600 truncate max-w-[70%]">{file?.name}</span>
                      <span className="text-xs font-bold text-blue-600">{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="progress-shimmer h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      {progress < 100 ? 'Uploading...' : 'Processing on server...'}
                    </p>
                  </div>
                )}

                {/* Error */}
                {uploadError && (
                  <div className="mt-4 p-3 bg-red-50 rounded-xl flex items-center gap-2 text-red-700 text-xs">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Upload button (only if file selected and not yet uploaded) */}
                {file && !uploading && !uploadId && (
                  <div className="mt-5 flex gap-3">
                    <button onClick={handleUpload}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#3F4D67] hover:bg-[#344057] text-white font-semibold text-sm rounded-xl py-2.5 transition-colors cursor-pointer border-none">
                      <UploadCloudIcon size={16} /> Upload
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ============================= CONFIGURATION SECTION (only after upload) ============================= */}
        {uploadId && (
          <div>
            {/* Header with back to upload? Not needed because upload is always visible */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Configure Validation Rules</h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  Add rules to validate your data. Rules are applied per column.
                </p>
              </div>
              <button onClick={handleRunValidation} disabled={submitting || totalRules === 0}
                className="btn-primary py-2.5 px-6 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center">
                <PlayIcon size={16} />
                {submitting ? 'Running...' : 'Run Validation'}
              </button>
            </div>

            {uploadId && (
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
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-700 border border-slate-200 hover:border-red-200 bg-red-50 hover:bg-red-300 rounded-lg px-2 sm:px-3 py-1.5 transition-all flex-shrink-0 cursor-pointer"
                >
                  <UploadCloudIcon size={12} /> <span className="hidden sm:inline">Change File</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
              {/* Column list */}
              <div className="card overflow-hidden lg:sticky lg:top-4">
                <div className="px-4 py-4 bg-[#3F4D67]">
                  <div className="flex items-center gap-2 mb-3">
                    {/* <ColumnsIcon size={14} className="text-white" /> */}
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
                        onClick={() => { setSelectedHeader(h); setAddingRule(false); setNewRuleType('has_empty'); setNewRuleConfig({ required: true }); }}
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

              {/* Rule editor (unchanged) */}
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
                            {currentRules.length > 0 ? <><span className="text-blue-600 font-bold">{currentRules.length}</span> rule{currentRules.length !== 1 ? 's' : ''} configured</> : 'No rules yet — add one below'}
                          </p>
                        </div>
                        <button onClick={() => { setAddingRule(true); setNewRuleType('has_empty'); setNewRuleConfig({ required: true }); }}
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
                            return (
                              <div key={idx} className="bg-slate-50 rounded-xl border border-slate-100 p-3.5">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center border rounded-lg px-2.5 py-0.5 text-xs font-bold ${rt?.color || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                      {rt?.label || rule.type}
                                    </span>
                                    <span className="text-xs text-slate-400">{rt?.desc}</span>
                                  </div>
                                  <button onClick={() => handleRemoveRule(selectedHeader, idx)}
                                    className="btn-danger p-1.5 rounded-lg flex-shrink-0">
                                    <XIcon size={12} />
                                  </button>
                                </div>
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
                              value={RULE_TYPES.find(r => r.value === newRuleType) ? { value: newRuleType, label: RULE_TYPES.find(r => r.value === newRuleType)?.label, desc: RULE_TYPES.find(r => r.value === newRuleType)?.desc, color: RULE_TYPES.find(r => r.value === newRuleType)?.color } : null}
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

                          {/* Rule description banner */}
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
        )}
      </div>
    </div>
  );
}