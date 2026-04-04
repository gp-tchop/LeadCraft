const axios = require('axios');
const logger = require('../utils/logger');

const BASE_URL = 'https://api.rocketreach.co/v2/api';

/**
 * Find email using RocketReach person lookup.
 * @param {object} contact - { firstName, lastName, company, domain }
 * @returns {string|null}
 */
async function findEmail(contact) {
  const apiKey = process.env.ROCKETREACH_API_KEY;
  if (!apiKey) {
    logger.warn('RocketReach API key not configured');
    return null;
  }

  try {
    const resp = await axios.get(`${BASE_URL}/lookupProfile`, {
      headers: { 'Api-Key': apiKey },
      params: {
        name: `${contact.firstName} ${contact.lastName}`.trim(),
        current_employer: contact.company || undefined,
      },
      timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
    });

    const emails = resp.data?.emails || [];
    if (emails.length > 0) {
      // Pick first professional email if available
      const professional = emails.find((e) => e.type === 'professional');
      const email = professional ? professional.email : emails[0].email || emails[0];
      if (email) {
        logger.info(`RocketReach: found email for ${contact.firstName} ${contact.lastName}`);
        return typeof email === 'string' ? email : null;
      }
    }
    return null;
  } catch (err) {
    logger.error(`RocketReach API error: ${err.message}`);
    return null;
  }
}

module.exports = { findEmail, name: 'rocketreach' };
