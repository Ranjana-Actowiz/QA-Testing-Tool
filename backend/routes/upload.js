const express = require('express');
const router = express.Router();
const { uploadFile, getUpload, getAllUploads } = require('../controllers/uploadController');
const { uploadMiddleware } = require('../middleware/multer');

/**
 * Wrap multer middleware to handle its errors gracefully and pass them
 * to Express's error handler instead of crashing.
 */
const handleUpload = (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    }
    next();
  });
};

// POST /api/upload  — Upload a new file
router.post('/', handleUpload, uploadFile);

// GET /api/upload   — List all uploads
router.get('/', getAllUploads);

// GET /api/upload/:id — Get a single upload by ID
router.get('/:id', getUpload);

module.exports = router;
