const fs = require('fs');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');
const logger = require('./logger');

/**
 * Parse a CSV file and return { headers, rows }.
 * Each row is an object keyed by header name.
 */
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;

    fs.createReadStream(filePath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        relax_quotes: true,
        quote: '"',
        escape: '"',
        ltrim: true,
        rtrim: true,
      }))
      .on('headers', (h) => { headers = h; })
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        if (!headers && rows.length > 0) {
          headers = Object.keys(rows[0]);
        }
        resolve({ headers: headers || [], rows });
      })
      .on('error', reject);
  });
}

/**
 * Detect which column holds email addresses.
 * Looks for common names like "email", "e-mail", "email_address", etc.
 */
function detectEmailColumn(headers) {
  // Priority 1: Exact match (case-insensitive) for common email column names
  const exactCandidates = [
    'email', 'e-mail', 'email_address', 'emailaddress',
    'e_mail', 'mail', 'contact_email', 'work_email',
    'personal_email', 'payload_email',
  ];
  for (const candidate of exactCandidates) {
    const found = headers.find(
      (h) => h.trim().toLowerCase() === candidate.toLowerCase()
    );
    if (found) return found;
  }

  // Priority 2: Column named exactly "Email" (case-sensitive) to avoid
  // matching "Email Provider", "Assignee Email", "email_click_count", etc.
  const exactCase = headers.find((h) => h.trim() === 'Email');
  if (exactCase) return exactCase;

  return null;
}

/**
 * Write rows back to a CSV file, preserving exact column order.
 */
function writeCSV(filePath, headers, rows) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(filePath);
    const stringifier = stringify({ header: true, columns: headers });
    stringifier.pipe(output);
    stringifier.on('finish', resolve);
    stringifier.on('error', reject);

    for (const row of rows) {
      stringifier.write(row);
    }
    stringifier.end();
  });
}

module.exports = { parseCSV, detectEmailColumn, writeCSV };
