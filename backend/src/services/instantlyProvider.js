const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Instantly provider — uses the SuperSearch enrichment API.
 * Docs: https://developer.instantly.ai/api/v2/supersearchenrichment
 *
 * Note: requires an active paid plan on Instantly.
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
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const timeout = parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000;

  try {
    // Step 1: Preview/search for the lead
    const searchFilters = {};
    if (name) searchFilters.name = [name];
    if (company) searchFilters.company_name = { include: [company] };
    if (domain) searchFilters.domains = [domain];

    const previewResp = await axios.post(
      'https://api.instantly.ai/api/v2/supersearch-enrichment/preview-leads-from-supersearch',
      { search_filters: searchFilters, limit: 1 },
      { headers, timeout, validateStatus: (s) => s < 500 }
    );

    if (previewResp.status === 402) {
      logger.warn('Instantly: no active paid plan');
      return null;
    }

    const leads = previewResp.data?.leads || previewResp.data?.data || [];
    if (!Array.isArray(leads) || leads.length === 0) {
      logger.info(`Instantly: no leads found for ${name}`);
      return null;
    }

    // Check if preview already includes email
    const previewEmail = leads[0]?.email || leads[0]?.work_email;
    if (previewEmail) {
      logger.info(`Instantly (preview): found email for ${name}: ${previewEmail}`);
      return previewEmail;
    }

    // Step 2: Enrich the found lead to get email
    const enrichResp = await axios.post(
      'https://api.instantly.ai/api/v2/supersearch-enrichment/enrich-leads-from-supersearch',
      {
        search_filters: searchFilters,
        limit: 1,
        work_email_enrichment: true,
        skip_rows_without_email: false,
        list_name: `LeadCraft-${Date.now()}`,
      },
      { headers, timeout, validateStatus: (s) => s < 500 }
    );

    if (enrichResp.status === 402) {
      logger.warn('Instantly: no active paid plan for enrichment');
      return null;
    }

    const enrichmentId = enrichResp.data?.id || enrichResp.data?.enrichmentId;
    if (!enrichmentId) {
      logger.warn('Instantly: no enrichment ID returned');
      return null;
    }

    // Step 3: Poll for enrichment results
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      try {
        const statusResp = await axios.get(
          `https://api.instantly.ai/api/v2/supersearch-enrichment/${enrichmentId}`,
          { headers, timeout: 10000, validateStatus: (s) => s < 500 }
        );

        const data = statusResp.data;
        const resultLeads = data?.leads || data?.data?.leads || data?.data || [];

        if (Array.isArray(resultLeads) && resultLeads.length > 0) {
          const email = resultLeads[0]?.email || resultLeads[0]?.work_email;
          if (email) {
            logger.info(`Instantly: found email for ${name}: ${email}`);
            return email;
          }
        }

        const status = data?.status;
        if (status === 'completed' || status === 'done' || status === 'finished') {
          logger.info(`Instantly: enrichment complete but no email for ${name}`);
          return null;
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
