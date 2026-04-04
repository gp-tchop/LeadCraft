const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { parseCSV, detectEmailColumn } = require('../utils/csvHandler');
const { createJob } = require('../utils/jobStore');
const { processJob } = require('../workers/enrichmentWorker');

const router = express.Router();

// Multer config for CSV uploads
const maxSize = (parseInt(process.env.UPLOAD_MAX_SIZE_MB) || 50) * 1024 * 1024;
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const jobId = uuidv4();
    req.jobId = jobId;
    cb(null, `${jobId}_${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/**
 * POST /api/upload
 * Upload a CSV file, parse it, and return preview. Does NOT start enrichment.
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const jobId = req.jobId;
    const filePath = req.file.path;

    // Quick parse to validate and return preview
    const { headers, rows } = await parseCSV(filePath);
    const emailColumn = detectEmailColumn(headers);

    if (!emailColumn) {
      return res.status(400).json({
        error: 'Could not detect an email column in your CSV. Expected a column named "email", "Email", "e-mail", or similar.',
      });
    }

    const totalRows = rows.length;
    const missingEmails = rows.filter((r) => !(r[emailColumn] || '').trim()).length;

    // Create job but do NOT start processing yet
    createJob(jobId, { inputFile: filePath, jobId });

    // Build preview: all rows with missing emails
    const missingEmailRows = rows
      .map((row, index) => ({ ...row, __rowIndex: index }))
      .filter((r) => !(r[emailColumn] || '').trim());

    logger.info(`Job ${jobId} uploaded: ${totalRows} rows, ${missingEmails} missing emails`);

    res.json({
      jobId,
      totalRows,
      missingEmails,
      emailColumn,
      headers,
      preview: missingEmailRows,
      message: 'File uploaded. Choose how many rows to enrich.',
    });
  } catch (err) {
    logger.error(`Upload error: ${err.message}`);
    if (err.message === 'Only CSV files are allowed') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
});

/**
 * POST /api/upload/:jobId/start
 * Start enrichment for an uploaded job with a batch limit.
 */
router.post('/:jobId/start', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { batchSize } = req.body; // 10, 25, 50, 100, or 'all'

    const job = require('../utils/jobStore').getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.state === 'active' || job.state === 'completed') {
      return res.status(400).json({ error: 'Job already started' });
    }

    // Store batch size in job data
    job.data.batchSize = batchSize || 'all';

    logger.info(`Job ${jobId} starting enrichment with batch size: ${batchSize || 'all'}`);

    // Fire-and-forget
    processJob(jobId);

    res.json({ jobId, message: 'Enrichment started', batchSize: batchSize || 'all' });
  } catch (err) {
    logger.error(`Start enrichment error: ${err.message}`);
    res.status(500).json({ error: 'Failed to start enrichment' });
  }
});

module.exports = router;
