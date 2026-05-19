const axios = require('axios');
const logger = require('./logger');

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function isValidEmailFormat(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validate email via external verification API (optional).
 * Returns { valid: boolean, score: number, reason: string }
 */
async function verifyEmail(email) {
  if (!isValidEmailFormat(email)) {
    return { valid: false, score: 0, reason: 'invalid_format' };
  }

  const apiKey = process.env.EMAIL_VERIFY_API_KEY;
  if (!apiKey) {
    return { valid: true, score: 0.5, reason: 'format_only' };
  }

  try {
    // ZeroBounce-compatible verification API
    const resp = await axios.get('https://api.zerobounce.net/v2/validate', {
      params: { api_key: apiKey, email },
      timeout: 10000,
    });
    const status = resp.data.status;
    const valid = status === 'valid';
    const score = valid ? 1.0 : status === 'catch-all' ? 0.6 : 0;
    return { valid: valid || status === 'catch-all', score, reason: status };
  } catch (err) {
    logger.warn(`Email verification API error for ${email}: ${err.message}`);
    return { valid: true, score: 0.5, reason: 'verification_api_error' };
  }
}

/**
 * Assign a confidence level based on provider and verification score.
 * Provider weights reflect data quality / reliability of each source.
 */
function confidenceLevel(providerName, verificationScore) {
  const providerWeights = {
    apollo:      0.92, // Verified B2B database
    hunter:      0.88, // Verified B2B database
    rocketreach: 0.85, // Verified B2B database
    instantly:   0.80, // SuperSearch verified leads
    lemlist:     0.78, // AI-assisted enrichment
    clay:        0.75, // Webhook-based, depends on Clay table setup
    serper:      0.60, // Web search — email may be from public sources
    arkai:       0.50, // AI-predicted — plausible but unverified
    webscrape:   0.55, // Scraped directly from company website
  };

  const providerWeight = providerWeights[providerName] || 0.5;
  const combined = (providerWeight + verificationScore) / 2;

  if (combined >= 0.75) return 'high';
  if (combined >= 0.5) return 'medium';
  return 'low';
}

module.exports = { isValidEmailFormat, verifyEmail, confidenceLevel };
