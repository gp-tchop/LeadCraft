const axios = require('axios');
const logger = require('../utils/logger');
const { isValidEmailFormat } = require('../utils/emailValidator');

/**
 * ARK AI provider — uses ByteDance Ark (Doubao / Volcano Engine) LLM API
 * for AI-powered email address prediction.
 *
 * Set ARK_AI_MODEL to your deployed endpoint ID, e.g. "ep-20250519-xxxxxxxx"
 * or a public model like "doubao-pro-32k".
 *
 * Docs: https://www.volcengine.com/docs/82379/1263512
 */

const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

async function findEmail(contact) {
  const apiKey = process.env.ARK_AI_API_KEY;
  if (!apiKey) {
    logger.warn('ARK AI API key not configured');
    return null;
  }

  const { firstName, lastName, company, domain } = contact;
  if (!firstName && !lastName) return null;
  if (!domain) {
    logger.info('ARK AI: skipping — no domain available for prediction');
    return null;
  }

  const model = process.env.ARK_AI_MODEL || 'doubao-pro-32k';

  try {
    const systemPrompt =
      'You are an email format prediction assistant. ' +
      'Given a person\'s name, company, and domain, predict their most likely professional email address. ' +
      'Respond with ONLY the email address — no explanation, no punctuation, just the email.';

    const userPrompt =
      `Predict the professional email for:\n` +
      `Name: ${firstName} ${lastName}\n` +
      `Company: ${company || 'Unknown'}\n` +
      `Domain: ${domain}\n\n` +
      `Use the most common business email patterns: ` +
      `firstname.lastname@domain, f.lastname@domain, firstname@domain, firstnamelastname@domain.`;

    const resp = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 64,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: parseInt(process.env.PROVIDER_TIMEOUT_MS) || 15000,
      }
    );

    const content = resp.data?.choices?.[0]?.message?.content?.trim() || '';

    // Try exact match first
    if (isValidEmailFormat(content)) {
      logger.info(`ARK AI: predicted email for ${firstName} ${lastName}: ${content}`);
      return content;
    }

    // Extract email from response if LLM added extra text
    const match = content.match(EMAIL_REGEX);
    if (match && isValidEmailFormat(match[0])) {
      logger.info(`ARK AI: extracted email for ${firstName} ${lastName}: ${match[0]}`);
      return match[0];
    }

    logger.info(`ARK AI: no valid email in response for ${firstName} ${lastName}`);
    return null;
  } catch (err) {
    logger.error(`ARK AI API error: ${err.response?.status} ${err.message}`);
    return null;
  }
}

module.exports = { findEmail, name: 'arkai' };
