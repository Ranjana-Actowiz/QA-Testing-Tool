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
 * Parse a JSON file and yield rows.
 * Supports two structures:
 *   1. Top-level array:        [{...}, {...}]
 *   2. Object with array value: { "data": [{...}] }  (first key whose value is an array)
 * Headers are derived from the keys of the first object in the array.
 */
async function* streamJsonRows(filePath) {
  const raw = await fs.promises.readFile(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON parse error: ${e.message}`);
  }

  // Resolve to an array of row objects
  let rows;
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (parsed && typeof parsed === 'object') {
    // Find the first key whose value is an array
    const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
    if (!arrayKey) throw new Error('JSON file must contain an array of objects at the root or inside a top-level key.');
    rows = parsed[arrayKey];
  } else {
    throw new Error('JSON file must contain an array of objects.');
  }

  if (!rows.length) return;

  if (typeof rows[0] !== 'object' || Array.isArray(rows[0])) {
    throw new Error('JSON rows must be objects (key-value pairs).');
  }

  const headers = Object.keys(rows[0]).map(h => String(h).trim());
  yield { _headers: headers };

  for (const row of rows) {
    const rowObj = {};
    let hasData = false;
    headers.forEach(h => {
      const v = row[h];
      const s = jsonValueToString(v);
      rowObj[h] = s;
      if (s !== '') hasData = true;
    });
    if (hasData) yield rowObj;
  }
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
