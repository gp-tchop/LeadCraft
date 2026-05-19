const axios = require('axios');
const logger = require('../utils/logger');

/**
 * ARK AI provider — uses app.ai-ark.com B2B data enrichment API
 * to find verified professional email addresses.
 *
 * Flow:
 *   1. POST /people   — search by fullName + domain/company → get person ID
 *   2. POST /people/export/single — get verified email for that person ID
 *
 * Auth: X-TOKEN header
 * Docs: https://docs.ai-ark.com/reference/people-search-1
 *       https://docs.ai-ark.com/reference/people-export-single
 *
 * Filter format:
 *   contact.fullName.any.include = { mode: "SMART", content: ["Name"] }
 *   account.domain.any.include   = ["domain.com"]          (plain array)
 *   account.name.any.include     = { mode: "SMART", content: ["Company"] }
 *
 * Email response: email.output.address (string) or email.output[].address (array)
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
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  try {
    // ── Step 1: People Search ──────────────────────────────────────────────
    const searchBody = {
      page: 0,
      size: 1,
      contact: {
        fullName: {
          any: {
            include: { mode: 'SMART', content: [fullName] },
          },
        },
      },
    };

    // Prefer domain filter (exact); fall back to company name
    if (domain) {
      searchBody.account = {
        domain: { any: { include: [domain] } },
      };
    } else if (company) {
      searchBody.account = {
        name: { any: { include: { mode: 'SMART', content: [company] } } },
      };
    }

    logger.info(`ARK AI: searching for "${fullName}" at "${domain || company || 'unknown'}"`);

    const searchResp = await axios.post(
      `${BASE_URL}/people`,
      searchBody,
      { headers, timeout }
    );

    const people = searchResp.data?.content || [];
    if (!Array.isArray(people) || people.length === 0) {
      logger.info(`ARK AI: no results for "${fullName}"`);
      return null;
    }

    const person = people[0];
    const personId = person?.id;
    const linkedinUrl = person?.link?.linkedin;

    if (!personId && !linkedinUrl) {
      logger.info(`ARK AI: person found but no ID or LinkedIn URL`);
      return null;
    }

    logger.info(`ARK AI: found person ID ${personId} for "${fullName}" — fetching email`);

    // ── Step 2: Export Single Person with Email ────────────────────────────
    const exportBody = personId ? { id: personId } : { url: linkedinUrl };

    const exportResp = await axios.post(
      `${BASE_URL}/people/export/single`,
      exportBody,
      { headers, timeout }
    );

    const emailField = exportResp.data?.email;

    // email.output can be a single object or an array
    let address = null;
    if (emailField?.output) {
      const output = emailField.output;
      if (Array.isArray(output)) {
        // Pick the first VALID or CATCH_ALL email
        const best = output.find(
          (e) => e.status === 'VALID' || e.status === 'CATCH_ALL'
        ) || output[0];
        address = best?.address;
      } else {
        address = output?.address;
      }
    }

    if (address && typeof address === 'string' && address.includes('@')) {
      logger.info(`ARK AI: found email for "${fullName}": ${address}`);
      return address.trim();
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
