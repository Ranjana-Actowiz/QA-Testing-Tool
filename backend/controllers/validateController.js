const Upload = require('../models/Upload');
const ValidationReport = require('../models/ValidationReport');
const { createRowStream } = require('../services/fileParser');
const { validateDataStream } = require('../services/validationEngine');

// ---------------------------------------------------------------------------
// Controller handlers
// ---------------------------------------------------------------------------

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
    const storedResults = results.length > SAFE_RESULT_LIMIT
      ? results.slice(0, SAFE_RESULT_LIMIT)
      : results;

    // --- Save report ---
    const report = new ValidationReport({
      uploadId: uploadDoc._id,
      createdAt: new Date(),
      totalRows,
      passedRows,
      failedRows,
      rules,
      results: storedResults,
      summary,
    });

    await report.save();

    // Update upload status
    uploadDoc.status = 'validated';
    await uploadDoc.save();

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

/**
 * GET /api/validate/report/:id/download
 * Generate and stream a CSV file containing the validation report results.
 *
 * CSV columns:
 *   Row Index, Status, Column, Rule, Message, Cell Value
 */
const downloadReport = async (req, res) => {
  try {
    const report = await ValidationReport.findById(req.params.id).populate('uploadId', 'originalName').lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const originalName = report.uploadId ? report.uploadId.originalName.replace(/\.[^/.]+$/, '') : 'report';
    const csvFilename = `validation_report_${originalName}_${Date.now()}.csv`;

    // Set response headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${csvFilename}"`);

    // Write BOM for Excel UTF-8 compatibility
    res.write('\uFEFF');

    // ---- Summary section with AM/PM formatting ----
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const d = new Date(report.createdAt);

    const pad = (n) => String(n).padStart(2, '0');

    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12

    const readableDate = `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(hours)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;

    res.write('=== VALIDATION SUMMARY ===\r\n');
    res.write(`Total Rows,${report.totalRows}\r\n`);
    res.write(`Passed Rows,${report.passedRows}\r\n`);
    res.write(`Failed Rows,${report.failedRows}\r\n`);
    res.write(`Pass Rate,${report.totalRows > 0 ? ((report.passedRows / report.totalRows) * 100).toFixed(2) : 0}%\r\n`);
    res.write(`Created At,${readableDate}\r\n`);
    res.write('\r\n');

    // ---- Rule summary section ----
    if (report.summary && report.summary.length > 0) {
      res.write('=== RULE SUMMARY ===\r\n');
      res.write('Column,Rule,Pass Count,Fail Count\r\n');
      for (const s of report.summary) {
        res.write(
          `${escapeCsvField(s.column)},${escapeCsvField(s.rule)},${s.passCount},${s.failCount}\r\n`
        );
      }
      res.write('\r\n');
    }

    // ---- Detailed results section ----
    res.write('=== DETAILED RESULTS ===\r\n');
    res.write('Row Index,Status,Column,Rule,Message,Cell Value\r\n');

    for (const rowResult of report.results) {
      if (rowResult.status === 'pass') {
        res.write(
          `${rowResult.rowIndex + 1},pass,,,,\r\n`
        );
      } else {
        if (rowResult.errors && rowResult.errors.length > 0) {
          for (const err of rowResult.errors) {
            const line = [
              rowResult.rowIndex + 1,
              'fail',
              escapeCsvField(err.column || ''),
              escapeCsvField(err.rule || ''),
              escapeCsvField(err.message || ''),
              escapeCsvField(err.value !== undefined && err.value !== null ? String(err.value) : ''),
            ].join(',');
            res.write(line + '\r\n');
          }
        } else {
          res.write(`${rowResult.rowIndex + 1},fail,,,,\r\n`);
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('downloadReport error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid report ID.' });
    }
    // If headers already sent, just end
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message });
    }
    res.end();
  }
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Escape a value for safe inclusion in a CSV field.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 */
const escapeCsvField = (value) => {
  const str = String(value !== undefined && value !== null ? value : '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

module.exports = {
  runValidation,
  getReport,
  downloadReport,
};
