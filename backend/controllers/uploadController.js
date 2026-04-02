const path = require('path');
const fs = require('fs');
const Upload = require('../models/Upload');
const { createRowStream } = require('../services/fileParser');

// ------------------------------------------------------------  Controller handlers ------------------------------------------------

/**
 * Count CSV rows by scanning raw bytes for newline characters.
 * 10–20× faster than csv-parser because there is no field parsing overhead.
 * Result is -1 to exclude the header row (starts counting from -1).
 * Note: rows containing embedded newlines inside quoted fields are rare and
 * are counted as multiple rows; actual row count is corrected during validation.
 */
const countCsvRowsFast = (filePath) =>
  new Promise((resolve, reject) => {
    let count = -1; // exclude header row
    const stream = fs.createReadStream(filePath, { highWaterMark: 4 * 1024 * 1024 });
    stream.on('data', (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 10) count++; // 10 = '\n'
      }
    });
    stream.on('end', () => resolve(Math.max(0, count)));
    stream.on('error', reject);
  });

/**
 * POST /api/upload
 * Accept a file upload, parse it, save metadata to DB.
 *
 * Optimised for large files (500 MB – 2 GB+):
 *   1. The parse stream is stopped after headers + 5 preview rows — the whole
 *      file is NOT read during the upload request.
 *   2. Row counting is done asynchronously (fire-and-forget) after the HTTP
 *      response is sent.  For CSV a fast binary newline scanner is used;
 *      for XLSX/XLS the streaming parser is used in the background.
 *   3. The DB record is updated with the final row count once it is ready.
 *      The frontend polls GET /api/upload/:id to pick up the updated count.
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { filename, originalname, mimetype, size, path: filePath } = req.file;
    const ext = path.extname(filePath).toLowerCase();

    // --- Read headers + first 5 preview rows, then break immediately ---
    let headers = [];
    const preview = [];

    try {
      const stream = createRowStream(filePath, mimetype);
      for await (const item of stream) {
        if (item._headers) {
          headers = item._headers;
          continue;
        }
        preview.push(item);
        if (preview.length >= 5) break; // early exit — no full file scan here
      }
    } catch (parseErr) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(422).json({
        success: false,
        message: `File parsing failed: ${parseErr.message}`,
      });
    }

    // upload file empty case ...
    if (headers.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(422).json({
        success: false,
        message: 'The uploaded file appears to be empty or has no headers.',
      });
    }

    // Save record immediately with totalRows: 0 (background job will update it)
    const uploadDoc = new Upload({
      filename,
      originalName: originalname,
      uploadDate: new Date(),
      headers,
      totalRows: 0,
      filePath,
      fileSize: size,
      mimeType: mimetype,
      status: 'uploaded',
    });

    await uploadDoc.save();

    // --- Fire-and-forget: count rows without blocking the HTTP response ---
    const docId = uploadDoc._id;
    const isCSV  = mimetype === 'text/csv' || mimetype === 'application/csv' || mimetype === 'text/plain' || ext === '.csv';

    setImmediate(async () => {
      try {
        let totalRows;
        if (isCSV) {
          // Binary newline scan — no CSV parsing, reads raw bytes only
          totalRows = await countCsvRowsFast(filePath);
        } else {
          // XLSX / XLS — stream through with the appropriate parser
          const countStream = createRowStream(filePath, mimetype);
          let count = 0;
          for await (const item of countStream) {
            if (item._headers) continue;
            count++;
          }
          totalRows = count;
        }
        await Upload.findByIdAndUpdate(docId, { totalRows });
      } catch (err) {
        console.error('Background row count error:', err.message);
      }
    });

    return res.status(201).json({
      success: true,
      message: 'File uploaded and parsed successfully.',
      uploadId: uploadDoc._id,
      headers,
      totalRows: 0,   // updated asynchronously — frontend polls GET /api/upload/:id
      preview,
      filename: originalname,
      uploadDate: uploadDoc.uploadDate,
    });
  } catch (error) {
    console.error('uploadFile error:', error);
    return res.status(500).json({
      success: false,
      message: `Server error during upload: ${error.message}`,
    });
  }
};





/**
 * GET /api/upload/:id
 * Get a single upload by ID.
 */
const getUpload = async (req, res) => {
  try {
    const upload = await Upload.findById(req.params.id).lean();
    if (!upload) {
      return res.status(404).json({ success: false, message: 'Upload not found.' });
    }
    return res.status(200).json({ success: true, data: upload });
  } catch (error) {
    console.error('getUpload error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid upload ID.' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/upload
 * List all uploads, newest first.
 */
const getAllUploads = async (req, res) => {
  try {
    const uploads = await Upload.find({})
      .sort({ uploadDate: -1 })
      .select('-__v')
      .lean();
    return res.status(200).json({ success: true, count: uploads.length, data: uploads });
  } catch (error) {
    console.error('getAllUploads error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  uploadFile,
  getUpload,
  getAllUploads,
};
