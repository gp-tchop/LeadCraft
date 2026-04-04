const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { getJob } = require('../utils/jobStore');

const router = express.Router();

/**
 * GET /api/jobs/:jobId/status
 */
router.get('/:jobId/status', async (req, res) => {
  try {
    const job = getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const response = {
      jobId: job.id,
      state: job.state,
      progress: job.progress,
    };

    // Include live enrichment log during processing
    if (job.state === 'active' && job.progress?.enrichmentLog) {
      response.enrichmentLog = job.progress.enrichmentLog;
    }

    if (job.state === 'completed') {
      response.result = job.returnvalue;
      response.downloadUrl = `/api/download/${job.returnvalue?.outputFile}`;
    }

    if (job.state === 'failed') {
      response.error = job.failedReason;
    }

    res.json(response);
  } catch (err) {
    logger.error(`Job status error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

/**
 * GET /api/jobs/:jobId/preview
 */
router.get('/:jobId/preview', async (req, res) => {
  try {
    const job = getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.state !== 'completed') {
      return res.status(400).json({ error: 'Job not yet complete' });
    }

    const result = job.returnvalue;
    const enrichedRows = (result.enrichmentLog || [])
      .filter((entry) => entry.status === 'enriched')
      .map((entry) => ({
        rowIndex: entry.rowIndex,
        email: entry.email,
        provider: entry.provider,
        confidence: entry.confidence,
        verified: entry.verified,
      }));

    res.json({
      jobId: job.id,
      totalRows: result.totalRows,
      enrichedCount: result.enriched,
      failedCount: result.failed,
      unchangedCount: result.unchanged,
      enrichedRows,
    });
  } catch (err) {
    logger.error(`Preview error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch preview' });
  }
});

/**
 * GET /api/jobs/:jobId/download
 */
router.get('/:jobId/download', async (req, res) => {
  try {
    const job = getJob(req.params.jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.state !== 'completed') {
      return res.status(400).json({ error: 'Job not yet complete' });
    }

    const outputFileName = job.returnvalue?.outputFile;
    const outputPath = path.join(__dirname, '..', '..', 'output', outputFileName);

    if (!fs.existsSync(outputPath)) {
      return res.status(404).json({ error: 'Output file not found' });
    }

    res.download(outputPath, 'enriched_contacts.csv');
  } catch (err) {
    logger.error(`Download error: ${err.message}`);
    res.status(500).json({ error: 'Download failed' });
  }
});

module.exports = router;
