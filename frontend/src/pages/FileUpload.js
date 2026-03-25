import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import Select from 'react-select';
import { toast } from 'react-toastify';
import { uploadFile, runValidation } from '../services/api';
import { ChevronDownIcon, CodeIcon, ColumnsIcon, FileSpreadsheetIcon, HomeIcon, PlayIcon, PlusIcon, SearchIcon, UploadCloudIcon, XIcon} from '../icon/icon';
import { formatFileSize, getFileExtension, RULE_TYPES } from '../utlis/utlis';



// ---------------------------------------------------------------------------
// Shared styles (unchanged)
// ---------------------------------------------------------------------------
const inputCls = 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white';
const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5';

const selectStyles = {
  control: (base) => ({
    ...base, borderRadius: '12px', borderColor: '#e2e8f0', padding: '2px',
    boxShadow: 'none', '&:hover': { borderColor: '#cbd5e1' },
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#eff6ff' : 'white',
    color: '#1e293b', cursor: 'pointer',
  }),
  menu: (base) => ({ ...base, zIndex: 9999 }),
};

// ---------------------------------------------------------------------------
// Toggle (unchanged)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// RuleFields (unchanged)
// ---------------------------------------------------------------------------
function RuleFields({ ruleType, value, onChange, columnName, headers = [] }) {
  const update = (key, val) => onChange({ ...value, [key]: val });

  switch (ruleType) {
    case 'has_empty':
      return <Toggle checked={value.required !== false} onChange={v => update('required', v)} label="Required field — no empty values allowed" />;

    case 'data_type': {
      const opts = [
        { value: 'str', label: 'String (str)' }, { value: 'int', label: 'Integer (int)' },
        { value: 'float', label: 'Float / Decimal' }, { value: 'bool', label: 'Boolean (bool)' },
        { value: 'date', label: 'Date' },
      ];
      return (
        <div>
          <label className={labelCls}>Expected Data Type</label>
          <Select options={opts} value={opts.find(o => o.value === (value.type || 'str'))}
            onChange={o => update('type', o.value)} styles={selectStyles} className="text-sm" />
        </div>
      );
    }

    case 'data_length': {
      const modeOpts = [
        { value: 'range', label: 'Min / Max Range' }, { value: 'fix_length', label: 'Exact Length' },
        { value: 'specific', label: 'Specific Length' },
      ];
      return (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelCls}>Length Mode</label>
            <Select options={modeOpts} value={modeOpts.find(o => o.value === (value.mode || 'range'))}
              onChange={o => update('mode', o.value)} styles={selectStyles} className="text-sm" />
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
          onChange={e => update('threshold', e.target.value !== '' ? Number(e.target.value) : '')} /></div>);

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

    case 'date_format':
      return (<div><label className={labelCls}>Date Format String</label>
        <input type="text" className={inputCls} value={value.format || ''} placeholder="e.g. %Y-%m-%d"
          onChange={e => update('format', e.target.value)} />
        <p className="mt-1.5 text-xs text-slate-400">Common: %Y-%m-%d, %d/%m/%Y, %m/%d/%Y</p></div>);

    case 'fix_header':
      return (<div><label className={labelCls}>Allowed Values (comma-separated)</label>
        <input type="text" className={inputCls} value={value.values || ''} placeholder="e.g. Male,Female,Other"
          onChange={e => update('values', e.target.value)} />
        <p className="mt-1.5 text-xs text-slate-400">Only these exact values will be accepted.</p></div>);

    case 'cell_contains': {
      const matchOpts = [
        { value: 'true', label: 'Must match (contains pattern)' },
        { value: 'false', label: 'Must NOT match' },
      ];
      return (
        <div className="flex flex-col gap-3">
          <div><label className={labelCls}>Regex Pattern</label>
            <input type="text" className={inputCls} value={value.pattern || ''} placeholder="e.g. ^[A-Z].*"
              onChange={e => update('pattern', e.target.value)} /></div>
          <div><label className={labelCls}>Match Mode</label>
            <Select options={matchOpts} value={matchOpts.find(o => o.value === String(value.contains !== false))}
              onChange={o => update('contains', o.value === 'true')} styles={selectStyles} className="text-sm" /></div>
        </div>
      );
    }

    case 'cell_value_start_end_with':
      return (
        <div className="flex flex-col gap-3">
          <div><label className={labelCls}>Starts With (optional)</label>
            <input type="text" className={inputCls} value={value.start_with || ''} placeholder="e.g. ID_"
              onChange={e => update('start_with', e.target.value)} /></div>
          <div><label className={labelCls}>Ends With (optional)</label>
            <input type="text" className={inputCls} value={value.end_with || ''} placeholder="e.g. _END"
              onChange={e => update('end_with', e.target.value)} /></div>
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
        <input type="text" className={inputCls} value={value.value || ''} placeholder="e.g. NULL or N/A"
          onChange={e => update('value', e.target.value)} />
        <p className="mt-1.5 text-xs text-slate-400">Validation fails if any cell contains this exact value.</p></div>);

    case 'depend_header': {
      const COND_OPTIONS = [
        { value: 'not_empty', label: 'Not Empty' }, { value: 'empty', label: 'Empty' },
        { value: 'equals', label: 'Must Equal Value' },
      ];
      const headerOptions = headers.map(h => ({ value: h, label: h }));
      const triggerCol = value.triggerCol || columnName || '';
      const triggerCondition = value.triggerCondition || 'not_empty';
      const dependents = value.dependents || [{ col: '', conditionType: 'not_empty', equalsValue: '' }];
      const updateDep = (idx, key, val) => {
        const updated = dependents.map((d, i) => i === idx ? { ...d, [key]: val } : d);
        onChange({ ...value, dependents: updated });
      };
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Trigger Column</label>
            <Select options={headerOptions} value={headerOptions.find(o => o.value === triggerCol) || null}
              onChange={o => onChange({ ...value, triggerCol: o.value })} styles={selectStyles} placeholder="Select trigger column..." className="text-sm" />
            <Select options={COND_OPTIONS} value={COND_OPTIONS.find(o => o.value === triggerCondition)}
              onChange={o => onChange({ ...value, triggerCondition: o.value })} styles={selectStyles} className="text-sm" />
            {triggerCondition === 'equals' && (
              <input type="text" className={inputCls} value={value.triggerEqualsValue || ''}
                placeholder="Expected value" onChange={e => update('triggerEqualsValue', e.target.value)} />
            )}
          </div>
          <div>
            <label className={labelCls}>Dependent Columns</label>
            <div className="flex flex-col gap-2">
              {dependents.map((dep, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Select options={headerOptions} value={headerOptions.find(o => o.value === dep.col) || null}
                      onChange={o => updateDep(idx, 'col', o.value)} styles={selectStyles} placeholder="Select column..." className="text-sm" />
                  </div>
                  <div className="w-52 flex-shrink-0">
                    <Select options={COND_OPTIONS} value={COND_OPTIONS.find(o => o.value === (dep.conditionType || 'not_empty'))}
                      onChange={o => updateDep(idx, 'conditionType', o.value)} styles={selectStyles} className="text-sm" />
                  </div>
                  {dep.conditionType === 'equals' && (
                    <input type="text" className={`${inputCls} w-32 flex-shrink-0`} value={dep.equalsValue || ''}
                      placeholder="Value" onChange={e => updateDep(idx, 'equalsValue', e.target.value)} />
                  )}
                  {dependents.length > 1 && (
                    <button type="button" onClick={() => onChange({ ...value, dependents: dependents.filter((_, i) => i !== idx) })}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer">
                      <XIcon size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => onChange({ ...value, dependents: [...dependents, { col: '', conditionType: 'not_empty', equalsValue: '' }] })}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-transparent border-none cursor-pointer p-0">
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

// ---------------------------------------------------------------------------
//!  buildPayload (unchanged)
// ---------------------------------------------------------------------------
function buildPayload(uploadId, columnRules) {
  const rules = {};
  Object.entries(columnRules).forEach(([col, ruleList]) => {
    if (!ruleList?.length) return;
    const merged = {};
    ruleList.forEach(({ type, config }) => {
      switch (type) {
        case 'has_empty': merged.has_empty = String(config.required !== false); break;
        case 'data_type': merged.data_type = config.type || 'str'; break;
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
        case 'date_format': merged.date_format = config.format; break;
        case 'fix_header': merged.fix_header = (config.values || '').split(',').map(v => v.trim()).filter(Boolean).join(', '); break;
        case 'cell_contains': merged.cell_contains = { contains: String(config.contains !== false), value: config.pattern || '' }; break;
        case 'cell_value_start_end_with': merged.cell_value_start_end_with = { start_end_with: 'no', start_with: config.start_with || '', end_with: config.end_with || '' }; break;
        case 'data_redundant': merged.data_redundant = { value: config.value || '', Threshold: String(config.threshold || 50) }; break;
        case 'not_match_found': merged.not_match_found = config.value; break;
        case 'depend_header': {
          const triggerCond = config.triggerCondition === 'equals' ? (config.triggerEqualsValue || '') : (config.triggerCondition || 'not_empty');
          const obj = { [(config.triggerCol || '').trim()]: triggerCond };
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

// ---------------------------------------------------------------------------
// Main component – upload always visible, config below
// ---------------------------------------------------------------------------
export default function FileUpload() {
  const navigate = useNavigate();

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
    setFile(null);
    setUploadError(null);
    setProgress(0);
    setUploadId(null);
    setHeaders([]);
    setColumnRules({});
    setSelectedHeader(null);
    setAddingRule(false);
  };

  // ? adding rules 
  const handleAddRule = useCallback(() => {
    if (!selectedHeader) return;
    if ((columnRules[selectedHeader] || []).find(r => r.type === newRuleType)) {
      toast.warning(`Rule "${newRuleType}" already added for this column.`);
      return;
    }
    setColumnRules(prev => ({ ...prev, [selectedHeader]: [...(prev[selectedHeader] || []), { type: newRuleType, config: { ...newRuleConfig } }] }));
    setNewRuleConfig({ required: true });
    setNewRuleType('has_empty');
    setAddingRule(false);
    toast.success(`Rule added to "${selectedHeader}"`);
  }, [selectedHeader, columnRules, newRuleType, newRuleConfig]);

    // ? removing rules
  const handleRemoveRule = useCallback((header, index) => {
    setColumnRules(prev => ({ ...prev, [header]: prev[header].filter((_, i) => i !== index) }));
  }, []);


  //  ? validation check  + API CALL 
  const handleRunValidation = async () => {
    const totalRules = Object.values(columnRules).reduce((s, a) => s + a.length, 0);
    if (totalRules === 0) { toast.warning('Please add at least one validation rule.'); return; }
    setSubmitting(true);
    try {
      const res = await runValidation(buildPayload(uploadId, columnRules));
      const reportId = res.data?.reportId || res.data?.report_id || res.data?.id;
      toast.success('Validation complete!');
      navigate(`/results/${reportId}`);
    } catch (err) {
      toast.error(err.displayMessage || 'Validation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalRules = Object.values(columnRules).reduce((s, a) => s + a.length, 0);
  const columnsWithRules = Object.keys(columnRules).filter(k => (columnRules[k] || []).length > 0).length;
  const filteredHeaders = headers.filter(h => h.toLowerCase().includes(searchHeaders.toLowerCase()));
  const currentRules = selectedHeader ? (columnRules[selectedHeader] || []) : [];
  const payload = buildPayload(uploadId, columnRules);



  // Helper to get file extension


  return (
    <div>

      {/* ============================= BREADCRUMB ============================= */}
      <div className="px-6 pt-4 pb-2">
        <nav className="flex items-center gap-1 text-sm text-slate-500">
          <Link to="/" className="flex items-center gap-1 text-[#3F4D67] hover:opacity-75 font-medium transition-opacity">
            <HomeIcon size={13} />
          </Link>
          <span className="text-slate-400 px-1">/</span>
          {!uploadId ? (
            <span className="text-slate-600 font-medium">Upload File</span>
          ) : (
            <>
              <button
                onClick={handleReset}
                className="font-medium text-[#3F4D67] hover:opacity-75 transition-opacity bg-transparent border-none cursor-pointer p-0 text-sm"
              >
                Upload File
              </button>
              <span className="text-slate-400 px-1">/</span>
              <span className="text-slate-600 font-medium">Configure Rules</span>
            </>
          )}
        </nav>
      </div>

      {/* ============================= PAGE BANNER ============================= */}
      <div className="bg-[#3F4D67] border-l-4 border-cyan-400 px-6 py-4 mb-6">
        <span className="text-white font-semibold text-sm">
          {!uploadId ? 'Upload File' : 'Configure Rules'}
        </span>
      </div>

      {/* ============================= CONTENT ============================= */}
      <div className="px-6 pb-6">

        {/* ============================= UPLOAD SECTION ============================= */}
        <div className="mb-6">

          {/* ── COLLAPSED: file already uploaded ── */}
          {uploadId && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                <FileSpreadsheetIcon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-800 truncate block">{filename}</span>
                <span className="text-xs text-slate-400">{totalRows.toLocaleString()} rows &middot; {headers.length} columns</span>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-700 border border-slate-200 hover:border-red-200 bg-red-50 hover:bg-red-300 rounded-lg px-3 py-1.5 transition-all flex-shrink-0 cursor-pointer"
              >
                <UploadCloudIcon size={12} /> Change File
              </button>
            </div>
          )}

          {/* ── EXPANDED: no file uploaded yet ── */}
          {!uploadId && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Top bar */}
            <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400" />

            {/* Header */}
            <div className="px-6 pt-3 pb-1 flex items-center justify-between border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Upload Data File</h2>
                <p className="text-xs text-slate-400 mt-0.5">CSV or Excel</p>
              </div>
              <div className="flex gap-1.5">
                {['.csv', '.xlsx', '.xls'].map(ext => (
                  <span key={ext} className="bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-600">{ext}</span>
                ))}
              </div>
            </div>

            {/* Dropzone */}
            <div className="p-6">
              <div {...getRootProps({
                className: [
                  'border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-all duration-200 outline-none',
                  isDragReject ? 'border-red-400 bg-red-50'
                    : isDragActive ? 'border-[#3F4D67] bg-[#3F4D67]/5'
                      : 'border-slate-200 hover:border-[#3F4D67]/40 hover:bg-slate-50',
                ].join(' '),
              })}>
                <input {...getInputProps()} />
                {isDragReject ? (
                  <div>
                    <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-red-100 flex items-center justify-center text-red-500">
                      <XIcon size={18} />
                    </div>
                    <p className="text-sm font-semibold text-red-500">Invalid file type</p>
                    <p className="text-xs text-red-400 mt-0.5">Only CSV and Excel files accepted</p>
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
                  <button onClick={handleReset}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-all cursor-pointer border border-slate-200 bg-transparent">
                    <XIcon size={13} /> Clear
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
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Configure Validation Rules</h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  Add rules to validate your data. Rules are applied per column.
                </p>
              </div>
              <button onClick={handleRunValidation} disabled={submitting || totalRules === 0}
                className="btn-primary py-2.5 px-6 disabled:opacity-50 disabled:cursor-not-allowed">
                <PlayIcon size={16} />
                {submitting ? 'Running...' : 'Run Validation'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
              {/* Column list (unchanged) */}
              <div className="card overflow-hidden sticky top-20">
                <div className="px-4 py-4 bg-[#3F4D67]">
                  <div className="flex items-center gap-2 mb-3">
                    <ColumnsIcon size={14} />
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
                <div className="max-h-[500px] overflow-y-auto">
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
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-300">
                      <ColumnsIcon size={32} />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Select a column from the left panel to configure rules.</p>
                  </div>
                ) : (
                  <>
                    <div className="card p-0 overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
                      <div className="p-5 flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <h2 className="text-lg font-black text-slate-800">{selectedHeader}</h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {currentRules.length > 0
                              ? <><span className="text-blue-600 font-bold">{currentRules.length}</span> rule{currentRules.length !== 1 ? 's' : ''} configured</>
                              : 'No rules yet — add one below'}
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
                                <div className="text-xs text-slate-500 font-mono bg-white rounded-lg px-3 py-2 border border-slate-100 overflow-x-auto">
                                  {JSON.stringify(rule.config, null, 0)}
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
                        <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400" />
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
                              options={RULE_TYPES.map(rt => ({ value: rt.value, label: rt.label }))}
                              value={{ value: newRuleType, label: RULE_TYPES.find(r => r.value === newRuleType)?.label }}
                              onChange={o => { setNewRuleType(o.value); setNewRuleConfig({ required: true }); }}
                              className="text-sm"
                              styles={{ control: (base) => ({ ...base, borderRadius: '12px', borderColor: '#e2e8f0', padding: '2px' }) }}
                            />
                          </div>
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