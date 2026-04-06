const fs = require('fs');
const Upload = require('../models/Upload');
const ValidationReport = require('../models/ValidationReport');
const { createRowStream } = require('../services/fileParser');
const { validateDataStream } = require('../services/validationEngine');
const ExcelJS = require('exceljs');

/**
 * POST /api/validate
 * Body: { uploadId: string, rules: object }
 *
 * Parses the original file, runs validation, saves and returns the full report.
 */
const runValidation = async (req, res) => {
  try {
    const { uploadId, rules } = req.body;
    // --- Input validation ---
    if (!uploadId) {
      return res.status(400).json({ success: false, message: 'uploadId is required.' });
    }

    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
      return res.status(400).json({
        success: false,
        message: 'rules must be a non-empty JSON object.',
      });
    }

    // --- Fetch upload record ---
    const uploadDoc = await Upload.findById(uploadId);
    if (!uploadDoc) {
      return res.status(404).json({ success: false, message: 'Upload not found.' });
    }

    // --- Resolve headers from the stored upload record ---
    const headers = uploadDoc.headers || [];
    if (!headers.length) {
      return res.status(422).json({ success: false, message: 'Upload has no headers recorded.' });
    }

    // --- Stream-validate the file (no full in-memory load) ---
    // createStream is a factory so validateDataStream can open the file twice
    // when data_redundant rules require a pre-scan pass.
    const createStream = () => createRowStream(uploadDoc.filePath, uploadDoc.mimeType);

    let validationResult;
    try {
      validationResult = await validateDataStream(createStream, headers, rules);
    } catch (parseErr) {
      return res.status(422).json({
        success: false,
        message: `Failed to validate file: ${parseErr.message}`,
      });
    }

    const { results, summary, totalRows, passedRows, failedRows } = validationResult;

    if (totalRows === 0) {
      return res.status(422).json({
        success: false,
        message: 'The file contains no data rows to validate.',
      });
    }

    // --- Guard: keep stored results under ~12 MB (BSON limit is 16 MB) ---
    // Estimate ~2400 bytes per result entry; cap at ~5000 to stay safe.
    const SAFE_RESULT_LIMIT = 5_000;
    const storedResults = results.length > SAFE_RESULT_LIMIT ? results.slice(0, SAFE_RESULT_LIMIT) : results;

    // --- Save report ---
    const report = new ValidationReport({
      uploadId: uploadDoc._id,
      originalName: uploadDoc.originalName || '',
      createdAt: new Date(),
      totalRows,
      passedRows,
      failedRows,
      rules,
      results: storedResults,
      summary,
    });

    await report.save();

    // --- Clean up: delete the physical file and the upload record ---
    // const filePath = uploadDoc.filePath;
    // await uploadDoc.deleteOne();
    // if (filePath && fs.existsSync(filePath)) {
    //   fs.unlinkSync(filePath);
    // }

    return res.status(201).json({
      success: true,
      message: 'Validation completed.',
      reportId: report._id,
      uploadId: uploadDoc._id,
      totalRows,
      passedRows,
      failedRows,
      summary,
      results,
    });
  } catch (error) {
    console.error('runValidation error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid uploadId format.' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};



/**
 * GET /api/validate/report/:id/download
 * Generate and stream a styled XLSX file.
 * Optional query param: ?column=ColName  → column-specific report
 */
const downloadReport = async (req, res) => {
  try {
    const report = await ValidationReport.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    const column = req.query.column ? String(req.query.column) : null;
    const originalName = (report.originalName || 'report').replace(/\.[^/.]+$/, '');
    const xlsxFilename = column ? `${originalName}_${column}_validation.xlsx` : `${originalName}_validation_report.xlsx`;

    // Date formatting
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(report.createdAt);
    const pad = (n) => String(n).padStart(2, '0');
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const readableDate = `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(h)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
    const passRate = report.totalRows > 0 ? ((report.passedRows / report.totalRows) * 100).toFixed(2) : '0.00';
    const failRate = report.totalRows > 0 ? ((report.failedRows / report.totalRows) * 100).toFixed(2) : '0.00';

    const cellDisplay = (val) => (val === undefined || val === null || val === '') ? '(empty)' : String(val);

    // Bold a header row with a bottom border
    const styleHeader = (row) => {
      row.height = 22;
      row.eachCell((cell) => {
        cell.font = { bold: true, size: 11 };
        cell.border = { bottom: { style: 'thin' } };
      });
    };

    // Bold the label (col A) in an info/summary row, normal value
    const styleInfoRow = (row) => {
      row.height = 18;
      const labelCell = row.getCell(1);
      labelCell.font = { bold: true, size: 11 };
    };

    // Taller blank spacer row
    const addSpacer = (ws) => {
      const r = ws.addRow([]);
      r.height = 10;
    };

    const wb = new ExcelJS.Workbook();

    // =============================== COLUMN-SPECIFIC REPORT ==========================================
    if (column) {
      const ws = wb.addWorksheet('Column Report');
      ws.columns = [
        { header: '', key: 'a', width: 12 },
        { header: '', key: 'b', width: 30 },
        { header: '', key: 'c', width: 14 },
        { header: '', key: 'd', width: 26 },
        { header: '', key: 'e', width: 60 },
        { header: '', key: 'f', width: 60 },
      ];

      const invalidRows = report.results.filter(r => Array.isArray(r.errors) && r.errors.some(e => e.column === column)).sort((a, b) => (a.row_number ?? 0) - (b.row_number ?? 0));
      const invalidCount = invalidRows.length;
      const validCount = report.totalRows - invalidCount;
      const colPassRate = report.totalRows > 0 ? ((validCount / report.totalRows) * 100).toFixed(2) : '0.00';
      const colFailRate = report.totalRows > 0 ? (100 - parseFloat(colPassRate)).toFixed(2) : '0.00';

      // Format applied rules for display
      const colRules = report.rules && report.rules[column] ? report.rules[column] : null;
      const rulesDisplay = colRules
        ? Object.entries(colRules)
            .map(([k, v]) => {
              if (v && typeof v === 'object') return `${k}: ${JSON.stringify(v)}`;
              return `${k}: ${v}`;
            })
            .join('  |  ')
        : 'N/A';

      // Info block
      styleInfoRow(ws.addRow(['File Name', report.originalName || 'N/A']));
      styleInfoRow(ws.addRow(['Column Name', column]));
      styleInfoRow(ws.addRow(['Generated At', readableDate]));
      styleInfoRow(ws.addRow(['Rules Applied', rulesDisplay]));
      addSpacer(ws);

      // Summary block
      styleInfoRow(ws.addRow(['Total Rows', report.totalRows]));
      styleInfoRow(ws.addRow(['Valid Rows', `${validCount} (${colPassRate}%)`]));
      styleInfoRow(ws.addRow(['Invalid Rows', `${invalidCount} (${colFailRate}%)`]));
      styleInfoRow(ws.addRow(['Pass Rate', `${colPassRate}%`]));
      addSpacer(ws);

      // Data table
      const hdr = ws.addRow(['File Row', 'Cell Value', 'Status', 'Rule Violated', 'Error Message']);
      styleHeader(hdr);
      if (invalidRows.length === 0) {
        // All rows valid — row-level data is not stored for valid rows
        ws.addRow([
          `(all ${report.totalRows})`,
          '—',
          'VALID',
          '—',
          'All rows passed validation',
        ]);
      } else {
        // Show only invalid rows
        for (const row of invalidRows) {
          for (const err of row.errors.filter(e => e.column === column)) {
            ws.addRow([
              row.row_number,
              cellDisplay(err.value),
              'INVALID',
              err.rule || '',
              err.message || '',
            ]);
          }
        }
      }
      ws.views = [{ state: 'frozen', ySplit: hdr.number }];

      // ========================================== FULL REPORT  (2 sheets: Summary + Error Details) =======================
    } else {
      // ---- Sheet 1: Summary ----
      const wsSum = wb.addWorksheet('Summary');
      wsSum.columns = [
        { key: 'a', width: 24 },
        { key: 'b', width: 30 },
        { key: 'c', width: 24 },
        { key: 'd', width: 15 },
        { key: 'e', width: 15 },
        { key: 'f', width: 14 },
      ];

      // Info block
      styleInfoRow(wsSum.addRow(['File Name', report.originalName || 'N/A']));
      styleInfoRow(wsSum.addRow(['Generated At', readableDate]));
      addSpacer(wsSum);

      // Overall summary
      styleInfoRow(wsSum.addRow(['Total Rows', report.totalRows]));
      styleInfoRow(wsSum.addRow(['Valid Rows', `${report.passedRows} (${passRate}%)`]));
      styleInfoRow(wsSum.addRow(['Invalid Rows', `${report.failedRows} (${failRate}%)`]));
      styleInfoRow(wsSum.addRow(['Pass Rate', `${passRate}%`]));

      // Column summary table
      if (report.summary && report.summary.length > 0) {
        addSpacer(wsSum);
        const colHdr = wsSum.addRow(['#', 'Column Name', 'Rules Applied', 'Valid Count', 'Invalid Count', 'Pass Rate']);
        styleHeader(colHdr);
        const colMap = {};
        for (const s of report.summary) {
          const col = s.column || '—';
          if (!colMap[col]) colMap[col] = { rules: [], pass: 0, fail: 0 };
          colMap[col].rules.push(s.rule || '');
          colMap[col].pass += s.passCount || 0;
          colMap[col].fail += s.failCount || 0;
        }
        let colIdx = 1;
        for (const [col, data] of Object.entries(colMap)) {
          const total = data.pass + data.fail;
          const cRate = total > 0 ? ((data.pass / total) * 100).toFixed(2) : '0.00';
          wsSum.addRow([colIdx++, col, data.rules.join(', '), data.pass, data.fail, `${cRate}%`]);
        }
      }

      // ---- Sheet 2: Error Details ----
      const wsErr = wb.addWorksheet('Error Details');
      wsErr.columns = [
        { key: 'a', width: 14 },
        { key: 'b', width: 24 },
        { key: 'c', width: 40 },
        { key: 'd', width: 14 },
        { key: 'e', width: 24 },
        { key: 'f', width: 60 },
      ];

      const errHdr = wsErr.addRow(['File Row', 'Column', 'Cell Value', 'Status', 'Rule Violated', 'Error Message']);
      styleHeader(errHdr);
      wsErr.views = [{ state: 'frozen', ySplit: errHdr.number }];
      const hasInvalidRows = report.results.some(r => Array.isArray(r.errors) && r.errors.length > 0);

      if (!hasInvalidRows) {
        // All rows valid — row-level data is not stored for valid rows
        wsErr.addRow([
          `(all ${report.totalRows})`,
          '(all columns)',
          '—',
          'VALID',
          '—',
          'All rows passed validation',
        ]);
      } else {
        // ✅ show only invalid rows
        for (const rowResult of report.results) {
          if (rowResult.errors && rowResult.errors.length > 0) {
            for (const err of rowResult.errors) {
              wsErr.addRow([
                rowResult.row_number,
                err.column || '',
                cellDisplay(err.value),
                'INVALID',
                err.rule || '',
                err.message || '',
              ]);
            }
          }
        }
      }
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${xlsxFilename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('downloadReport error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid report ID.' });
    }
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
    res.end();
  }
};


/**
 * GET /api/validate/report/:id
 * Retrieve a saved validation report by its MongoDB _id.
 */
const getReport = async (req, res) => {
  try {
    const report = await ValidationReport.findById(req.params.id)
      .populate('uploadId', 'originalName uploadDate headers totalRows')
      .lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    return res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error('getReport error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid report ID.' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};


module.exports = {
  runValidation,
  getReport,
  downloadReport,
};
