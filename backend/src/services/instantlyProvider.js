const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Find email using Instantly API's lead finder.
 * Instantly provides email verification and lead enrichment.
 */
async function findEmail(contact) {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) {
    logger.warn('Instantly API key not configured');
    return null;
  }

  const { firstName, lastName, company, domain } = contact;
  if (!firstName && !lastName) return null;

  try {
    // Instantly Lead Finder API
    const resp = await axios.post(
      'https://api.instantly.ai/api/v2/lead-finder/enrich',
      {
        first_name: firstName,
        last_name: lastName,
        company_name: company || undefined,
        domain: domain || undefined,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
      }
    );

    const email = resp.data?.email || resp.data?.data?.email || null;
    if (email) {
      logger.info(`Instantly: found email for ${firstName} ${lastName}: ${email}`);
      return email;
    }
  } catch (err) {
    logger.warn(`Instantly enrich error: ${err.response?.status} ${err.message}`);
  }

  // Fallback: Try the search/leads endpoint
  try {
    const searchParams = {
      first_name: firstName,
      last_name: lastName,
    };
    if (company) searchParams.company_name = company;
    if (domain) searchParams.domain = domain;

    const resp = await axios.get(
      'https://api.instantly.ai/api/v2/lead-finder/search',
      {
        params: searchParams,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
      }
    );

    const leads = resp.data?.leads || resp.data?.data || [];
    if (Array.isArray(leads) && leads.length > 0 && leads[0].email) {
      logger.info(`Instantly (search): found email for ${firstName} ${lastName}`);
      return leads[0].email;
    }
  } catch (err) {
    logger.warn(`Instantly search error: ${err.response?.status} ${err.message}`);
  }

  return null;
}

module.exports = { findEmail, name: 'instantly' };
