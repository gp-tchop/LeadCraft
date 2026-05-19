const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Clay provider — webhook-based enrichment only.
 *
 * Set CLAY_WEBHOOK_URL to a Clay table webhook that accepts
 * first_name, last_name, company, domain and returns an email field.
 * CLAY_API_KEY is sent as a Bearer token if set.
 *
 * Clay does not expose a direct public REST enrichment API;
 * you must create a Clay table workflow and use its inbound webhook URL.
 */
async function findEmail(contact) {
  const webhookUrl = process.env.CLAY_WEBHOOK_URL;
  const apiKey = process.env.CLAY_API_KEY;

  if (!webhookUrl) {
    logger.warn('Clay: CLAY_WEBHOOK_URL not configured — skipping');
    return null;
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const resp = await axios.post(
      webhookUrl,
      {
        first_name: contact.firstName,
        last_name: contact.lastName,
        company: contact.company || '',
        domain: contact.domain || '',
      },
      {
        headers,
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
      }
    );

    // Support common response shapes from Clay webhooks
    const email =
      resp.data?.email ||
      resp.data?.data?.email ||
      resp.data?.result?.email ||
      resp.data?.enriched_email ||
      null;

    if (email) {
      logger.info(`Clay: found email for ${contact.firstName} ${contact.lastName}`);
      return email;
    }

    return null;
  } catch (err) {
    logger.error(`Clay webhook error: ${err.response?.status} ${err.message}`);
    return null;
  }
}

module.exports = { findEmail, name: 'clay' };
