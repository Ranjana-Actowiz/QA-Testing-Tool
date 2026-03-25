const express = require('express');
const router = express.Router();
const { runValidation, getReport, downloadReport } = require('../controllers/validateController');

// POST /api/validate          — Run validation (body: { uploadId, rules })
router.post('/', runValidation);

// ? GET /api/validate/report/:id           — Get a report by ID
router.get('/report/:id', getReport);

// GET /api/validate/report/:id/download  — Download report as CSV
router.get('/report/:id/download', downloadReport);

module.exports = router;
