const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Find email using Lemlist API.
 * Lemlist provides email finder and enrichment capabilities.
 */
async function findEmail(contact) {
  const apiKey = process.env.LEMLIST_API_KEY;
  if (!apiKey) {
    logger.warn('Lemlist API key not configured');
    return null;
  }

  const { firstName, lastName, company, domain } = contact;
  if (!firstName && !lastName) return null;

  // Strategy 1: Email finder endpoint
  try {
    const resp = await axios.get(
      'https://api.lemlist.com/api/email-finder',
      {
        params: {
          first_name: firstName,
          last_name: lastName,
          company_name: company || undefined,
          domain: domain || undefined,
        },
        headers: {
          'X-Api-Key': apiKey,
        },
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
      }
    );

    const email = resp.data?.email || resp.data?.data?.email || null;
    if (email) {
      logger.info(`Lemlist: found email for ${firstName} ${lastName}: ${email}`);
      return email;
    }
  } catch (err) {
    logger.warn(`Lemlist email-finder error: ${err.response?.status} ${err.message}`);
  }

  // Strategy 2: Enrich endpoint
  try {
    const resp = await axios.post(
      'https://api.lemlist.com/api/enrich',
      {
        firstName,
        lastName,
        companyName: company || undefined,
        companyDomain: domain || undefined,
      },
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
      }
    );

    const email = resp.data?.email || resp.data?.data?.email || null;
    if (email) {
      logger.info(`Lemlist (enrich): found email for ${firstName} ${lastName}`);
      return email;
    }
  } catch (err) {
    logger.warn(`Lemlist enrich error: ${err.response?.status} ${err.message}`);
  }

  return null;
}

module.exports = { findEmail, name: 'lemlist' };
