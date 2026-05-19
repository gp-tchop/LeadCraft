const axios = require('axios');
const logger = require('../utils/logger');

/**
 * ARK AI provider — uses app.ai-ark.com B2B data enrichment API
 * to find professional email addresses by searching for a person
 * by name + company/domain.
 *
 * Flow:
 *   1. POST /people   — search by name + company/domain → get person ID
 *   2. POST /people/export/single — fetch verified email for that person ID
 *
 * Auth: X-TOKEN header
 * Docs: https://docs.ai-ark.com/reference/people-search-1
 *       https://docs.ai-ark.com/reference/people-export-single
 */

const BASE_URL = 'https://api.ai-ark.com/api/developer-portal/v1';

async function findEmail(contact) {
  const apiKey = process.env.ARK_AI_API_KEY;
  if (!apiKey) {
    logger.warn('ARK AI: API key not configured');
    return null;
  }

  const { firstName, lastName, company, domain } = contact;
  if (!firstName && !lastName) return null;

  const headers = {
    'X-TOKEN': apiKey,
    'Content-Type': 'application/json',
  };
  const timeout = parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000;

  try {
    // ── Step 1: People Search ──────────────────────────────────────────────
    const searchBody = {
      page: 0,
      size: 1,
    };

    // Build contact filter — use fullName if we have both parts
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    if (fullName) {
      searchBody.contact = { fullName };
    }

    // Build account filter — prefer domain over company name
    if (domain) {
      searchBody.account = { nameOrDomain: domain };
    } else if (company) {
      searchBody.account = { nameOrDomain: company };
    }

    logger.info(`ARK AI: searching for "${fullName}" at "${domain || company || 'unknown'}"`);

    const searchResp = await axios.post(
      `${BASE_URL}/people`,
      searchBody,
      { headers, timeout }
    );

    const people = searchResp.data?.content || searchResp.data?.data || [];
    if (!Array.isArray(people) || people.length === 0) {
      logger.info(`ARK AI: no results for "${fullName}"`);
      return null;
    }

    const personId = people[0]?.id || people[0]?._id;
    const linkedinUrl = people[0]?.linkedinUrl || people[0]?.linkedin?.url;

    if (!personId && !linkedinUrl) {
      logger.info(`ARK AI: person found but no ID or LinkedIn URL available`);
      return null;
    }

    logger.info(`ARK AI: found person ID ${personId} for "${fullName}" — fetching email`);

    // ── Step 2: Export Single Person with Email ────────────────────────────
    const exportBody = {};
    if (personId) {
      exportBody.id = personId;
    } else {
      exportBody.url = linkedinUrl;
    }

    const exportResp = await axios.post(
      `${BASE_URL}/people/export/single`,
      exportBody,
      { headers, timeout }
    );

    // Email can be at various paths depending on API version
    const person = exportResp.data;
    const email =
      person?.email ||
      person?.workEmail ||
      person?.emails?.[0] ||
      person?.contact?.email ||
      person?.data?.email;

    if (email && typeof email === 'string' && email.includes('@')) {
      logger.info(`ARK AI: found email for "${fullName}": ${email}`);
      return email.trim();
    }

    logger.info(`ARK AI: no email returned for "${fullName}"`);
    return null;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) {
      logger.info(`ARK AI: person or email not found (404)`);
    } else if (status === 402) {
      logger.warn(`ARK AI: insufficient credits (402)`);
    } else {
      logger.error(`ARK AI error: ${status} ${err.message}`);
    }
    return null;
  }
}

module.exports = { findEmail, name: 'arkai' };
