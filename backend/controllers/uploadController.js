const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const Upload = require('../models/Upload');
const { createRowStream } = require('../services/fileParser');

// ---------------------------------------------------------------------------
// Multer configuration
// ---------------------------------------------------------------------------

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'text/csv',
    'application/csv',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream',
  ];
  const allowedExts = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type: ${file.mimetype}. Only CSV, XLSX, and XLS files are allowed.`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  // No fileSize limit — streaming handles files of any size
});

// Export the multer middleware for use in routes
const uploadMiddleware = upload.single('file');

// ---------------------------------------------------------------------------
// Controller handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/upload
 * Accept a file upload, parse it, save metadata to DB.
 */
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { filename, originalname, mimetype, size, path: filePath } = req.file;

    // Stream the file — collect only headers + first 5 preview rows + total count
    let headers = [];
    const preview = [];
    let totalRows = 0;

    try {
      const stream = createRowStream(filePath, mimetype);
      for await (const item of stream) {
        if (item._headers) {
          headers = item._headers;
          continue;
        }
        totalRows++;
        if (preview.length < 5) preview.push(item);
      }
    } catch (parseErr) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(422).json({
        success: false,
        message: `File parsing failed: ${parseErr.message}`,
      });
    }

    if (headers.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(422).json({
        success: false,
        message: 'The uploaded file appears to be empty or has no headers.',
      });
    }

    // Save upload record to MongoDB
    const uploadDoc = new Upload({
      filename,
      originalName: originalname,
      uploadDate: new Date(),
      headers,
      totalRows,
      filePath,
      fileSize: size,
      mimeType: mimetype,
      status: 'uploaded',
    });

    await uploadDoc.save();

    return res.status(201).json({
      success: true,
      message: 'File uploaded and parsed successfully.',
      uploadId: uploadDoc._id,
      headers,
      totalRows,
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
  uploadMiddleware,
};
