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
 * Stream rows from a CSV file.
 * Uses csv-parser which is already event-driven — no full-file buffering.
 */
async function* streamCsvRows(filePath) {
  const queue   = [];
  let finished  = false;
  let streamErr = null;
  let notify    = null;

  const push = (item) => {
    queue.push(item);
    if (notify) { const r = notify; notify = null; r(); }
  };
  const wait = () => new Promise((r) => { if (queue.length) r(); else notify = r; });

  let headers = null;

  const readStream = fs.createReadStream(filePath)
    .on('error', (err) => { streamErr = err; finished = true; push(null); })
    .pipe(csv())
    .on('headers', (hdrs) => {
      headers = hdrs.map((h) => String(h).trim());
      push({ _headers: headers });
    })
    .on('data', (row) => push(row))
    .on('end',  () => { finished = true; push(null); })
    .on('error', (err) => { streamErr = err; finished = true; push(null); });

  while (true) {
    if (!queue.length) {
      if (finished) break;
      await wait();
    }
    const item = queue.shift();
    if (item === null) { if (streamErr) throw new Error(`CSV parse error: ${streamErr.message}`); break; }
    yield item;
  }

  // clean up if consumer stops early
  readStream.destroy?.();
}

/**
 * Stream rows from an XLSX file using ExcelJS WorkbookReader.
 * Never loads the full file into a single Buffer — reads in chunks.
 */
async function* streamXlsxRows(filePath) {
  const queue   = [];
  let finished  = false;
  let streamErr = null;
  let notify    = null;

  const push = (item) => {
    queue.push(item);
    if (notify) { const r = notify; notify = null; r(); }
  };
  const wait = () => new Promise((r) => { if (queue.length) r(); else notify = r; });

  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    sharedStrings: 'cache',
    hyperlinks:    'ignore',
    styles:        'ignore',
    worksheets:    'emit',
    entries:       'emit',
  });

  let headers    = null;
  let firstSheet = true;

  workbookReader.on('worksheet', (wsReader) => {
    if (!firstSheet) return; // only first sheet
    firstSheet = false;

    wsReader.on('row', (row) => {
      const vals = row.values; // ExcelJS rows are 1-indexed; vals[0] is undefined

      if (!headers) {
        // First row → headers
        const hdrs = [];
        for (let i = 1; i < vals.length; i++) {
          hdrs.push(String(vals[i] !== undefined && vals[i] !== null ? vals[i] : '').trim());
        }
        headers = hdrs;
        push({ _headers: hdrs });
        return;
      }

      const rowObj = {};
      let hasData  = false;
      headers.forEach((h, idx) => {
        const v = vals[idx + 1];
        const s = cellToString(v);
        rowObj[h] = s;
        if (s !== '') hasData = true;
      });
      if (hasData) push(rowObj);
    });
  });

  workbookReader.on('end',   ()    => { finished = true; push(null); });
  workbookReader.on('error', (err) => {
    streamErr = new Error(`Excel parse error: ${err.message}`);
    finished  = true;
    push(null);
  });

  workbookReader.read();

  while (true) {
    if (!queue.length) {
      if (finished) break;
      await wait();
    }
    const item = queue.shift();
    if (item === null) { if (streamErr) throw streamErr; break; }
    yield item;
  }
}

/**
 * Stream rows from a legacy .xls file using the xlsx library.
 * .xls files are capped at 65,535 rows, so in-memory is acceptable.
 * Yields the same protocol: { _headers } first, then row objects.
 */
async function* streamXlsRows(filePath) {
  const workbook  = XLSX.readFile(filePath, { cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('XLS file contains no sheets.');

  const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1, defval: '', blankrows: false,
  });

  if (!rawData.length) return;

  const headers = rawData[0].map((h) => String(h).trim());
  yield { _headers: headers };

  for (let i = 1; i < rawData.length; i++) {
    const arr    = rawData[i];
    const rowObj = {};
    let hasData  = false;
    headers.forEach((h, idx) => {
      const v = arr[idx];
      const s = cellToString(v);
      rowObj[h] = s;
      if (s !== '') hasData = true;
    });
    if (hasData) yield rowObj;
  }
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

  const isCSV = mimetype === 'text/csv' || mimetype === 'application/csv' ||  mimetype === 'text/plain' || ext === '.csv';

  const isXlsx = mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx';

  const isXls = mimetype === 'application/vnd.ms-excel' || ext === '.xls';

  if (isCSV)  return streamCsvRows(filePath);
  if (isXlsx) return streamXlsxRows(filePath);
  if (isXls)  return streamXlsRows(filePath);

  // Fallback by extension
  if (ext === '.csv')  return streamCsvRows(filePath);
  if (ext === '.xlsx') return streamXlsxRows(filePath);
  if (ext === '.xls')  return streamXlsRows(filePath);

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
  const rows    = [];

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
