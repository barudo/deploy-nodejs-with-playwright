import { toCsv } from './csv.js';
import { getConfig } from './config.js';
import { fetchSearchAnalyticsRows } from './gsc.js';
import { saveCsv } from './storage.js';

export async function runJob(overrides = {}) {
  const config = getConfig(overrides);
  const rows = await fetchSearchAnalyticsRows(config);
  const csv = toCsv(rows);
  const output = await saveCsv(csv, config);

  return {
    siteUrl: config.siteUrl,
    startDate: config.startDate,
    endDate: config.endDate,
    rowCount: rows.length,
    output
  };
}
