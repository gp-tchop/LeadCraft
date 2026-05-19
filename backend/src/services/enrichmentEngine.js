const axios = require('axios');
const logger = require('../utils/logger');
const { isValidEmailFormat, verifyEmail, confidenceLevel } = require('../utils/emailValidator');

// Import all providers
const apolloProvider = require('./apolloProvider');
const hunterProvider = require('./hunterProvider');
const rocketreachProvider = require('./rocketreachProvider');
const clayProvider = require('./clayProvider');
const serperProvider = require('./serperProvider');
const instantlyProvider = require('./instantlyProvider');
const lemlistProvider = require('./lemlistProvider');
const webScrapeProvider = require('./webScrapeProvider');
const arkAiProvider = require('./arkAiProvider');

/**
 * Provider order: highest-quality paid sources first, AI prediction + scrape last.
 */
const PROVIDERS = [
  apolloProvider,
  hunterProvider,
  rocketreachProvider,
  instantlyProvider,
  lemlistProvider,
  clayProvider,
  serperProvider,
  arkAiProvider,
  webScrapeProvider,
];

/**
 * Extract contact info from a CSV row by detecting common column names.
 */
function extractContactInfo(row) {
  const cols = Object.keys(row);
  const get = (...keys) => {
    for (const key of keys) {
      for (const col of cols) {
        if (col.trim().toLowerCase().replace(/[_\s]/g, '') === key.toLowerCase().replace(/[_\s]/g, '')) {
          const val = (row[col] || '').trim();
          if (val) return val;
        }
      }
    }
    return '';
  };

  let firstName = get(
    'first_name', 'firstname', 'first name', 'fname',
    'payload_firstname', 'First Name'
  );
  let lastName = get(
    'last_name', 'lastname', 'last name', 'lname',
    'payload_lastname', 'Last Name'
  );

  if (!firstName && !lastName) {
    const fullName = get('name', 'full_name', 'fullname', 'full name', 'contact_name', 'contact');
    if (fullName) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
  }

  const company = get(
    'company', 'company_name', 'organization', 'org', 'employer',
    'account_name', 'payload_companyname', 'companyname', 'companyName'
  );
  let domain = get('domain', 'company_domain', 'website', 'url');

  if (domain && !domain.includes('@')) {
    domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }

  return { firstName, lastName, company, domain };
}

/**
 * Try to find a company's domain via Hunter.io domain-search.
 */
async function findDomainForCompany(companyName) {
  if (!companyName) return null;

  const hunterKey = process.env.HUNTER_API_KEY;
  if (hunterKey) {
    try {
      const resp = await axios.get('https://api.hunter.io/v2/domain-search', {
        params: { api_key: hunterKey, company: companyName, limit: 1 },
        timeout: 8000,
      });
      const domain = resp.data?.data?.domain;
      if (domain) {
        logger.info(`Found domain for "${companyName}": ${domain}`);
        return domain;
      }
    } catch (err) {
      logger.warn(`Hunter domain-search error for "${companyName}": ${err.message}`);
    }
  }

  return null;
}

/**
 * Get the list of all available providers with their config status.
 */
function getAvailableProviders() {
  return PROVIDERS.map((p) => {
    let configured = true;
    switch (p.name) {
      case 'apollo':      configured = !!process.env.APOLLO_API_KEY; break;
      case 'hunter':      configured = !!process.env.HUNTER_API_KEY; break;
      case 'rocketreach': configured = !!process.env.ROCKETREACH_API_KEY; break;
      case 'clay':        configured = !!process.env.CLAY_WEBHOOK_URL; break;
      case 'serper':      configured = !!process.env.SERPER_API_KEY; break;
      case 'instantly':   configured = !!process.env.INSTANTLY_API_KEY; break;
      case 'lemlist':     configured = !!process.env.LEMLIST_API_KEY; break;
      case 'arkai':       configured = !!process.env.ARK_AI_API_KEY; break;
      case 'webscrape':   configured = true; break; // always available
      default:            configured = true;
    }
    return { name: p.name, configured };
  });
}

/**
 * Enrich a single contact row — find a missing email.
 * @param {Object} row - CSV row
 * @param {string} emailColumn - email column name
 * @param {string[]|null} selectedProviders - provider names to use, or null for all
 */
async function enrichContact(row, emailColumn, selectedProviders) {
  const existingEmail = (row[emailColumn] || '').trim();
  if (existingEmail && isValidEmailFormat(existingEmail)) {
    return null; // Already has a valid email
  }

  const contact = extractContactInfo(row);

  if (!contact.domain && contact.company) {
    const foundDomain = await findDomainForCompany(contact.company);
    if (foundDomain) contact.domain = foundDomain;
  }

  if (!contact.firstName && !contact.lastName) {
    logger.warn('Skipping row: no name information found');
    return null;
  }

  const activeProviders = selectedProviders
    ? PROVIDERS.filter((p) => selectedProviders.includes(p.name))
    : PROVIDERS;

  if (activeProviders.length === 0) {
    logger.warn('No providers selected');
    return null;
  }

  const mode = process.env.ENRICHMENT_MODE || 'sequential';
  return mode === 'parallel'
    ? enrichParallel(contact, activeProviders)
    : enrichSequential(contact, activeProviders);
}

async function enrichSequential(contact, providers) {
  for (const provider of providers) {
    try {
      logger.info(`Trying provider: ${provider.name} for ${contact.firstName} ${contact.lastName}`);
      const email = await provider.findEmail(contact);

      if (email && isValidEmailFormat(email)) {
        const verification = await verifyEmail(email);
        const confidence = confidenceLevel(provider.name, verification.score);

        logger.info(`Found email via ${provider.name}: ${email} (confidence: ${confidence})`);
        return {
          email,
          provider: provider.name,
          confidence,
          verified: verification.valid,
          verificationReason: verification.reason,
        };
      }
    } catch (err) {
      logger.error(`Provider ${provider.name} failed: ${err.message}`);
    }
  }

  logger.info(`No email found for ${contact.firstName} ${contact.lastName}`);
  return null;
}

async function enrichParallel(contact, providers) {
  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      logger.info(`Trying provider: ${provider.name} for ${contact.firstName} ${contact.lastName}`);
      const email = await provider.findEmail(contact);
      if (email && isValidEmailFormat(email)) {
        const verification = await verifyEmail(email);
        return {
          email,
          provider: provider.name,
          confidence: confidenceLevel(provider.name, verification.score),
          verified: verification.valid,
          verificationReason: verification.reason,
        };
      }
      return null;
    })
  );

  const successes = results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);

  if (successes.length === 0) {
    logger.info(`No email found for ${contact.firstName} ${contact.lastName}`);
    return null;
  }

  const rank = { high: 3, medium: 2, low: 1 };
  successes.sort((a, b) => (rank[b.confidence] || 0) - (rank[a.confidence] || 0));
  const best = successes[0];

  logger.info(`Best email via ${best.provider}: ${best.email} (confidence: ${best.confidence})`);
  return best;
}

module.exports = { enrichContact, extractContactInfo, getAvailableProviders };
