const express = require('express');
const router = express.Router();
const { runValidation, getReport, downloadReport, listReports } = require('../controllers/validateController');

// POST /api/validate          — Run validation (body: { uploadId, rules })
router.post('/', runValidation);

// GET /api/validate/reports   — List recent reports (for Load Previous Rules)
// IMPORTANT: must be declared before /report/:id to avoid :id matching "reports"
router.get('/reports', listReports);

// ? GET /api/validate/report/:id           — Get a report by ID
router.get('/report/:id', getReport);

// GET /api/validate/report/:id/download           — Download full report as XLSX
// GET /api/validate/report/:id/download?column=X  — Download column-specific XLSX
router.get('/report/:id/download', downloadReport);

module.exports = router;
