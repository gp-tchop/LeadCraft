const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Find email using Instantly SuperSearch API.
 * Uses preview to find lead, then enrich to get email.
 * Docs: https://developer.instantly.ai/api/v2/supersearchenrichment
 */
async function findEmail(contact) {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) {
    logger.warn('Instantly API key not configured');
    return null;
  }

  const { firstName, lastName, company, domain } = contact;
  if (!firstName && !lastName) return null;

  const name = `${firstName} ${lastName}`.trim();

  try {
    // Build search filters
    const searchFilters = {};
    if (name) searchFilters.name = [name];
    if (company) searchFilters.company_name = { include: [company] };
    if (domain) searchFilters.domains = [domain];

    // Use enrich-leads-from-supersearch with email enrichment enabled
    const resp = await axios.post(
      'https://api.instantly.ai/api/v2/supersearch-enrichment/enrich-leads-from-supersearch',
      {
        search_filters: searchFilters,
        limit: 1,
        work_email_enrichment: true,
        skip_rows_without_email: true,
        list_name: `LeadCraft - ${name}`,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
      }
    );

    // The enrichment is async — check if we got an immediate result
    const enrichmentId = resp.data?.id;
    if (!enrichmentId) {
      logger.warn('Instantly: no enrichment ID returned');
      return null;
    }

    // Poll for enrichment results
    const maxAttempts = 6;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      try {
        const statusResp = await axios.get(
          `https://api.instantly.ai/api/v2/supersearch-enrichment/${enrichmentId}`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 10000,
          }
        );

        const leads = statusResp.data?.leads || statusResp.data?.data?.leads || [];
        if (Array.isArray(leads) && leads.length > 0) {
          const lead = leads[0];
          const email = lead.email || lead.work_email;
          if (email) {
            logger.info(`Instantly: found email for ${name}: ${email}`);
            return email;
          }
        }

        // Check if status is complete
        const status = statusResp.data?.status;
        if (status === 'completed' || status === 'done') {
          break;
        }
      } catch (pollErr) {
        logger.warn(`Instantly poll error: ${pollErr.response?.status} ${pollErr.message}`);
      }
    }

    logger.info(`Instantly: no email found for ${name}`);
    return null;
  } catch (err) {
    logger.error(`Instantly API error: ${err.response?.status} ${err.message}`);
    return null;
  }
}

module.exports = { findEmail, name: 'instantly' };
