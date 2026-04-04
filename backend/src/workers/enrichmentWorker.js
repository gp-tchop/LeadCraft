const path = require('path');
const logger = require('../utils/logger');
const { parseCSV, detectEmailColumn, writeCSV } = require('../utils/csvHandler');
const { enrichContact } = require('../services/enrichmentEngine');
const { getJob, updateJob } = require('../utils/jobStore');
const pLimit = require('p-limit');

/**
 * Process an enrichment job in-memory (no Redis required).
 * Runs asynchronously — called fire-and-forget from the upload route.
 */
async function processJob(jobId) {
  const job = getJob(jobId);
  if (!job) return;

  try {
    updateJob(jobId, { state: 'active' });

    const { inputFile } = job.data;
    logger.info(`Starting enrichment job ${jobId}`);

    const { headers, rows } = await parseCSV(inputFile);
    const emailColumn = detectEmailColumn(headers);

    if (!emailColumn) {
      throw new Error('Could not detect email column.');
    }

    const totalRows = rows.length;
    const rowsNeedingEnrichment = rows.filter((row) => !(row[emailColumn] || '').trim());

    logger.info(`Job ${jobId}: ${totalRows} total rows, ${rowsNeedingEnrichment.length} need enrichment`);

    updateJob(jobId, {
      progress: {
        phase: 'processing',
        total: totalRows,
        needEnrichment: rowsNeedingEnrichment.length,
        processed: 0,
        enriched: 0,
        failed: 0,
      },
    });

    const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_ROWS) || 10;
    const limit = pLimit(maxConcurrent);

    let processed = 0;
    let enriched = 0;
    let failed = 0;
    const enrichmentLog = [];

    const tasks = rows.map((row, index) => {
      const emailVal = (row[emailColumn] || '').trim();
      if (emailVal) return Promise.resolve(); // Already has email

      return limit(async () => {
        try {
          const result = await enrichContact(row, emailColumn);

          if (result && result.email) {
            row[emailColumn] = result.email;
            enriched++;
            enrichmentLog.push({
              rowIndex: index,
              status: 'enriched',
              email: result.email,
              provider: result.provider,
              confidence: result.confidence,
              verified: result.verified,
            });
          } else {
            failed++;
            enrichmentLog.push({
              rowIndex: index,
              status: 'not_found',
              email: null,
              provider: null,
              confidence: null,
            });
          }
        } catch (err) {
          failed++;
          logger.error(`Error enriching row ${index}: ${err.message}`);
          enrichmentLog.push({
            rowIndex: index,
            status: 'error',
            error: err.message,
          });
        }

        processed++;
        if (processed % 5 === 0 || processed === rowsNeedingEnrichment.length) {
          updateJob(jobId, {
            progress: {
              phase: 'processing',
              total: totalRows,
              needEnrichment: rowsNeedingEnrichment.length,
              processed,
              enriched,
              failed,
            },
          });
        }
      });
    });

    await Promise.all(tasks);

    // Write output CSV
    const outputFile = `enriched_${jobId}.csv`;
    const outputPath = path.join(__dirname, '..', '..', 'output', outputFile);
    await writeCSV(outputPath, headers, rows);

    const summary = {
      totalRows,
      needEnrichment: rowsNeedingEnrichment.length,
      enriched,
      failed,
      unchanged: totalRows - rowsNeedingEnrichment.length,
      outputFile,
      enrichmentLog,
    };

    updateJob(jobId, {
      state: 'completed',
      returnvalue: summary,
      progress: { phase: 'complete', ...summary },
    });

    logger.info(`Job ${jobId} complete: ${enriched} enriched, ${failed} not found`);
  } catch (err) {
    logger.error(`Job ${jobId} failed: ${err.message}`);
    updateJob(jobId, {
      state: 'failed',
      failedReason: err.message,
    });
  }
}

module.exports = { processJob };
