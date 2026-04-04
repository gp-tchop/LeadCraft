const axios = require('axios');
const logger = require('../utils/logger');

const BASE_URL = 'https://api.apollo.io';

async function findEmail(contact) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    logger.warn('Apollo API key not configured');
    return null;
  }

  // Strategy 1: Use people/match endpoint (best for known name+company)
  try {
    const resp = await axios.post(
      `${BASE_URL}/api/v1/people/match`,
      {
        first_name: contact.firstName,
        last_name: contact.lastName,
        organization_name: contact.company || undefined,
        domain: contact.domain || undefined,
        reveal_personal_emails: false,
      },
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
      }
    );

    const person = resp.data?.person;
    if (person?.email) {
      logger.info(`Apollo (match): found email for ${contact.firstName} ${contact.lastName}`);
      return person.email;
    }
  } catch (err) {
    logger.warn(`Apollo match error: ${err.response?.status} ${err.message}`);
  }

  // Strategy 2: Fallback to search endpoint
  try {
    const body = {
      person_titles: [],
      q_keywords: `${contact.firstName} ${contact.lastName}`.trim(),
      page: 1,
      per_page: 1,
    };
    if (contact.domain) {
      body.q_organization_domains = contact.domain;
    } else if (contact.company) {
      body.q_organization_name = contact.company;
    }

    const resp = await axios.post(
      `${BASE_URL}/api/v1/mixed_people/api_search`,
      body,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
      }
    );

    const people = resp.data?.people || [];
    if (people.length > 0 && people[0].email) {
      logger.info(`Apollo (search): found email for ${contact.firstName} ${contact.lastName}`);
      return people[0].email;
    }
  } catch (err) {
    logger.warn(`Apollo search error: ${err.response?.status} ${err.message}`);
  }

  return null;
}

module.exports = { findEmail, name: 'apollo' };
