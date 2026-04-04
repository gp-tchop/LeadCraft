const axios = require('axios');
const logger = require('../utils/logger');

const BASE_URL = 'https://api.hunter.io/v2';

// Cache domain patterns to avoid repeated API calls
const domainCache = new Map();

async function findEmail(contact) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    logger.warn('Hunter.io API key not configured');
    return null;
  }

  const domain = contact.domain || null;
  const company = contact.company || null;

  if (!domain && !company) {
    logger.warn(`Hunter: no domain or company for ${contact.firstName} ${contact.lastName}`);
    return null;
  }

  // Strategy 1: Direct email-finder
  try {
    const params = {
      api_key: apiKey,
      first_name: contact.firstName,
      last_name: contact.lastName,
    };
    if (domain) params.domain = domain;
    else params.company = company;

    const resp = await axios.get(`${BASE_URL}/email-finder`, {
      params,
      timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
    });

    const data = resp.data?.data;
    if (data?.email) {
      logger.info(`Hunter (finder): ${data.email} for ${contact.firstName} ${contact.lastName} (score: ${data.score})`);
      return data.email;
    }
  } catch (err) {
    const status = err.response?.status;
    if (status !== 404) {
      logger.error(`Hunter finder error (${status}): ${err.message}`);
    }
  }

  // Strategy 2: Use domain-search to get email pattern, then generate email
  try {
    const searchDomain = domain || null;
    const cacheKey = searchDomain || company;
    let domainData = domainCache.get(cacheKey);

    if (!domainData) {
      const params = { api_key: apiKey, limit: 5 };
      if (searchDomain) params.domain = searchDomain;
      else params.company = company;

      const resp = await axios.get(`${BASE_URL}/domain-search`, {
        params,
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
      });

      domainData = resp.data?.data;
      if (domainData) {
        domainCache.set(cacheKey, domainData);
      }
    }

    if (domainData?.pattern && domainData?.domain) {
      const email = applyPattern(
        domainData.pattern,
        contact.firstName,
        contact.lastName,
        domainData.domain
      );
      if (email) {
        logger.info(`Hunter (pattern "${domainData.pattern}"): ${email} for ${contact.firstName} ${contact.lastName}`);
        return email;
      }
    }

    // Also update contact.domain for downstream providers if we found it
    if (domainData?.domain && !contact.domain) {
      contact.domain = domainData.domain;
    }
  } catch (err) {
    logger.error(`Hunter domain-search error: ${err.message}`);
  }

  return null;
}

/**
 * Apply Hunter email pattern to generate an email address.
 * Patterns: {first}, {last}, {f} (first initial), {l} (last initial)
 */
function applyPattern(pattern, firstName, lastName, domain) {
  if (!firstName || !lastName || !pattern || !domain) return null;

  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '');

  if (!f || !l) return null;

  const email = pattern
    .replace(/\{first\}/g, f)
    .replace(/\{last\}/g, l)
    .replace(/\{f\}/g, f[0])
    .replace(/\{l\}/g, l[0]);

  return `${email}@${domain}`;
}

module.exports = { findEmail, name: 'hunter' };
