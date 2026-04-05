const path = require('path');
const logger = require('../utils/logger');
const { parseCSV, detectEmailColumn, writeCSV } = require('../utils/csvHandler');
const { enrichContact } = require('../services/enrichmentEngine');
const { getJob, updateJob } = require('../utils/jobStore');
const pLimit = require('p-limit');

/**
 * Process an enrichment job in-memory (no Redis required).
 * Runs asynchronously — called fire-and-forget from the start endpoint.
 */
async function processJob(jobId) {
  const job = getJob(jobId);
  if (!job) return;

  try {
    updateJob(jobId, { state: 'active' });

    const { inputFile, batchSize, providers: selectedProviders } = job.data;
    logger.info(`Starting enrichment job ${jobId}, batchSize: ${batchSize || 'all'}`);

    const { headers, rows } = await parseCSV(inputFile);
    let emailColumn = detectEmailColumn(headers);

    // If no email column exists, create one so enrichment can populate it
    if (!emailColumn) {
      emailColumn = 'email';
      headers.push(emailColumn);
      for (const row of rows) {
        row[emailColumn] = '';
      }
      logger.info(`Job ${jobId}: No email column found — added "${emailColumn}" column`);
    }

    const totalRows = rows.length;
    const allRowsNeedingEnrichment = [];
    rows.forEach((row, index) => {
      if (!(row[emailColumn] || '').trim()) {
        allRowsNeedingEnrichment.push({ row, index });
      }
    });

    // Apply batch size limit
    const limit_count = batchSize === 'all' || !batchSize
      ? allRowsNeedingEnrichment.length
      : Math.min(parseInt(batchSize), allRowsNeedingEnrichment.length);

    const rowsToProcess = allRowsNeedingEnrichment.slice(0, limit_count);

    logger.info(`Job ${jobId}: ${totalRows} total rows, ${allRowsNeedingEnrichment.length} need enrichment, processing ${rowsToProcess.length}`);

    updateJob(jobId, {
      progress: {
        phase: 'processing',
        total: totalRows,
        needEnrichment: rowsToProcess.length,
        processed: 0,
        enriched: 0,
        failed: 0,
      },
    });

    const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_ROWS) || 10;
    const concurrencyLimit = pLimit(maxConcurrent);

    let processed = 0;
    let enriched = 0;
    let failed = 0;
    const enrichmentLog = [];

    const tasks = rowsToProcess.map(({ row, index }) => {
      return concurrencyLimit(async () => {
        try {
          const result = await enrichContact(row, emailColumn, selectedProviders);

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
        updateJob(jobId, {
          progress: {
            phase: 'processing',
            total: totalRows,
            needEnrichment: rowsToProcess.length,
            processed,
            enriched,
            failed,
            enrichmentLog: [...enrichmentLog],
          },
        });
      });
    });

    await Promise.all(tasks);

    // Write output CSV
    const outputFile = `enriched_${jobId}.csv`;
    const outputPath = path.join(__dirname, '..', '..', 'output', outputFile);
    await writeCSV(outputPath, headers, rows);

    const skipped = allRowsNeedingEnrichment.length - rowsToProcess.length;

    const summary = {
      totalRows,
      needEnrichment: rowsToProcess.length,
      enriched,
      failed,
      unchanged: totalRows - allRowsNeedingEnrichment.length,
      skipped,
      outputFile,
      enrichmentLog,
    };

    updateJob(jobId, {
      state: 'completed',
      returnvalue: summary,
      progress: { phase: 'complete', ...summary },
    });

    logger.info(`Job ${jobId} complete: ${enriched} enriched, ${failed} not found, ${skipped} skipped`);
  } catch (err) {
    logger.error(`Job ${jobId} failed: ${err.message}`);
    updateJob(jobId, {
      state: 'failed',
      failedReason: err.message,
    });
  }
}

module.exports = { processJob };
