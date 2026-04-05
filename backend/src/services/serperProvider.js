const axios = require('axios');
const logger = require('../utils/logger');
const { isValidEmailFormat } = require('../utils/emailValidator');

/**
 * Find email using Serper (Google Search API).
 * Searches Google for the person's work email based on name + company.
 */
async function findEmail(contact) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    logger.warn('Serper API key not configured');
    return null;
  }

  const { firstName, lastName, company, domain } = contact;
  const name = `${firstName} ${lastName}`.trim();
  if (!name) return null;

  // Build search queries — try domain-specific first, then company name
  const queries = [];
  if (domain) {
    queries.push(`"${name}" email "@${domain}"`);
  }
  if (company) {
    queries.push(`"${name}" "${company}" email`);
  }
  queries.push(`"${name}" work email contact`);

  for (const q of queries) {
    try {
      const resp = await axios.post(
        'https://google.serper.dev/search',
        { q, num: 10 },
        {
          headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
        }
      );

      // Search through organic results and snippets for email patterns
      const results = resp.data?.organic || [];
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

      for (const result of results) {
        const text = `${result.snippet || ''} ${result.title || ''}`;
        const emails = text.match(emailRegex) || [];

        for (const email of emails) {
          if (isValidEmailFormat(email) && !email.endsWith('.png') && !email.endsWith('.jpg')) {
            // Basic relevance check — email domain should relate to company or name
            const emailLower = email.toLowerCase();
            const nameLower = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z]/g, '');
            if (
              emailLower.includes(firstName.toLowerCase()) ||
              emailLower.includes(lastName.toLowerCase()) ||
              (domain && emailLower.includes(domain.toLowerCase()))
            ) {
              logger.info(`Serper: found email for ${name}: ${email}`);
              return email;
            }
          }
        }
      }
    } catch (err) {
      logger.warn(`Serper search error for query "${q}": ${err.message}`);
    }
  }

  return null;
}

module.exports = { findEmail, name: 'serper' };
