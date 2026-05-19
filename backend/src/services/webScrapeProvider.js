const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const { isValidEmailFormat } = require('../utils/emailValidator');

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * WebScrape provider — scrapes company website pages to find emails.
 * Last-resort fallback. Only returns emails actually found on the page
 * (no unverified pattern guessing).
 */
async function findEmail(contact) {
  const { domain } = contact;
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  if (!fullName) return null;
  if (!domain) return null;

  return scrapeCompanyWebsite(domain, contact);
}

async function scrapeCompanyWebsite(domain, contact) {
  const pages = [
    `https://${domain}/team`,
    `https://${domain}/about`,
    `https://${domain}/contact`,
    `https://${domain}/about-us`,
    `https://${domain}/our-team`,
    `https://${domain}/people`,
  ];

  const firstName = contact.firstName?.toLowerCase();
  const lastName = contact.lastName?.toLowerCase();

  for (const url of pages) {
    try {
      const resp = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        maxRedirects: 3,
        validateStatus: (s) => s < 400,
      });

      const $ = cheerio.load(resp.data);

      // Check page text + mailto links for matching emails
      const emailsFound = new Set();

      // From mailto: links (most reliable)
      $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const email = href.replace('mailto:', '').split('?')[0].trim();
        if (isValidEmailFormat(email)) emailsFound.add(email.toLowerCase());
      });

      // From visible text
      const text = $('body').text();
      const matches = text.match(EMAIL_REGEX) || [];
      matches.forEach((e) => {
        if (isValidEmailFormat(e)) emailsFound.add(e.toLowerCase());
      });

      // Filter: email must contain first or last name fragment (or domain match)
      for (const email of emailsFound) {
        const local = email.split('@')[0];
        const emailDomain = email.split('@')[1];

        // Skip generic emails (info@, hello@, support@, etc.)
        const generic = ['info', 'hello', 'support', 'contact', 'admin', 'sales', 'help', 'team', 'mail', 'office'];
        if (generic.some((g) => local === g)) continue;

        // Must be on the correct domain
        if (domain && !emailDomain?.includes(domain.replace(/^www\./, ''))) continue;

        const matchesName =
          (firstName && local.includes(firstName)) ||
          (lastName && local.includes(lastName));

        if (matchesName) {
          logger.info(`WebScrape: found matching email on ${url}: ${email}`);
          return email;
        }
      }
    } catch {
      // Page not found or blocked — try next
    }
  }

  return null;
}

module.exports = { findEmail, name: 'webscrape' };
