const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Find email using Lemlist Enrich API.
 * Uses async enrichment: POST to start, then poll GET for results.
 * Docs: https://developer.lemlist.com/api-reference/endpoints/enrich
 */
async function findEmail(contact) {
  const apiKey = process.env.LEMLIST_API_KEY;
  if (!apiKey) {
    logger.warn('Lemlist API key not configured');
    return null;
  }

  const { firstName, lastName, company, domain } = contact;
  if (!firstName && !lastName) return null;

  try {
    // Build query params for the enrich endpoint
    const params = { findEmail: true };
    if (firstName) params.firstName = firstName;
    if (lastName) params.lastName = lastName;
    if (company) params.companyName = company;
    if (domain) params.companyDomain = domain;

    // Step 1: Start enrichment (async) — uses Basic auth with empty user + apiKey as password
    const startResp = await axios.post(
      'https://api.lemlist.com/api/enrich',
      null,
      {
        params,
        auth: { username: '', password: apiKey },
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
      }
    );

    const enrichId = startResp.data?.id || startResp.data?.enrichmentId;
    if (!enrichId) {
      logger.warn('Lemlist: no enrichment ID returned');
      return null;
    }

    // Step 2: Poll for results (max ~12 seconds with 2s intervals)
    const maxAttempts = 6;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const resultResp = await axios.get(
          `https://api.lemlist.com/api/enrich/${enrichId}`,
          {
            auth: { username: '', password: apiKey },
            timeout: 10000,
          }
        );

        const status = resultResp.data?.enrichmentStatus;
        if (status === 'done') {
          const email = resultResp.data?.data?.email?.email;
          const notFound = resultResp.data?.data?.email?.notFound;
          if (email && !notFound) {
            logger.info(`Lemlist: found email for ${firstName} ${lastName}: ${email}`);
            return email;
          }
          logger.info(`Lemlist: enrichment done but no email found for ${firstName} ${lastName}`);
          return null;
        }

        if (status === 'failed' || status === 'error') {
          logger.warn(`Lemlist: enrichment failed for ${firstName} ${lastName}`);
          return null;
        }

        // Still processing — continue polling
      } catch (pollErr) {
        if (pollErr.response?.status === 202) {
          // 202 = still in progress, continue polling
          continue;
        }
        logger.warn(`Lemlist poll error: ${pollErr.response?.status} ${pollErr.message}`);
      }
    }

    logger.warn(`Lemlist: enrichment timed out for ${firstName} ${lastName}`);
    return null;
  } catch (err) {
    logger.error(`Lemlist API error: ${err.response?.status} ${err.message}`);
    return null;
  }
}

module.exports = { findEmail, name: 'lemlist' };
