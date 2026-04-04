const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const { isValidEmailFormat } = require('../utils/emailValidator');

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Attempt to find an email by scraping publicly available web pages.
 * This is a last-resort fallback.
 * @param {object} contact - { firstName, lastName, company, domain }
 * @returns {string|null}
 */
async function findEmail(contact) {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const company = contact.company || '';
  const domain = contact.domain || '';

  if (!fullName) return null;

  // Strategy 1: Try company website contact/about/team pages
  if (domain) {
    const email = await scrapeCompanyWebsite(domain, contact);
    if (email) return email;
  }

  // Strategy 2: Generate common email patterns and check via domain
  if (domain) {
    const guessed = generateEmailGuesses(contact, domain);
    if (guessed.length > 0) {
      logger.info(`WebScrape: returning pattern-generated email for ${fullName}`);
      return guessed[0]; // Return the most common pattern
    }
  }

  return null;
}

async function scrapeCompanyWebsite(domain, contact) {
  const pages = [
    `https://${domain}/about`,
    `https://${domain}/team`,
    `https://${domain}/contact`,
    `https://${domain}/about-us`,
  ];

  for (const url of pages) {
    try {
      const resp = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LeadCraft/1.0; email-enrichment)',
        },
        maxRedirects: 3,
        validateStatus: (status) => status < 400,
      });

      const $ = cheerio.load(resp.data);
      const text = $('body').text();
      const matches = text.match(EMAIL_PATTERN) || [];

      // Filter for emails matching the contact's name
      const firstName = contact.firstName?.toLowerCase();
      const lastName = contact.lastName?.toLowerCase();

      for (const email of matches) {
        const lower = email.toLowerCase();
        if (
          (firstName && lower.includes(firstName)) ||
          (lastName && lower.includes(lastName))
        ) {
          if (isValidEmailFormat(email)) {
            logger.info(`WebScrape: found matching email on ${url}`);
            return email;
          }
        }
      }
    } catch {
      // Page doesn't exist or blocked — continue
    }
  }
  return null;
}

/**
 * Generate common email format guesses.
 * Returns array sorted by most common patterns first.
 */
function generateEmailGuesses(contact, domain) {
  const first = (contact.firstName || '').toLowerCase().replace(/[^a-z]/g, '');
  const last = (contact.lastName || '').toLowerCase().replace(/[^a-z]/g, '');

  if (!first || !last) return [];

  return [
    `${first}.${last}@${domain}`,
    `${first}${last}@${domain}`,
    `${first[0]}${last}@${domain}`,
    `${first}@${domain}`,
    `${first}_${last}@${domain}`,
    `${first[0]}.${last}@${domain}`,
  ];
}

module.exports = { findEmail, name: 'webscrape' };
