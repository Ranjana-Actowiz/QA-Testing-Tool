/**
 * Upload folder cleanup service
 *
 * Two sources of orphaned files are handled:
 *
 *  1. Stale DB-tracked uploads — uploaded but never validated within STALE_AFTER_MS.
 *     Both the DB record and the physical file are removed.
 *
 *  2. Truly orphaned files — present in uploads/ but with no matching DB record.
 *     These are left by server crashes mid-upload before the DB write completed.
 *
 * The cleanup runs once on server start (after a short delay to let MongoDB connect)
 * and then every INTERVAL_MS.
 */

const fs   = require('fs');
const path = require('path');
const Upload = require('../models/Upload');

const UPLOADS_DIR    = path.join(__dirname, '..', 'uploads');
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;  // 2 hours — more than enough for any validation run
const INTERVAL_MS    = 60 * 60 * 1000;       // run every 1 hour
const STARTUP_DELAY  = 10 * 1000;            // wait 10 s after boot so DB is ready

// ---------------------------------------------------------------------------

async function runCleanup() {
  try {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);

    // ── 1. Stale DB-tracked uploads ──────────────────────────────────────
    const stale = await Upload.find({ createdAt: { $lt: cutoff } }).lean();

    let dbRemoved = 0;
    let fileRemoved = 0;

    for (const doc of stale) {
      if (doc.filePath && fs.existsSync(doc.filePath)) {
        fs.unlinkSync(doc.filePath);
        fileRemoved++;
      }
      await Upload.deleteOne({ _id: doc._id });
      dbRemoved++;
    }

    // ── 2. Truly orphaned files (no DB record) ────────────────────────────
    if (fs.existsSync(UPLOADS_DIR)) {
      // Build a set of known file paths from DB (all uploads, not just stale)
      const tracked = await Upload.find({}, 'filePath').lean();
      const trackedPaths = new Set(tracked.map((d) => d.filePath));

      const diskFiles = fs.readdirSync(UPLOADS_DIR);
      for (const name of diskFiles) {
        // Skip the .gitkeep placeholder if present
        if (name === '.gitkeep') continue;
        const fullPath = path.join(UPLOADS_DIR, name);
        if (!trackedPaths.has(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
            fileRemoved++;
          } catch (_) {
            // ignore — file may have just been deleted by a concurrent validation
          }
        }
      }
    }

    if (dbRemoved > 0 || fileRemoved > 0) {
      console.log(`[cleanup] removed ${dbRemoved} stale upload record(s), ${fileRemoved} file(s)`);
    }
  } catch (err) {
    console.error('[cleanup] error during upload cleanup:', err.message);
  }
}

// ---------------------------------------------------------------------------

function startCleanupScheduler() {
  // Delay the first run so MongoDB has time to connect on cold start
  setTimeout(() => {
    runCleanup();
    setInterval(runCleanup, INTERVAL_MS);
  }, STARTUP_DELAY);
}

module.exports = { startCleanupScheduler, runCleanup };
