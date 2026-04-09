const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');       // kept only for legacy .xls (65k row limit, no streaming needed)
const ExcelJS = require('exceljs'); // streaming reader for .xlsx


const cellToString = (v) => (v !== undefined && v !== null ? String(v) : '');

// ---------------------------------------------------------------------------
// Streaming async generators
// Each generator yields { _headers: string[] } ONCE as the first item,
// then plain row objects { col: value, ... } for every data row.
// ---------------------------------------------------------------------------

/**
 * Stream rows from a CSV file with backpressure.
 *
 * The underlying file stream is paused when the in-memory queue reaches
 * HIGH_WATER rows and resumed when the consumer drains it to LOW_WATER.
 * This prevents the entire file being buffered in RAM when validation is
 * slower than the disk read speed (which is always the case for large files).
 */
async function* streamCsvRows(filePath) {
  const HIGH_WATER = 1_000; // pause the file read stream at this queue depth
  const LOW_WATER = 100; // resume once the consumer drains to this depth

  const queue = [];
  let finished = false;
  let streamErr = null;
  let notify = null;

  const push = (item) => {
    queue.push(item);
    if (notify) { const r = notify; notify = null; r(); }
  };
  const wait = () => new Promise((r) => { if (queue.length) r(); else notify = r; });

  // Keep a separate reference so we can pause/resume the underlying file stream
  const fileStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
  fileStream.on('error', (err) => { streamErr = err; finished = true; push(null); });

  fileStream.pipe(csv())
    .on('headers', (hdrs) => {
      push({ _headers: hdrs.map((h) => String(h).trim()) });
    })
    .on('data', (row) => {
      push(row);
      // Backpressure: stop reading from disk when the queue is full
      if (queue.length >= HIGH_WATER) fileStream.pause();
    })
    .on('end', () => { finished = true; push(null); })
    .on('error', (err) => { streamErr = err; finished = true; push(null); });

  while (true) {
    if (!queue.length) {
      if (finished) break;
      await wait();
    }
    const item = queue.shift();
    // Resume reading once the consumer has drained the queue enough
    if (fileStream.isPaused() && queue.length <= LOW_WATER) fileStream.resume();
    if (item === null) { if (streamErr) throw new Error(`CSV parse error: ${streamErr.message}`); break; }
    yield item;
  }

  fileStream.destroy?.();
}

/**
 * Stream rows from an XLSX file using ExcelJS WorkbookReader async iteration.
 *
 * Uses `for await (const row of worksheetReader)` which is a pull-based model:
 * the file is only read as fast as the consumer (validation) processes rows.
 * This provides true backpressure — no unbounded in-memory row queue.
 */
async function* streamXlsxRows(filePath) {
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    sharedStrings: 'cache',  // required for correct string cell values
    hyperlinks: 'ignore',
    styles: 'ignore',
  });

  let headers = null;
  let firstSheet = true;

  try {
    for await (const worksheetReader of workbookReader) {
      if (!firstSheet) {
        // Drain extra sheets so ExcelJS can close the zip cleanly
        for await (const _ of worksheetReader) { } // eslint-disable-line no-unused-vars
        continue;
      }
      firstSheet = false;

      for await (const row of worksheetReader) {
        const vals = row.values; // ExcelJS rows are 1-indexed; vals[0] is undefined

        if (!headers) {
          const hdrs = [];
          for (let i = 1; i < vals.length; i++) {
            hdrs.push(String(vals[i] !== undefined && vals[i] !== null ? vals[i] : '').trim());
          }
          headers = hdrs;
          yield { _headers: hdrs };
          continue;
        }

        const rowObj = {};
        let hasData = false;
        headers.forEach((h, idx) => {
          const v = vals[idx + 1];
          const s = cellToString(v);
          rowObj[h] = s;
          if (s !== '') hasData = true;
        });
        if (hasData) yield rowObj;
      }
    }
  } catch (err) {
    throw new Error(`Excel parse error: ${err.message}`);
  }
}

/**
 * Stream rows from a legacy .xls file using the xlsx library.
 * .xls files are capped at 65,535 rows, so in-memory is acceptable.
 * Yields the same protocol: { _headers } first, then row objects.
 */
async function* streamXlsRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('XLS file contains no sheets.');

  const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1, defval: '', blankrows: false,
  });

  if (!rawData.length) return;

  const headers = rawData[0].map((h) => String(h).trim());
  yield { _headers: headers };

  for (let i = 1; i < rawData.length; i++) {
    const arr = rawData[i];
    const rowObj = {};
    let hasData = false;
    headers.forEach((h, idx) => {
      const v = arr[idx];
      const s = cellToString(v);
      rowObj[h] = s;
      if (s !== '') hasData = true;
    });
    if (hasData) yield rowObj;
  }
}

/**
 * Recursively flatten a plain object using dot-notation keys.
 * Arrays are NOT expanded — they are kept as-is (stringified later by jsonValueToString).
 * e.g. { a: { b: 1 }, c: [1,2] } → { "a.b": 1, "c": [1,2] }
 */
function flattenObject(obj, prefix, result) {
  prefix = prefix || '';
  result = result || {};
  for (const k of Object.keys(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)) {
      flattenObject(v, key, result);
    } else {
      result[key] = v;
    }
  }
  return result;
}

/**
 * Parse a JSON file and yield rows.
 * Handles all common tabular JSON structures:
 *   1.  Array of objects:           [{col:val}, ...]  — nested objects auto-flattened
 *   2.  Array of arrays:            [["h1","h2"], [v1,v2], ...]  (first row = headers)
 *   3.  Array of primitives:        [v1, v2, ...]  → single "value" column
 *   4.  Wrapper object + array:     { "data": [{...}] }  (any top-level key)
 *   5.  Pandas split orient:        { "columns": [...], "data": [[...]] }
 *   6.  Pandas table orient:        { "schema": { "fields": [{name}] }, "data": [...] }
 *   7.  Pandas index orient:        { "0": {col:val}, "1": {col:val} }
 *   8.  Deeply nested:              searches up to 5 levels for the first array
 *
 * Nested plain objects are flattened to dot-notation columns automatically.
 * Arrays within objects are kept as JSON strings.
 */
async function* streamJsonRows(filePath) {
  const raw = await fs.promises.readFile(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON parse error: ${e.message}`);
  }

  const { headers, rows, isArrayOfArrays } = resolveJsonStructure(parsed);
  if (!rows.length) return;

  yield { _headers: headers };

  for (const row of rows) {
    const rowObj = {};
    let hasData = false;
    if (isArrayOfArrays) {
      // row is a positional array — map by index
      headers.forEach((h, idx) => {
        const s = jsonValueToString(row[idx]);
        rowObj[h] = s;
        if (s !== '') hasData = true;
      });
    } else {
      // row is an object — flatten it first, then map by header
      const flat = flattenObject(row);
      headers.forEach(h => {
        const s = jsonValueToString(flat[h]);
        rowObj[h] = s;
        if (s !== '') hasData = true;
      });
    }
    if (hasData) yield rowObj;
  }
}

/**
 * Resolve any JSON value into { headers, rows, isArrayOfArrays }.
 * isArrayOfArrays=true means each row is a positional array, not a keyed object.
 */
function resolveJsonStructure(parsed) {
  if (Array.isArray(parsed)) return resolveJsonArray(parsed);

  if (parsed && typeof parsed === 'object') {
    // Pandas split: { columns: [...], data: [[...]] }
    if (Array.isArray(parsed.columns) && Array.isArray(parsed.data)) {
      const headers = parsed.columns.map(h => String(h ?? '').trim());
      const isArrayOfArrays = parsed.data.length > 0 && Array.isArray(parsed.data[0]);
      return { headers, rows: parsed.data, isArrayOfArrays };
    }

    // Pandas table: { schema: { fields: [{name}] }, data: [...] }
    if (parsed.schema && Array.isArray(parsed.schema.fields) && Array.isArray(parsed.data)) {
      const headers = parsed.schema.fields
        .filter(f => f.name !== 'index')
        .map(f => String(f.name ?? '').trim());
      const isArrayOfArrays = parsed.data.length > 0 && Array.isArray(parsed.data[0]);
      return { headers, rows: parsed.data, isArrayOfArrays };
    }

    // Pandas index orient: all values are plain objects → treat as array of objects
    const topVals = Object.values(parsed);
    if (
      topVals.length > 0 &&
      topVals.every(v => v && typeof v === 'object' && !Array.isArray(v))
    ) {
      const headers = [...new Set(topVals.flatMap(r => Object.keys(r)))];
      return { headers, rows: topVals, isArrayOfArrays: false };
    }

    // Any top-level key whose value is an array
    const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
    if (arrayKey) return resolveJsonArray(parsed[arrayKey]);

    // Deep search — recurse up to 5 levels for the first array
    const found = findArrayDeep(parsed, 0);
    if (found) return resolveJsonArray(found);

    throw new Error('JSON file must contain an array of objects or a recognised tabular structure.');
  }

  throw new Error('JSON file must contain tabular data (array or object).');
}

function resolveJsonArray(arr) {
  if (!arr.length) return { headers: [], rows: [], isArrayOfArrays: false };

  const first = arr[0];

  // Array of objects — flatten nested plain objects, collect all unique dot-notation keys
  if (first !== null && typeof first === 'object' && !Array.isArray(first)) {
    const headerSet = new Set();
    // Sample up to 100 rows to discover all keys (handles sparse/varying schemas)
    const sampleSize = Math.min(arr.length, 100);
    for (let i = 0; i < sampleSize; i++) {
      const row = arr[i];
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        const flat = flattenObject(row);
        for (const k of Object.keys(flat)) headerSet.add(k);
      }
    }
    const headers = [...headerSet].map(h => String(h).trim());
    return { headers, rows: arr, isArrayOfArrays: false };
  }

  // Array of arrays
  if (Array.isArray(first)) {
    // If the sub-arrays contain objects → it's a grouped/paged structure.
    // Flatten all inner arrays into one list and re-resolve.
    const innerFirst = first.find(v => v !== null && v !== undefined);
    if (innerFirst !== undefined && typeof innerFirst === 'object' && !Array.isArray(innerFirst)) {
      const allRows = arr.flatMap(inner => Array.isArray(inner) ? inner : [inner]);
      return resolveJsonArray(allRows);
    }
    // Otherwise: first sub-array is the header row, rest are positional data rows
    const headers = first.map(h => String(h ?? '').trim());
    return { headers, rows: arr.slice(1), isArrayOfArrays: true };
  }

  // Array of primitives — single column named "value"
  return {
    headers: ['value'],
    rows: arr.map(v => [v]),
    isArrayOfArrays: true,
  };
}

/** Recursively find the first array nested inside an object, up to maxDepth levels. */
function findArrayDeep(obj, depth) {
  if (depth > 5) return null;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > 0) return val;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const found = findArrayDeep(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Convert a JSON cell value to a flat string.
 * Handles MongoDB extended JSON objects (e.g. { "$oid": "..." }, { "$date": "..." })
 * and any other nested object by falling back to JSON.stringify.
 */
function jsonValueToString(v) {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'object') return String(v);
  // MongoDB Extended JSON — unwrap known single-key wrappers
  if (v.$oid) return String(v.$oid);
  if (v.$date) return typeof v.$date === 'object' ? String(v.$date.$numberLong ?? JSON.stringify(v.$date)) : String(v.$date);
  if (v.$numberInt || v.$numberLong || v.$numberDouble || v.$numberDecimal) {
    return String(v.$numberInt ?? v.$numberLong ?? v.$numberDouble ?? v.$numberDecimal);
  }
  // Any other object — stringify so it's readable rather than "[object Object]"
  return JSON.stringify(v);
}

// ---------------------------------------------------------------------------
// Public streaming API
// ---------------------------------------------------------------------------

/**
 * Create an async generator that streams rows from any supported file.
 * First yielded value: { _headers: string[] }
 * Subsequent values:   plain row objects
 *
 * @param {string} filePath
 * @param {string} mimetype
 * @returns {AsyncGenerator}
 */
function createRowStream(filePath, mimetype) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const ext = path.extname(filePath).toLowerCase();

  const isCSV = mimetype === 'text/csv' || mimetype === 'application/csv' || mimetype === 'text/plain' || ext === '.csv';
  const isXlsx = mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx';
  const isXls = mimetype === 'application/vnd.ms-excel' || ext === '.xls';
  const isJson = mimetype === 'application/json' || mimetype === 'text/json' || ext === '.json';

  if (isCSV) return streamCsvRows(filePath);
  if (isXlsx) return streamXlsxRows(filePath);
  if (isXls) return streamXlsRows(filePath);
  if (isJson) return streamJsonRows(filePath);

  // Fallback by extension
  if (ext === '.csv') return streamCsvRows(filePath);
  if (ext === '.xlsx') return streamXlsxRows(filePath);
  if (ext === '.xls') return streamXlsRows(filePath);
  if (ext === '.json') return streamJsonRows(filePath);

  // Last resort — try xlsx streaming
  if (mimetype === 'application/octet-stream') return streamXlsxRows(filePath);

  throw new Error(`Unsupported file type: ${mimetype} (${ext})`);
}

// ---------------------------------------------------------------------------
// Legacy non-streaming API — kept for the upload controller (preview only)
// Uses the same streaming generators internally to avoid the xlsx crash.
// ---------------------------------------------------------------------------

async function parseFile(filePath, mimetype) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found at path: ${filePath}`);
  }

  const headers = [];
  const rows = [];

  const gen = createRowStream(filePath, mimetype);

  for await (const item of gen) {
    if (item._headers) {
      headers.push(...item._headers);
    } else {
      rows.push(item);
    }
  }

  return { headers, rows };
}

module.exports = { parseFile, createRowStream };
