import { toCsv } from './csv.js';
import { getConfig } from './config.js';
import { scrapeGscReports } from './playwright-gsc.js';
import { saveCsv } from './storage.js';

export async function runJob(overrides = {}) {
  const config = getConfig(overrides);
  const rows = await scrapeGscReports(config);
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
