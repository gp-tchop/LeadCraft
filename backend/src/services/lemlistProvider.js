const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Lemlist provider — uses the Enrich API (async).
 * POST to start enrichment → poll GET for results.
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
    const params = { findEmail: true };
    if (firstName) params.firstName = firstName;
    if (lastName) params.lastName = lastName;
    if (company) params.companyName = company;
    if (domain) params.companyDomain = domain;

    // Step 1: Start async enrichment — Basic auth: empty user, API key as password
    const startResp = await axios.post(
      'https://api.lemlist.com/api/enrich',
      null,
      {
        params,
        auth: { username: '', password: apiKey },
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
        validateStatus: (s) => s < 500,
      }
    );

    if (startResp.status === 402) {
      logger.warn('Lemlist: out of credits');
      return null;
    }

    // Sometimes returns the email synchronously
    if (startResp.status === 200 && startResp.data?.email?.email) {
      const directEmail = startResp.data.email.email;
      logger.info(`Lemlist (direct): found email for ${firstName} ${lastName}: ${directEmail}`);
      return directEmail;
    }

    // Lemlist uses _id, id, or enrichmentId depending on API version
    const enrichId =
      startResp.data?._id ||
      startResp.data?.id ||
      startResp.data?.enrichmentId;

    if (!enrichId) {
      logger.warn(`Lemlist: no enrichment ID in response (status: ${startResp.status})`);
      return null;
    }

    // Step 2: Poll for results (max ~12s with 2s intervals)
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const resultResp = await axios.get(
          `https://api.lemlist.com/api/enrich/${enrichId}`,
          {
            auth: { username: '', password: apiKey },
            timeout: 10000,
            validateStatus: (s) => s < 500,
          }
        );

        if (resultResp.status === 202) continue; // Still processing

        const data = resultResp.data;
        const status = data?.enrichmentStatus || data?.status;

        if (status === 'done' || status === 'completed') {
          const email =
            data?.data?.email?.email ||
            data?.email?.email ||
            data?.result?.email;

          if (email) {
            logger.info(`Lemlist: found email for ${firstName} ${lastName}: ${email}`);
            return email;
          }
          logger.info(`Lemlist: enrichment done but no email for ${firstName} ${lastName}`);
          return null;
        }

        if (status === 'failed' || status === 'error' || status === 'not_found') {
          logger.info(`Lemlist: enrichment ${status} for ${firstName} ${lastName}`);
          return null;
        }
      } catch (pollErr) {
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
