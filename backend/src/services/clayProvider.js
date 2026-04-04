const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Find email using Clay API / webhook enrichment.
 * Clay can be configured via a webhook URL or direct API.
 * @param {object} contact - { firstName, lastName, company, domain }
 * @returns {string|null}
 */
async function findEmail(contact) {
  const apiKey = process.env.CLAY_API_KEY;
  const webhookUrl = process.env.CLAY_WEBHOOK_URL;

  if (!apiKey && !webhookUrl) {
    logger.warn('Clay API key and webhook URL not configured');
    return null;
  }

  try {
    let resp;

    if (webhookUrl) {
      // Clay webhook mode
      resp = await axios.post(
        webhookUrl,
        {
          first_name: contact.firstName,
          last_name: contact.lastName,
          company: contact.company,
          domain: contact.domain,
        },
        {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
        }
      );
    } else {
      // Clay direct API
      resp = await axios.post(
        'https://api.clay.com/v1/enrich/email',
        {
          first_name: contact.firstName,
          last_name: contact.lastName,
          company: contact.company,
          domain: contact.domain,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
        }
      );
    }

    const email = resp.data?.email || resp.data?.data?.email || null;
    if (email) {
      logger.info(`Clay: found email for ${contact.firstName} ${contact.lastName}`);
      return email;
    }
    return null;
  } catch (err) {
    logger.error(`Clay API error: ${err.message}`);
    return null;
  }
}

module.exports = { findEmail, name: 'clay' };
