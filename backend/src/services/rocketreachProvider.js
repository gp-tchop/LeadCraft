const axios = require('axios');
const logger = require('../utils/logger');

/**
 * RocketReach provider — uses the v2 person lookup API.
 * Docs: https://rocketreach.co/api
 *
 * Strategy 1: lookupProfile (instant lookup, consumes credits only on hit)
 * Strategy 2: search + lookup by ID
 */
async function findEmail(contact) {
  const apiKey = process.env.ROCKETREACH_API_KEY;
  if (!apiKey) {
    logger.warn('RocketReach API key not configured');
    return null;
  }

  const { firstName, lastName, company, domain } = contact;
  if (!firstName && !lastName) return null;

  const headers = { 'Api-Key': apiKey };
  const timeout = parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000;

  // Strategy 1: Direct lookupProfile
  try {
    const params = {
      name: `${firstName} ${lastName}`.trim(),
    };
    if (domain) params.current_employer_domain = domain;
    else if (company) params.current_employer = company;

    const resp = await axios.get('https://api.rocketreach.co/v2/api/lookupProfile', {
      headers,
      params,
      timeout,
    });

    const profile = resp.data;
    if (profile?.emails?.length > 0) {
      const emails = profile.emails;
      // Prefer work email > professional > any valid
      const work = emails.find((e) => e.type === 'work' || e.type === 'professional');
      const chosen = work || emails[0];
      const email = typeof chosen === 'string' ? chosen : chosen?.email;
      if (email) {
        logger.info(`RocketReach (lookup): found email for ${firstName} ${lastName}`);
        return email;
      }
    }
  } catch (err) {
    if (err.response?.status !== 404) {
      logger.warn(`RocketReach lookup error: ${err.response?.status} ${err.message}`);
    }
  }

  // Strategy 2: Search for the person, then lookup by profile ID
  try {
    const searchBody = {
      query: {
        name: [`${firstName} ${lastName}`.trim()],
      },
      start: 1,
      pageSize: 1,
    };
    if (domain) searchBody.query.current_employer_domain = [domain];
    else if (company) searchBody.query.current_employer = [company];

    const searchResp = await axios.post(
      'https://api.rocketreach.co/v2/api/search',
      searchBody,
      { headers: { ...headers, 'Content-Type': 'application/json' }, timeout }
    );

    const profiles = searchResp.data?.profiles || [];
    if (profiles.length === 0) return null;

    const profileId = profiles[0]?.id;
    if (!profileId) return null;

    // Lookup the found profile to get email
    const lookupResp = await axios.get('https://api.rocketreach.co/v2/api/lookupProfile', {
      headers,
      params: { id: profileId },
      timeout,
    });

    const emails = lookupResp.data?.emails || [];
    const work = emails.find((e) => e.type === 'work' || e.type === 'professional');
    const chosen = work || emails[0];
    const email = typeof chosen === 'string' ? chosen : chosen?.email;
    if (email) {
      logger.info(`RocketReach (search+lookup): found email for ${firstName} ${lastName}`);
      return email;
    }

    return null;
  } catch (err) {
    logger.error(`RocketReach search error: ${err.response?.status} ${err.message}`);
    return null;
  }
}

module.exports = { findEmail, name: 'rocketreach' };
